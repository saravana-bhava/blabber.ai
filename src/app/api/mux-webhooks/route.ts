import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Mux from '@mux/mux-node';
import { createServiceRoleClient } from '@/lib/supabase/server';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

// Ensure MUX_WEBHOOK_SIGNING_SECRET is in your .env.local
const MUX_WEBHOOK_SIGNING_SECRET = process.env.MUX_WEBHOOK_SIGNING_SECRET;

// Initialize Mux client with webhook secret for unwrap method
// This can be outside the POST handler if preferred, MUX_WEBHOOK_SIGNING_SECRET should be available
let mux: Mux;
if (MUX_WEBHOOK_SIGNING_SECRET) {
  mux = new Mux({
    webhookSecret: MUX_WEBHOOK_SIGNING_SECRET,
  });
} else {
  console.error('Mux Webhook: MUX_WEBHOOK_SIGNING_SECRET is not set. Webhook verification will fail.');
  // Fallback to a default Mux instance if secret is not set, though unwrap will likely fail or not be used.
  mux = new Mux(); 
}


async function generateBlurredVideoThumbnail(muxPlaybackId: string, supabase: any, userId: string): Promise<string | null> {
  try {
    // Generate Mux thumbnail URL
    const thumbnailUrl = `https://image.mux.com/${muxPlaybackId}/thumbnail.jpg?time=5`;
    
    // Fetch the thumbnail
    const response = await fetch(thumbnailUrl);
    if (!response.ok) {
      console.error('Error fetching Mux thumbnail:', response.statusText);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate blurred thumbnail using Sharp
    const blurredBuffer = await sharp(buffer)
      .blur(20) // Apply blur
      .jpeg({ quality: 50 }) // Convert to JPEG with 50% quality
      .toBuffer();

    // Upload the blurred thumbnail using service role client to bypass RLS
    const serviceRoleClient = createServiceRoleClient();
    const fileName = `${userId}/${uuidv4()}_video_blurred.jpg`;
    const filePath = `public/post_media/${fileName}`;

    const { error: uploadError } = await serviceRoleClient.storage
      .from('post-images')
      .upload(filePath, blurredBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('Error uploading blurred video thumbnail:', uploadError);
      return null;
    }

    return filePath;
  } catch (error) {
    console.error('Error generating blurred video thumbnail:', error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (!MUX_WEBHOOK_SIGNING_SECRET) {
    // This check is somewhat redundant if mux instance creation handles it, but good for clarity
    console.error('Mux Webhook: MUX_WEBHOOK_SIGNING_SECRET is not configured. Cannot process webhook.');
    return NextResponse.json({ error: 'Webhook signing secret not configured.' }, { status: 500 });
  }
  
  // headers() must be called within the Next.js Route Handler or a Server Component
  const headersList = await headers(); // Await the headers
  const rawBody = await req.text();

  // Convert Next.js ReadonlyHeaders to a plain object for Mux
  const plainHeaders: Record<string, string> = {};
  headersList.forEach((value, key) => {
    plainHeaders[key] = value;
  });

  let event; // Allow type inference for event from mux.webhooks.unwrap()
  try {
    // unwrap will verify the signature and parse the body
    // It uses the webhookSecret configured on the Mux instance
    event = mux.webhooks.unwrap(rawBody, plainHeaders);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error during webhook processing.';
    console.error(`Mux Webhook: Error processing webhook: ${errorMessage}`, err);
    return NextResponse.json({ error: `Webhook Error: ${errorMessage}` }, { status: 400 });
  }

  // Mux calls this route server-to-server (no user session). Service role bypasses RLS.
  const supabase = createServiceRoleClient();

  try {
    switch (event.type as string) {
      case 'video.asset.ready':
        // Type assertion to the specific event type is still good for clarity and strong typing of data
        const assetReadyEvent = event as Mux.Webhooks.VideoAssetReadyWebhookEvent;
        const assetData = assetReadyEvent.data;

        if (!assetData.id || !assetData.playback_ids || assetData.playback_ids.length === 0) {
          console.error('Mux Webhook: video.asset.ready event missing critical data.', assetData);
          return NextResponse.json({ error: 'Event data incomplete for video.asset.ready' }, { status: 400 });
        }

        // Type of 'p' should be inferred from assetData.playback_ids (Mux.Video.PlaybackID[])
        const primaryPlaybackId = assetData.playback_ids.find(p => p.policy === 'public')?.id;
        if (!primaryPlaybackId) {
          console.error('Mux Webhook: No public playback ID found for asset.', assetData.playback_ids);
          return NextResponse.json({ error: 'No public playback ID available.' }, { status: 400 });
        }
        
        let uploadIdToFind: string | undefined = undefined;
        // passthrough should be on assetData
        if (assetData.passthrough) {
          uploadIdToFind = assetData.passthrough;
        } else if (assetData.upload_id) { // upload_id is also on assetData
          uploadIdToFind = assetData.upload_id;
          console.warn(`Mux Webhook: video.asset.ready - passthrough not found, falling back to upload_id from event: ${uploadIdToFind}`);
        }

        if (!uploadIdToFind) {
            console.error('Mux Webhook: video.asset.ready - Cannot determine identifier (passthrough or upload_id) from event to link to post_media.', assetData);
            return NextResponse.json({ error: 'Could not link asset to post media.' }, { status: 400 });
        }

        const { data: updatedRows, error: updateError } = await supabase
          .from('post_media')
          .update({
            mux_asset_id: assetData.id,
            mux_playback_id: primaryPlaybackId,
          })
          .eq('mux_upload_id', uploadIdToFind)
          .select('id');

        if (updateError) {
          console.error('Mux Webhook: Error updating post_media for asset.ready:', updateError, `identifier used: ${uploadIdToFind}`);
          return NextResponse.json({ error: `Database update failed: ${updateError.message}` }, { status: 500 });
        }
        if (!updatedRows?.length) {
          console.error('Mux Webhook: No post_media row matched mux_upload_id:', uploadIdToFind);
          return NextResponse.json({ error: 'No matching post media row for upload id' }, { status: 404 });
        }

        // Generate blurred thumbnail for non-public videos
        try {
          // Get the post and media info to check if it's non-public
          const { data: mediaData, error: mediaError } = await supabase
            .from('post_media')
            .select(`
              user_id,
              posts(access_level)
            `)
            .eq('mux_upload_id', uploadIdToFind)
            .single();

          if (!mediaError && mediaData && mediaData.posts?.[0]?.access_level !== 'public') {
            // Generate blurred thumbnail for non-public video
            const blurredPath = await generateBlurredVideoThumbnail(primaryPlaybackId, supabase, mediaData.user_id);
            
            if (blurredPath) {
              // Update the post_media with the blurred thumbnail path
              const { error: blurUpdateError } = await supabase
                .from('post_media')
                .update({ blurred_storage_path: blurredPath })
                .eq('mux_upload_id', uploadIdToFind);

              if (blurUpdateError) {
                console.error('Mux Webhook: Error updating blurred thumbnail path:', blurUpdateError);
              } else {
              }
            }
          }
        } catch (blurError) {
          console.error('Mux Webhook: Error generating blurred thumbnail:', blurError);
          // Don't fail the webhook for blur generation errors
        }

        break;

      case 'video.upload.asset_created':
        const uploadAssetCreatedEvent = event as Mux.Webhooks.VideoUploadAssetCreatedWebhookEvent;
        const uploadAssetData = uploadAssetCreatedEvent.data;
        
        if (uploadAssetData.asset_id && uploadAssetData.id) {
            // Access passthrough cautiously if not on the Upload type directly
            let identifierToUpdate = (uploadAssetData as any).passthrough || uploadAssetData.id;
            
            const { error: updateUploadError } = await supabase
              .from('post_media')
              .update({ mux_asset_id: uploadAssetData.asset_id })
              .eq('mux_upload_id', identifierToUpdate); 
            
            if (updateUploadError) {
                 console.error('Mux Webhook: Error updating post_media for upload.asset_created:', updateUploadError, `identifier used: ${identifierToUpdate}`);
            } else {
            }
        } else {
            console.warn('Mux Webhook: video.upload.asset_created event missing asset_id or upload_id.', uploadAssetData);
        }
        break;

      // LIVESTREAM DISABLED — live stream webhook cases commented out
      /*
      case 'video.live_stream.created':
      case 'video.live_stream.connected':
      case 'video.live_stream.disconnected':
      case 'video.live_stream.recording_ready':
      case 'video.live_stream.idle':
        break;
      */

      // Add other Mux event types you want to handle (e.g., video.asset.errored)
      default:
        const eventType = (event as any)?.type || 'unknown event structure';
    }
  } catch (dbError: unknown) {
      const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown internal server error.';
      console.error('Mux Webhook: Database operation error:', dbError);
      return NextResponse.json({ error: `Internal server error during webhook processing: ${errorMessage}` }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
} 