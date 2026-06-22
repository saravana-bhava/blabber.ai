'use server';

// LIVESTREAM DISABLED — functionality commented out, stubs kept for import compatibility

export async function createLiveStream(
  title?: string,
  accessLevel: 'public' | 'subscribers_only' | 'ppv' = 'public'
): Promise<{ postId: string } | { error: string }> {
  return { error: 'Live streaming is currently unavailable' };
}

export async function getBroadcastStreamData(postId: string): Promise<
  | { data: { streamId: string; streamKey: string; playbackId: string } }
  | { error: string }
> {
  return { error: 'Live streaming is currently unavailable' };
}

/*
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

async function _createLiveStream(
  title?: string,
  accessLevel: 'public' | 'subscribers_only' | 'ppv' = 'public'
) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { error: 'Not authenticated' };
    }

    const muxTokenId = process.env.MUX_TOKEN_ID?.trim();
    const muxTokenSecret = process.env.MUX_TOKEN_SECRET?.trim();
    if (!muxTokenId || !muxTokenSecret) {
      return { error: 'Mux credentials are not configured' };
    }

    const { data: post, error: postError } = await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        content_type: 'live_stream',
        access_level: accessLevel,
        text_content: title?.trim() || null,
      })
      .select()
      .single();

    if (postError || !post) {
      console.error('Error creating live stream post:', postError);
      return { error: 'Failed to create live stream post' };
    }

    const cleanupPost = async () => {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', post.id)
        .eq('user_id', user.id);
      if (error) console.error('Error cleaning up failed live stream post:', error);
    };

    const response = await fetch('https://api.mux.com/video/v1/live-streams', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${muxTokenId}:${muxTokenSecret}`).toString('base64')}`
      },
      body: JSON.stringify({
        playback_policies: [accessLevel === 'ppv' ? 'signed' : 'public'],
        new_asset_settings: {
          playback_policies: [accessLevel === 'ppv' ? 'signed' : 'public'],
        },
        passthrough: post.id
      })
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('Mux API error:', response.status, body);
      await cleanupPost();

      if (response.status === 401 || response.status === 403) {
        return { error: 'Mux credentials are invalid or missing video write access' };
      }

      const details = process.env.NODE_ENV === 'development' && body
        ? `: ${body.slice(0, 180)}`
        : '';
      return { error: `Mux rejected live stream creation (${response.status})${details}` };
    }

    const muxData = await response.json();
    const muxStream = muxData?.data;
    const playbackId = muxStream?.playback_ids?.[0]?.id;

    if (!muxStream?.id || !muxStream?.stream_key || !playbackId) {
      console.error('Mux live stream response missing required data:', muxData);
      await cleanupPost();
      return { error: 'Mux did not return complete stream data' };
    }

    const { error: mediaError } = await supabase
      .from('post_media')
      .insert({
        post_id: post.id,
        user_id: user.id,
        media_type: 'live_stream',
        mux_stream_key: muxStream.stream_key,
        mux_playback_id: playbackId,
        metadata: {
          status: 'idle',
          mux_stream_id: muxStream.id,
          rtmp_url: muxStream.rtmp_url
        }
      });

    if (mediaError) {
      console.error('Error storing Mux stream data:', mediaError);
      await cleanupPost();
      return { error: 'Failed to store stream data' };
    }

    revalidatePath('/home');
    return { postId: post.id };
  } catch (error) {
    console.error('Live stream creation error:', error);
    return { error: 'An unexpected error occurred' };
  }
}

async function _getBroadcastStreamData(postId: string): Promise<
  | { data: { streamId: string; streamKey: string; playbackId: string } }
  | { error: string }
> {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { error: 'Not authenticated' };
    }

    const admin = createServiceRoleClient();
    const { data: media, error: mediaError } = await admin
      .from('post_media')
      .select('mux_playback_id, mux_stream_key, metadata')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .single();

    if (mediaError || !media?.mux_playback_id || !media.mux_stream_key) {
      return { error: 'Stream data not found' };
    }

    return {
      data: {
        streamId: (media.metadata as { mux_stream_id?: string } | null)?.mux_stream_id ?? '',
        streamKey: media.mux_stream_key,
        playbackId: media.mux_playback_id,
      },
    };
  } catch (error) {
    console.error('getBroadcastStreamData error:', error);
    return { error: 'Failed to load stream data' };
  }
}
*/
