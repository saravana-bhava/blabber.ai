'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers'; // Import cookies
import { v4 as uuidv4 } from 'uuid';
// import MuxNode from '@mux/mux-node'; // Old import
import Mux from '@mux/mux-node'; // New import for v8+
import { type Post, type CommentType } from '@/lib/types'; // Ensure Post type is imported, ADD CommentType
import sharp from 'sharp';
import { createSubscriberNewPostNotification } from '@/app/actions/notificationActions';

// Define the types based on your SQL schema
// These might differ slightly from src/lib/types.ts if that file is more client-view oriented
interface PostInsert {
  user_id: string;
  text_content?: string | null;
  content_type: 'text_only' | 'image' | 'video' | 'carousel' | 'poll' | 'quiz' | 'live_stream' | 'short';
  access_level: 'public' | 'subscribers_only' | 'ppv';
  metadata?: any; // Added for POLL/QUIZ metadata
  ppv_price_cents?: number | null;
  // Add other fields from your 'posts' table that need to be set on creation
  // e.g., tags, category etc. if they are not defaulted or nullable
}

interface PostMediaInsert {
  post_id: string;
  media_type: 'image' | 'video' | 'short';
  storage_path?: string | null; // Nullable for Mux videos
  order_index: number;
  user_id: string; 
  mux_upload_id?: string | null; // To store the Mux Upload ID initially
  blurred_storage_path?: string | null; // Added for blurred version
  width?: number;
  height?: number;
}

// Define a type for the plain post data we intend to return
interface PlainPostData {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  content_type: PostInsert['content_type'];
  text_content?: string | null;
  access_level: PostInsert['access_level'];
  // Add other relevant fields from your posts table that you might want to return
  // e.g., like_count: number, view_count: number etc. (ensure they are serializable)
}

// Initialize Mux Video client
// Ensure MUX_TOKEN_ID and MUX_TOKEN_SECRET are in your .env.local
let muxClient: Mux;
if (process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET) {
  // Configuration for Mux SDK v8+
  muxClient = new Mux({
    tokenId: process.env.MUX_TOKEN_ID, // or MUX_ACCESS_TOKEN_ID
    tokenSecret: process.env.MUX_TOKEN_SECRET, // or MUX_SECRET_KEY
    // The property names might be MUX_ACCESS_TOKEN_ID and MUX_SECRET_KEY depending on Mux dashboard
    // or just accessToken and secretKey if preferred.
    // For v11, it's often just new Mux(process.env.MUX_TOKEN_ID, process.env.MUX_TOKEN_SECRET)
    // or new Mux({ tokenId: ..., tokenSecret: ... })
  });
} else {
  console.error('MUX_TOKEN_ID or MUX_TOKEN_SECRET is not set in environment variables. Mux client not initialized.');
  // Optionally, throw an error or handle this state appropriately
  // For now, operations requiring muxClient will fail if it's not initialized.
}

interface CreateMuxUploadUrlResponse {
  upload_url: string;
  upload_id: string;
  passthrough?: string; // To echo back any passthrough ID we set
}

async function generateBlurredVideoThumbnail(muxPlaybackId: string, supabase: any, user: any): Promise<string | null> {
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

    // Upload the blurred thumbnail
    const fileName = `${user.id}/${uuidv4()}_video_blurred.jpg`;
    const filePath = `public/post_media/${fileName}`;

    const { error: uploadError } = await supabase.storage
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

export async function createPost(formData: FormData) {
  const parseDateToString = (dateValue: any): string => {
    if (!dateValue) {
      // Consider how to handle missing dates. Epoch 0 or a specific "unknown" string.
      // Or, if a date is absolutely expected, this could be an error condition.
      console.warn('parseDateToString received null or undefined dateValue, returning epoch 0.');
      return new Date(0).toISOString(); 
    }
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) {
        console.warn(`Invalid date value received from database: ${dateValue}. Returning epoch 0.`);
        return new Date(0).toISOString(); // Fallback for "Invalid Date"
      }
      return date.toISOString();
    } catch (e) {
      console.error(`Error parsing date value '${dateValue}':`, e);
      return new Date(0).toISOString(); // Fallback in case of other errors
    }
  };

  try {
    const cookieStore = await cookies(); // Get cookie store
    const supabase = createClient(cookieStore); // Pass cookie store

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: 'User not authenticated' };
    }

    let textContentValue = formData.get('textContent') as string | null;
    if (textContentValue && textContentValue.trim() === '') {
      textContentValue = null;
    }
    // Image blobs are uploaded directly to Supabase Storage from the browser
    // before this action runs (see uploadPostImageDirect). This keeps the
    // server action payload small enough to live well under Vercel's 4.5 MB
    // function request cap regardless of how many images the user attaches.
    const muxUploadId = formData.get('muxUploadId') as string | null;
    const muxVideoDimensionsRaw = formData.get('muxVideoDimensions') as string | null;
    let muxVideoDimensions: { width?: number; height?: number } | undefined = undefined;
    if (muxVideoDimensionsRaw) {
      try {
        muxVideoDimensions = JSON.parse(muxVideoDimensionsRaw);
      } catch (e) {
        console.warn('Invalid muxVideoDimensions JSON:', muxVideoDimensionsRaw);
      }
    }
    const postContentTypeInput = formData.get('postContentType') as string | null;
    const metadataInput = formData.get('metadata') as string | null;
    const accessLevelInput = formData.get('accessLevel') as 'public' | 'subscribers_only' | 'ppv' | null;
    const ppvPriceCentsInput = formData.get('ppvPriceCents') as string | null;

    type PreparedImage = {
      storagePath: string;
      blurredStoragePath: string | null;
      fileName?: string;
      width?: number;
      height?: number;
    };
    let preparedImages: PreparedImage[] = [];
    const preparedImagesRaw = formData.get('preparedImages');
    if (preparedImagesRaw) {
      try {
        const parsed = JSON.parse(preparedImagesRaw as string);
        if (Array.isArray(parsed)) {
          preparedImages = parsed
            .filter(
              (entry): entry is PreparedImage =>
                !!entry &&
                typeof entry === 'object' &&
                typeof (entry as PreparedImage).storagePath === 'string'
            )
            // Defensive: never trust client-supplied storage paths that
            // wander outside this user's post_media prefix.
            .filter((entry) => entry.storagePath.startsWith(`public/post_media/${user.id}/`));
        }
      } catch (e) {
        console.warn('Invalid preparedImages JSON:', e);
      }
    }

    if (!textContentValue && preparedImages.length === 0 && !muxUploadId && (!postContentTypeInput || (postContentTypeInput?.toLowerCase() !== 'poll' && postContentTypeInput?.toLowerCase() !== 'quiz'))) {
      return { error: 'Post content (text, media, or poll/quiz) cannot be empty.' };
    }

    let postContentType: PostInsert['content_type'];
    let postMetadata: any = null;

    const lowercasedPostContentTypeInput = postContentTypeInput?.toLowerCase();

    if (lowercasedPostContentTypeInput === 'poll' || lowercasedPostContentTypeInput === 'quiz') {
      postContentType = lowercasedPostContentTypeInput as 'poll' | 'quiz';
      if (metadataInput) {
        try {
          postMetadata = JSON.parse(metadataInput);
        } catch (e) {
          console.error('Error parsing metadata JSON:', e);
          return { error: 'Invalid poll/quiz data format.' };
        }
      } else {
        return { error: 'Poll/quiz data is missing.' };
      }
      if (!textContentValue) {
        return { error: 'Poll/quiz question cannot be empty.' };
      }
    } else if (muxUploadId) {
      if (postContentTypeInput?.toLowerCase() === 'short') {
        postContentType = 'short';
      } else {
        postContentType = 'video';
      }
    } else if (preparedImages.length > 1) {
      postContentType = 'carousel';
    } else if (preparedImages.length === 1) {
      postContentType = 'image';
    } else {
      postContentType = 'text_only';
    }

    // Validate access level and PPV price
    if (accessLevelInput === 'ppv' && (!ppvPriceCentsInput || parseInt(ppvPriceCentsInput) <= 0)) {
      return { error: 'PPV posts must have a price greater than 0.' };
    }

    // 1. Insert into 'posts' table
    const postToInsert: PostInsert = {
      user_id: user.id,
      text_content: textContentValue,
      content_type: postContentType,
      access_level: accessLevelInput || 'public',
      ppv_price_cents: accessLevelInput === 'ppv' ? parseInt(ppvPriceCentsInput!) : null,
    };

    if (postMetadata) {
      postToInsert.metadata = postMetadata;
    }

    const { data: postData, error: postError } = await supabase
      .from('posts')
      .insert(postToInsert)
      .select()
      .single();

    if (postError) {
      console.error('Error creating post:', postError);
      return { error: `Database error: Failed to create post. ${postError.message}` };
    }

    if (!postData) {
      // Should not happen if no error, but good to check
      return { error: 'Internal error: Failed to create post (no data returned after insert).' };
    }

    const newPostId = postData.id;
    let processedMediaResults: any[] = [];

    // 2a. If Mux video upload
    if (muxUploadId && (postContentType === 'video' || postContentType === 'short')) {
      const mediaToInsert: PostMediaInsert = {
        post_id: newPostId,
        media_type: postContentType, // 'video' or 'short'
        order_index: 0, // Assuming one video for now
        user_id: user.id,
        mux_upload_id: muxUploadId,
        storage_path: null, // No Supabase storage path for Mux videos
        width: muxVideoDimensions?.width,
        height: muxVideoDimensions?.height,
      };
      const { error: mediaError } = await supabase.from('post_media').insert(mediaToInsert);
      if (mediaError) {
        console.error(`Error creating post_media entry for Mux video ${muxUploadId}:`, mediaError);
        // This is tricky: post created, Mux upload done, but DB link failed.
        // Consider cleanup or a more robust retry/flagging mechanism.
        return { error: `Post created, Mux video uploaded, but failed to link video to post: ${mediaError.message}` };
      }
      // For consistency in return type, though not all fields are relevant for Mux initial insert
      processedMediaResults.push({ mux_upload_id: muxUploadId, status: 'processing_video', success: true });
    }
    // 2b. If client uploaded images directly to storage, just link them to the post.
    else if (preparedImages.length > 0 && (postContentType === 'image' || postContentType === 'carousel')) {
      const insertPromises = preparedImages.map(async (img, index) => {
        const { data: publicUrlData } = supabase.storage
          .from('post-images')
          .getPublicUrl(img.storagePath);

        const mediaToInsert: PostMediaInsert = {
          post_id: newPostId,
          media_type: 'image',
          storage_path: img.storagePath,
          order_index: index,
          user_id: user.id,
          blurred_storage_path: img.blurredStoragePath,
          width: img.width,
          height: img.height,
        };

        const { error: mediaError } = await supabase
          .from('post_media')
          .insert(mediaToInsert);

        if (mediaError) {
          console.error(
            `Error creating post media entry for ${img.fileName || img.storagePath}:`,
            mediaError
          );
          return {
            file_name: img.fileName,
            storage_path: img.storagePath,
            status: 'db_link_failed' as const,
            error: mediaError.message,
          };
        }

        return {
          file_name: img.fileName,
          storage_path: img.storagePath,
          blurred_storage_path: img.blurredStoragePath,
          public_url: publicUrlData?.publicUrl,
          status: 'processed' as const,
          success: true,
        };
      });

      processedMediaResults = await Promise.all(insertPromises);

      const failedInserts = processedMediaResults.filter((r) => r.status !== 'processed');
      if (failedInserts.length > 0) {
        console.error('Some media items failed to link to post:', failedInserts);
        return {
          error: `Post created, but ${failedInserts.length} media item(s) failed to link: ${failedInserts[0].error}.`,
          details: failedInserts,
        };
      }

      // Defensive — keep posts.content_type in sync with the media we just linked.
      if (postData.content_type !== postContentType) {
        const { error: updateError } = await supabase
          .from('posts')
          .update({ content_type: postContentType })
          .eq('id', newPostId);
        if (updateError) {
          console.error(
            `Non-critical: Failed to update post content_type to ${postContentType}:`,
            updateError
          );
        }
      }
    }

    // Revalidate paths to show the new post
    revalidatePath('/home');
    revalidatePath('/'); // If posts are also shown on the login/root page, or for user's own profile

    // Send notifications to subscribers about the new post
    try {
      // Get the creator's username
      const { data: creatorProfile, error: profileError } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();

      if (creatorProfile?.username) {
        // Get all active subscribers for this creator
        const { data: subscribers, error: subscribersError } = await supabase
          .from('subscriptions')
          .select('follower_id')
          .eq('following_id', user.id)
          .eq('status', 'active');

        if (!subscribersError && subscribers && subscribers.length > 0) {
          // Create notifications for all subscribers
          const notificationPromises = subscribers.map(subscriber => 
            createSubscriberNewPostNotification({
              subscriberId: subscriber.follower_id,
              creatorId: user.id,
              creatorUsername: creatorProfile.username,
              postId: newPostId,
              postType: postContentType
            }).catch(error => {
              console.error('Failed to create subscriber notification:', error);
              // Don't fail the post creation if notifications fail
              return null;
            })
          );

          // Wait for all notifications to be created (but don't fail if some fail)
          await Promise.allSettled(notificationPromises);
        }
      }
    } catch (notificationError) {
      console.error('Error creating subscriber notifications:', notificationError);
      // Don't fail the post creation if notifications fail
    }

    // Ensure postData is plain and serializable
    const plainPostData: PlainPostData = {
      id: String(postData.id),
      user_id: String(postData.user_id),
      created_at: parseDateToString(postData.created_at),
      updated_at: parseDateToString(postData.updated_at),
      content_type: String(postData.content_type) as PostInsert['content_type'],
      text_content: postData.text_content ? String(postData.text_content) : null,
      access_level: String(postData.access_level) as PostInsert['access_level'],
      // Initialize other potential fields from posts table to null or default if not present
      // e.g. tags: postData.tags || null, (assuming tags is serializable or handle appropriately)
    };

    return { success: true, post: plainPostData, mediaResults: processedMediaResults.map(r => ({...r})) }; // Ensure mediaResults are also plain copies

  } catch (err: any) {
    console.error("[createPost Unhandled Exception]", err);
    let errorMessage = 'An unexpected server error occurred.';
    if (err instanceof Error) {
      errorMessage = err.message;
    } else if (typeof err === 'string') {
      errorMessage = err;
    }
    return { error: `Server Action Error: ${errorMessage}` };
  }
}

export async function createMuxDirectUploadUrl(): Promise< 
  { data: CreateMuxUploadUrlResponse } | { error: string } 
> {
  if (!muxClient) {
    console.error('Mux client not initialized. Cannot create direct upload URL.');
    return { error: 'Mux client is not configured on the server.' };
  }

  try {
    const cookieStore = await cookies(); // Get cookie store
    const supabase = createClient(cookieStore); // Pass cookie store

    // Optional: Authenticate user if needed
    // const { data: { user }, error: authError } = await supabase.auth.getUser();
    // if (authError || !user) {
    //   return { error: 'User not authenticated' };
    // }

    // Create a new Mux Direct Upload.
    // The upload.id generated here will be used as the passthrough value.
    const upload = await muxClient.video.uploads.create({
      new_asset_settings: {
        playback_policy: ['public'],
        // Set passthrough to the upload.id itself. This value isn't known until *after* creation.
        // So, we will retrieve the upload.id and then use it as the passthrough for the asset that will be created.
        // Mux documentation indicates that for Direct Uploads, the upload_id of the direct upload
        // is automatically available on the asset if the asset is created from that direct upload.
        // And the `passthrough` on `new_asset_settings` is for the *asset*.
        // Let's use a unique ID we generate now if we want to be absolutely sure, or rely on upload_id being implicitly available.
        // For maximum clarity and control, let's generate a unique ID that we will pass through.
        // However, our current DB schema uses mux_upload_id from Mux.
        // The simplest is: the `upload_id` from this response is what we store in our DB.
        // The `video.asset.ready` webhook will contain this `upload_id` in `data.upload_id`.
        // It will ALSO contain `data.passthrough` if we set it here in `new_asset_settings`.
        // To ensure our webhook logic (which checks passthrough first, then upload_id) works,
        // we should set `new_asset_settings.passthrough` to be the `upload_id`.
        // This seems circular, but it means the `asset` created from this `upload` will have its `passthrough` field set to the `upload_id`.
        // The Mux SDK should handle this: we define what the passthrough for the *eventual asset* should be.
        // Let's test setting passthrough to a known value (like the upload.id itself, if the SDK allows it conceptually here)
        // For Mux SDK v11, this is the correct place to set the passthrough for the asset.
        // The value of `upload.id` from the response of this create call will be our link.
        // So, when `video.asset.ready` fires, `event.data.passthrough` should be `upload.id`.
        // No, this is wrong. `passthrough` in `new_asset_settings` is for the ASSET that will be created.
        // We want this passthrough to be the upload.id that will be generated by THIS call.
        // This means we need to: 1. Create Upload. 2. Get upload.id. 3. *Update the Upload* to set its asset's passthrough.
        // This is what the `uploads.update(upload.id, { passthrough: upload.id })` was trying to do.
        // If `uploads.update` isn't available, we must rely on `data.upload_id` in the webhook, 
        // OR set a *pre-generated* passthrough value.

        // Let's use a pre-generated UUID for passthrough for clarity and control.
        // This UUID will be stored in our DB as `mux_upload_id`.
        // This UUID will be sent to Mux in `new_asset_settings.passthrough`.
        // The webhook will then receive this UUID in `event.data.passthrough`.

        passthrough: uuidv4(), // Generate a UUID for passthrough
      },
      cors_origin: '*', // Be more specific in production
    });

    if (upload.id && upload.url && upload.new_asset_settings?.passthrough) {
      // The `upload.id` is the Mux Direct Upload ID.
      // The `upload.new_asset_settings.passthrough` is the UUID we generated and want to store.
      return {
        data: {
          upload_url: upload.url,
          upload_id: upload.new_asset_settings.passthrough, // THIS is what we store in DB and expect in webhook passthrough
          passthrough: upload.new_asset_settings.passthrough // Echoing it back for clarity
        }
      };
    } else {
      console.error('Mux direct upload creation failed to return an ID, URL, or passthrough.', upload);
      return { error: 'Mux direct upload creation failed.' };
    }

  } catch (error: any) {
    console.error('Exception creating Mux direct upload URL', error);
    return { error: error.message || 'An unexpected error occurred creating the Mux upload URL.' };
  }
}

// Interface for poll vote results
interface PollVoteResult {
  option_id: string;
  vote_count: number;
}

export async function submitPollVote(postId: string, selectedOptionId: string): Promise<{ 
  success: boolean; 
  error?: string; 
  results?: PollVoteResult[]; 
  userVote?: string | null; // The option ID the user voted for
}> {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'User not authenticated' };
    }

    // Attempt to insert the vote
    const { error: voteError } = await supabase.from('poll_votes').insert({
      post_id: postId,
      user_id: user.id,
      selected_option_id: selectedOptionId,
    });

    if (voteError) {
      if (voteError.code === '23505') { // Unique constraint violation
      } else {
        console.error('Error submitting poll vote:', voteError);
        return { success: false, error: `Database error: ${voteError.message}` };
      }
    }

    const { data: allVotes, error: resultsError } = await supabase
      .from('poll_votes')
      .select('selected_option_id')
      .eq('post_id', postId);

    if (resultsError) {
      console.error('Error fetching poll results:', resultsError);
      return { success: false, error: `Database error: ${resultsError.message}` };
    }

    const voteCounts = allVotes.reduce((acc, vote) => {
      acc[vote.selected_option_id] = (acc[vote.selected_option_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const results: PollVoteResult[] = Object.entries(voteCounts).map(([option_id, count]) => ({
      option_id,
      vote_count: count,
    }));    

    const { data: userVoteData, error: userVoteError } = await supabase
      .from('poll_votes')
      .select('selected_option_id')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (userVoteError) {
        console.error('Error fetching user poll vote:', userVoteError);
    }

    revalidatePath('/home');
    revalidatePath('/');

    return { 
      success: true, 
      results, 
      userVote: userVoteData?.selected_option_id || null 
    };

  } catch (err: any) {
    console.error('submitPollVote Unhandled Exception:', err.message, err.stack);
    return { success: false, error: err.message || 'An unexpected server error occurred.' };
  }
}

export async function recordQuizAttempt(postId: string, selectedOptionId: string, isCorrect: boolean): Promise<{ 
  success: boolean; 
  error?: string; 
  attempt?: { selectedOptionId: string; isCorrect: boolean };
  previousAttempt?: { selectedOptionId: string; isCorrect: boolean } | null;
}> {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'User not authenticated' };
    }

    const { data: existingAttempt, error: existingAttemptError } = await supabase
      .from('quiz_attempts')
      .select('selected_option_id, is_correct')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .single();

    if (existingAttemptError && existingAttemptError.code !== 'PGRST116') { // PGRST116: no rows found
        console.error('Error checking existing quiz attempt:', existingAttemptError);
        return { success: false, error: `Database error: ${existingAttemptError.message}` };
    }

    if (existingAttempt) {
        return {
            success: true, 
            previousAttempt: { selectedOptionId: existingAttempt.selected_option_id, isCorrect: existingAttempt.is_correct },
            error: 'You have already attempted this quiz.'
        };
    }

    const { data: newAttemptData, error: attemptError } = await supabase
      .from('quiz_attempts')
      .insert({
        post_id: postId,
        user_id: user.id,
        selected_option_id: selectedOptionId,
        is_correct: isCorrect,
      })
      .select('selected_option_id, is_correct')
      .single();

    if (attemptError) {
      if (attemptError.code === '23505') { // Unique constraint violation
         return {
            success: false, 
            error: 'You have already attempted this quiz (concurrent attempt).' 
        };
      } else {
        console.error('Error recording quiz attempt:', attemptError);
        return { success: false, error: `Database error: ${attemptError.message}` };
      }
    }
    
    if (!newAttemptData) {
        return { success: false, error: 'Failed to record quiz attempt and retrieve data.' };
    }

    revalidatePath('/home');
    revalidatePath('/');

    return { 
      success: true, 
      attempt: { selectedOptionId: newAttemptData.selected_option_id, isCorrect: newAttemptData.is_correct }
    };

  } catch (err: any) {
    console.error('recordQuizAttempt Unhandled Exception:', err.message, err.stack);
    return { success: false, error: err.message || 'An unexpected server error occurred.' };
  }
}

// Server action to fetch feed posts with interaction data via RPC
const DEFAULT_POSTS_PER_PAGE = 10;

export async function getFeedPostsWithInteractions(
  offset: number,
  limit: number = DEFAULT_POSTS_PER_PAGE,
  filterByUserId?: string | null, // New optional parameter
  filterBookmarkedByUserId?: string | null, // New optional parameter
  contentType?: string | null, // Added for filtering by content type e.g. 'short'
  searchQuery?: string | null // Added for future search implementation
): Promise<{ data: Post[] | null; error: string | null; hasMore: boolean }> {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const rpcParams = {
      p_current_user_id: user?.id ?? null,
      p_offset: offset,
      p_limit: limit,
      p_filter_by_user_id: filterByUserId,
      p_filter_bookmarked_by_user_id: filterBookmarkedByUserId,
      p_content_type: contentType,
      p_search_query: searchQuery,
    };

    const { data, error: rpcError } = await supabase.rpc('get_feed_posts_with_interactions', rpcParams);

    if (rpcError) {
      console.error('Error fetching feed posts:', rpcError);
      return { data: null, error: rpcError.message, hasMore: false };
    }

    const hasMore = data ? data.length === limit : false;

    return { data, error: null, hasMore };
  } catch (error: any) {
    console.error('Unexpected error in getFeedPostsWithInteractions:', error);
    return {
      data: null,
      error: error.message || 'An unexpected server error occurred.',
      hasMore: false,
    };
  }
}

// Server action to toggle liking a post
export async function toggleLikePost(postId: string): Promise<{
  success: boolean;
  newLikeState?: boolean;
  newLikeCount?: number;
  error?: string;
}> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'User not authenticated.' };
  }

  try {
    // Check if the user has already liked the post
    const { data: existingLike, error: likeCheckError } = await supabase
      .from('user_post_interactions')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .eq('interaction_type', 'post_like')
      .maybeSingle();

    if (likeCheckError) {
      console.error('Error checking existing like:', likeCheckError);
      return { success: false, error: likeCheckError.message };
    }

    let newLikeState: boolean;
    let newLikeCount: number;

    if (existingLike) {
      // User has liked, so unlike
      const { error: deleteError } = await supabase
        .from('user_post_interactions')
        .delete()
        .match({ id: existingLike.id });

      if (deleteError) {
        console.error('Error unliking post:', deleteError);
        return { success: false, error: deleteError.message };
      }

      // Decrement like_count on posts table (RPC call to ensure atomicity)
      const { data: unlikeData, error: decrementError } = await supabase.rpc('decrement_like_count', { p_post_id: postId });
      if (decrementError) {
        console.error('Error decrementing like count:', decrementError);
        // Potentially handle inconsistency, for now return error
        return { success: false, error: decrementError.message };
      }
      newLikeState = false;
      newLikeCount = typeof unlikeData === 'number' ? unlikeData : (await supabase.from('posts').select('like_count').eq('id', postId).single()).data?.like_count || 0;

    } else {
      // User has not liked, so like
      const { error: insertError } = await supabase
        .from('user_post_interactions')
        .insert({
          post_id: postId,
          user_id: user.id,
          interaction_type: 'post_like'
        });

      if (insertError) {
        console.error('Error liking post:', insertError);
        return { success: false, error: insertError.message };
      }

      // Increment like_count on posts table (RPC call to ensure atomicity)
      const { data: likeData, error: incrementError } = await supabase.rpc('increment_like_count', { p_post_id: postId });
       if (incrementError) {
        console.error('Error incrementing like count:', incrementError);
        // Potentially handle inconsistency, for now return error
        return { success: false, error: incrementError.message };
      }
      newLikeState = true;
      newLikeCount = typeof likeData === 'number' ? likeData : (await supabase.from('posts').select('like_count').eq('id', postId).single()).data?.like_count || 0;
    }

    revalidatePath('/'); // Revalidate feed
    // Potentially revalidate other paths like user profiles or post detail pages
    // e.g., revalidatePath('/u/[username]'); revalidatePath('/post/[postId]') but with actual params

    return { success: true, newLikeState, newLikeCount };

  } catch (err: any) {
    console.error('[toggleLikePost Unhandled Exception]', err);
    return { success: false, error: err.message || 'An unexpected server error occurred.' };
  }
}

// Server action to toggle bookmarking a post
export async function toggleBookmarkPost(postId: string): Promise<{
  success: boolean;
  newBookmarkState?: boolean;
  newBookmarkCount?: number;
  error?: string;
}> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'User not authenticated.' };
  }

  try {
    const { data: existingBookmark, error: bookmarkCheckError } = await supabase
      .from('user_post_interactions')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .eq('interaction_type', 'post_save') // 'post_save' is for bookmarks
      .maybeSingle();

    if (bookmarkCheckError) {
      console.error('Error checking existing bookmark:', bookmarkCheckError);
      return { success: false, error: bookmarkCheckError.message };
    }

    let newBookmarkState: boolean;
    let newBookmarkCount: number;

    if (existingBookmark) {
      // User has bookmarked, so unbookmark
      const { error: deleteError } = await supabase
        .from('user_post_interactions')
        .delete()
        .match({ id: existingBookmark.id });

      if (deleteError) {
        console.error('Error unbookmarking post:', deleteError);
        return { success: false, error: deleteError.message };
      }
       // Decrement bookmark_count on posts table
      const { data: unbookmarkData, error: decrementError } = await supabase.rpc('decrement_bookmark_count', { p_post_id: postId });
      if (decrementError) {
        console.error('Error decrementing bookmark count:', decrementError);
        return { success: false, error: decrementError.message };
      }
      newBookmarkState = false;
      newBookmarkCount = typeof unbookmarkData === 'number' ? unbookmarkData : (await supabase.from('posts').select('bookmark_count').eq('id', postId).single()).data?.bookmark_count || 0;

    } else {
      // User has not bookmarked, so bookmark
      const { error: insertError } = await supabase
        .from('user_post_interactions')
        .insert({
          post_id: postId,
          user_id: user.id,
          interaction_type: 'post_save' // 'post_save' is for bookmarks
        });

      if (insertError) {
        console.error('Error bookmarking post:', insertError);
        return { success: false, error: insertError.message };
      }
      // Increment bookmark_count on posts table
      const { data: bookmarkData, error: incrementError } = await supabase.rpc('increment_bookmark_count', { p_post_id: postId });
      if (incrementError) {
        console.error('Error incrementing bookmark count:', incrementError);
        return { success: false, error: incrementError.message };
      }
      newBookmarkState = true;
      newBookmarkCount = typeof bookmarkData === 'number' ? bookmarkData : (await supabase.from('posts').select('bookmark_count').eq('id', postId).single()).data?.bookmark_count || 0;
    }

    revalidatePath('/'); // Revalidate feed
    // Potentially revalidate other paths

    return { success: true, newBookmarkState, newBookmarkCount };

  } catch (err: any) {
    console.error('[toggleBookmarkPost Unhandled Exception]', err);
    return { success: false, error: err.message || 'An unexpected server error occurred.' };
  }
}

export async function fetchComments(postId: string): Promise<{
  success: boolean;
  comments?: CommentType[];
  error?: string;
}> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  try {
    // Step 1: Fetch all comments for the post
    const { data: commentsData, error: commentsError } = await supabase
      .from('comments')
      .select(`
        id,
        post_id,
        user_id,
        text_content,
        created_at,
        parent_comment_id,
        like_count,
        reply_count,
        profiles (id, username, full_name, avatar_url)
      `)
      .eq('post_id', postId)
      .is('parent_comment_id', null)
      .order('created_at', { ascending: true });

    if (commentsError) {
      console.error('Error fetching comments:', commentsError);
      return { success: false, error: commentsError.message };
    }

    if (!commentsData) {
      return { success: true, comments: [] }; // No comments found
    }

    let userCommentLikes: Set<string> = new Set();
    if (user && commentsData.length > 0) {
      // Step 2: Fetch the current user's likes for these comments
      const commentIds = commentsData.map(c => c.id);
      const { data: userInteractionsData, error: interactionsError } = await supabase
        .from('user_comment_interactions')
        .select('comment_id')
        .eq('user_id', user.id)
        .in('comment_id', commentIds)
        .eq('interaction_type', 'comment_like');

      if (interactionsError) {
        console.error('Error fetching user comment interactions:', interactionsError);
        // Proceed without like status, or return error based on preference
      } else if (userInteractionsData) {
        userInteractionsData.forEach(interaction => userCommentLikes.add(interaction.comment_id));
      }
    }

    // Step 3: Combine comment data with the user's like status
    const commentsWithLikeStatus = commentsData.map(comment => ({
      ...(comment as any), // Cast to any to handle potential type mismatch for profiles before full CommentType assembly
      user_has_liked_comment: userCommentLikes.has(comment.id)
    }));

    return { success: true, comments: commentsWithLikeStatus as unknown as CommentType[] };

  } catch (err: any) {
    console.error('[fetchComments Unhandled Exception]', err);
    return { success: false, error: err.message || 'An unexpected server error occurred.' };
  }
}

export async function addComment(
  postId: string, 
  commentText: string,
  parentCommentId?: string | null // Added optional parentCommentId
): Promise<{
  success: boolean;
  comment?: CommentType;
  error?: string;
}> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'User not authenticated.' };
  }

  if (!commentText.trim()) {
    return { success: false, error: 'Comment text cannot be empty.' };
  }

  try {
    // 1. Insert the new comment
    const commentToInsert: { 
      post_id: string; 
      user_id: string; 
      text_content: string; 
      parent_comment_id?: string | null; 
    } = {
      post_id: postId,
      user_id: user.id,
      text_content: commentText.trim(),
    };

    if (parentCommentId) {
      commentToInsert.parent_comment_id = parentCommentId;
    }

    const { data: newCommentData, error: insertError } = await supabase
      .from('comments')
      .insert(commentToInsert)
      .select(`
        id,
        post_id,
        user_id,
        text_content,
        created_at,
        parent_comment_id,
        like_count,
        reply_count,
        profiles (id, username, full_name, avatar_url)
      `)
      .single();

    if (insertError) {
      console.error('Error adding comment:', insertError);
      return { success: false, error: insertError.message };
    }

    if (!newCommentData) {
      return { success: false, error: 'Failed to add comment or retrieve it after insertion.' };
    }

    // 2. Increment post's comment_count (if it's a top-level comment)
    //    OR parent comment's reply_count (if it's a reply)
    let updatedCountForParentEntity: number | undefined;

    if (parentCommentId) {
      // This is a reply, increment reply_count on the parent comment
      const { data: updatedReplyCount, error: incrementReplyError } = await supabase.rpc('increment_reply_count', { p_parent_comment_id: parentCommentId });
      if (incrementReplyError) {
        console.error('Error incrementing reply count on parent comment:', incrementReplyError);
        // Decide if this is a critical error. For now, proceed but log.
      }
      updatedCountForParentEntity = typeof updatedReplyCount === 'number' ? updatedReplyCount : undefined;
    } else {
      // This is a top-level comment, increment comment_count on the post
      const { data: updatedCommentCount, error: incrementPostCommentError } = await supabase.rpc('increment_comment_count', { p_post_id: postId });
      if (incrementPostCommentError) {
        console.error('Error incrementing post comment count:', incrementPostCommentError);
      }
      updatedCountForParentEntity = typeof updatedCommentCount === 'number' ? updatedCommentCount : undefined;
    }

    revalidatePath('/');

    return {
      success: true,
      comment: newCommentData as unknown as CommentType,
      // newCommentCount is ambiguous here. We can return the specific count that was updated.
      // For simplicity, let's not return a generic 'newCommentCount' anymore, 
      // the client can update specific counts based on context (post total or parent reply count)
      // Or, we could return an object like { updatedPostCommentCount?: number, updatedParentReplyCount?: number }
      // For now, removing newCommentCount to avoid confusion. The client will handle optimistic updates.
    };

  } catch (err: any) {
    console.error('[addComment Unhandled Exception]', err);
    return { success: false, error: err.message || 'An unexpected server error occurred.' };
  }
}

export async function toggleCommentLike(commentId: string): Promise<{
  success: boolean;
  newLikeState?: boolean;
  newLikeCount?: number;
  error?: string;
}> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'User not authenticated.' };
  }

  try {
    const { data: existingLike, error: likeCheckError } = await supabase
      .from('user_comment_interactions')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', user.id)
      .eq('interaction_type', 'comment_like')
      .maybeSingle();

    if (likeCheckError) {
      console.error('Error checking existing comment like:', likeCheckError);
      return { success: false, error: likeCheckError.message };
    }

    let newLikeState: boolean;
    let newLikeCount: number;

    if (existingLike) {
      // User has liked, so unlike
      const { error: deleteError } = await supabase
        .from('user_comment_interactions')
        .delete()
        .match({ id: existingLike.id });

      if (deleteError) {
        console.error('Error unliking comment:', deleteError);
        return { success: false, error: deleteError.message };
      }

      const { data: unlikeData, error: decrementError } = await supabase.rpc('decrement_comment_like_count', { p_comment_id: commentId });
      if (decrementError) {
        console.error('Error decrementing comment like count:', decrementError);
        return { success: false, error: decrementError.message };
      }
      newLikeState = false;
      newLikeCount = typeof unlikeData === 'number' ? unlikeData : (await supabase.from('comments').select('like_count').eq('id', commentId).single()).data?.like_count ?? 0;
    } else {
      // User has not liked, so like
      const { error: insertError } = await supabase
        .from('user_comment_interactions')
        .insert({
          comment_id: commentId,
          user_id: user.id,
          interaction_type: 'comment_like'
        });

      if (insertError) {
        console.error('Error liking comment:', insertError);
        return { success: false, error: insertError.message };
      }

      const { data: likeData, error: incrementError } = await supabase.rpc('increment_comment_like_count', { p_comment_id: commentId });
      if (incrementError) {
        console.error('Error incrementing comment like count:', incrementError);
        return { success: false, error: incrementError.message };
      }
      newLikeState = true;
      newLikeCount = typeof likeData === 'number' ? likeData : (await supabase.from('comments').select('like_count').eq('id', commentId).single()).data?.like_count ?? 0;
    }

    // No revalidatePath needed here as comment likes don't usually affect global feed queries directly,
    // the UI will update optimistically and the counts are part of the comment item itself.
    // If comment like counts were aggregated on the post level for display in the main feed, then revalidation would be needed.

    return { success: true, newLikeState, newLikeCount };

  } catch (err: any) {
    console.error('[toggleCommentLike Unhandled Exception]', err);
    return { success: false, error: err.message || 'An unexpected server error occurred.' };
  }
}

export async function fetchCommentReplies(parentCommentId: string): Promise<{
  success: boolean;
  replies?: CommentType[];
  error?: string;
}> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  try {
    const { data: repliesData, error: repliesError } = await supabase
      .from('comments')
      .select(`
        id,
        post_id,
        user_id,
        text_content,
        created_at,
        parent_comment_id,
        like_count,
        reply_count, 
        profiles (id, username, full_name, avatar_url)
      `)
      .eq('parent_comment_id', parentCommentId)
      .order('created_at', { ascending: true });

    if (repliesError) {
      console.error('Error fetching replies:', repliesError);
      return { success: false, error: repliesError.message };
    }
    if (!repliesData) {
      return { success: true, replies: [] };
    }

    let userReplyLikes: Set<string> = new Set();
    if (user && repliesData.length > 0) {
      const replyIds = repliesData.map(r => r.id);
      const { data: userInteractionsData, error: interactionsError } = await supabase
        .from('user_comment_interactions')
        .select('comment_id')
        .eq('user_id', user.id)
        .in('comment_id', replyIds)
        .eq('interaction_type', 'comment_like');

      if (interactionsError) {
        console.error('Error fetching user interactions for replies:', interactionsError);
      } else if (userInteractionsData) {
        userInteractionsData.forEach(interaction => userReplyLikes.add(interaction.comment_id));
      }
    }

    const repliesWithLikeStatus = repliesData.map(reply => ({
      ...(reply as any),
      user_has_liked_comment: userReplyLikes.has(reply.id)
    }));

    return { success: true, replies: repliesWithLikeStatus as unknown as CommentType[] };

  } catch (err: any) {
    console.error('[fetchCommentReplies Unhandled Exception]', err);
    return { success: false, error: err.message || 'An unexpected server error occurred.' };
  }
}

export async function deletePost(postId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'User not authenticated.' };
  }

  try {
    // First verify the post belongs to the user
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', postId)
      .single();

    if (postError) {
      console.error('Error fetching post:', postError);
      return { success: false, error: 'Post not found.' };
    }

    // Allow post owner or admin to delete
    if (post.user_id !== user.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('isAdmin')
        .eq('id', user.id)
        .single();
      if (!profile?.isAdmin) {
        return { success: false, error: 'You do not have permission to delete this post.' };
      }
    }

    // Delete the post (this should cascade delete related records due to foreign key constraints)
    const { error: deleteError } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);

    if (deleteError) {
      console.error('Error deleting post:', deleteError);
      return { success: false, error: deleteError.message };
    }

    revalidatePath('/'); // Revalidate feed
    revalidatePath('/home'); // Revalidate home page
    revalidatePath(`/u/${user.id}`); // Revalidate user's profile page

    return { success: true };
  } catch (err: any) {
    console.error('[deletePost Unhandled Exception]', err);
    return { success: false, error: err.message || 'An unexpected server error occurred.' };
  }
}

export async function getExplorePostsWithInteractions(
  offset: number,
  limit: number = DEFAULT_POSTS_PER_PAGE,
  filterByUserId?: string | null,
  filterBookmarkedByUserId?: string | null,
  searchQuery?: string | null
): Promise<{ data: Post[] | null; error: string | null; hasMore: boolean }> {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const rpcParams = {
      p_current_user_id: user?.id ?? null,
      p_offset: offset,
      p_limit: limit,
      p_filter_by_user_id: filterByUserId,
      p_filter_bookmarked_by_user_id: filterBookmarkedByUserId,
      p_search_query: searchQuery,
    };

    const { data, error: rpcError } = await supabase.rpc('get_explore_posts_with_interactions', rpcParams);

    if (rpcError) {
      console.error('Error fetching explore posts:', rpcError);
      return { data: null, error: rpcError.message, hasMore: false };
    }

    const hasMore = data ? data.length === limit : false;

    return { data, error: null, hasMore };
  } catch (error: any) {
    console.error('Unexpected error in getExplorePostsWithInteractions:', error);
    return {
      data: null,
      error: error.message || 'An unexpected server error occurred.',
      hasMore: false,
    };
  }
}

// New function for shorts with engagement ordering
export async function getShortsPostsWithInteractions(
  offset: number,
  limit: number = DEFAULT_POSTS_PER_PAGE,
  filterByUserId?: string | null,
  filterBookmarkedByUserId?: string | null,
  searchQuery?: string | null
): Promise<{ data: Post[] | null; error: string | null; hasMore: boolean }> {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const rpcParams = {
      p_current_user_id: user?.id ?? null,
      p_offset: offset,
      p_limit: limit,
      p_filter_by_user_id: filterByUserId,
      p_filter_bookmarked_by_user_id: filterBookmarkedByUserId,
      p_search_query: searchQuery,
    };

    const { data, error: rpcError } = await supabase.rpc('get_shorts_posts_with_interactions', rpcParams);

    if (rpcError) {
      console.error('Error fetching shorts posts:', rpcError);
      return { data: null, error: rpcError.message, hasMore: false };
    }

    const hasMore = data ? data.length === limit : false;

    return { data, error: null, hasMore };
  } catch (error: any) {
    console.error('Unexpected error in getShortsPostsWithInteractions:', error);
    return {
      data: null,
      error: error.message || 'An unexpected server error occurred.',
      hasMore: false,
    };
  }
}

// New function for explore with engagement ordering
export async function getExplorePostsWithInteractionsEngagement(
  offset: number,
  limit: number = DEFAULT_POSTS_PER_PAGE,
  filterByUserId?: string | null,
  filterBookmarkedByUserId?: string | null,
  searchQuery?: string | null
): Promise<{ data: Post[] | null; error: string | null; hasMore: boolean }> {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const rpcParams = {
      p_current_user_id: user?.id ?? null,
      p_offset: offset,
      p_limit: limit,
      p_filter_by_user_id: filterByUserId,
      p_filter_bookmarked_by_user_id: filterBookmarkedByUserId,
      p_search_query: searchQuery,
    };

    const { data, error: rpcError } = await supabase.rpc('get_explore_posts_with_interactions_engagement', rpcParams);

    if (rpcError) {
      console.error('Error fetching explore posts with engagement:', rpcError);
      return { data: null, error: rpcError.message, hasMore: false };
    }

    const hasMore = data ? data.length === limit : false;

    return { data, error: null, hasMore };
  } catch (error: any) {
    console.error('Unexpected error in getExplorePostsWithInteractionsEngagement:', error);
    return {
      data: null,
      error: error.message || 'An unexpected server error occurred.',
      hasMore: false,
    };
  }
}

export async function searchUserProfiles(
  searchQuery: string,
  limit: number = 5
): Promise<{ data: any[] | null; error: string | null }> {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!searchQuery.trim()) {
      return { data: [], error: null };
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url, bio')
      .or(`username.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
      .neq('id', user?.id) // Exclude current user
      .limit(limit);

    if (error) {
      console.error('Error searching user profiles:', error);
      return { data: null, error: error.message };
    }

    return { data: data || [], error: null };
  } catch (error: any) {
    console.error('Unexpected error in searchUserProfiles:', error);
    return {
      data: null,
      error: error.message || 'An unexpected server error occurred.',
    };
  }
}

export async function updatePostText(postId: string, newText: string): Promise<{ success: boolean; error?: string }> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { error } = await supabase
    .from('posts')
    .update({ text_content: newText, updated_at: new Date().toISOString() })
    .eq('id', postId);
  if (error) {
    return { success: false, error: error.message };
  }
  // Optionally revalidate the post page
  revalidatePath(`/p/${postId}`);
  return { success: true };
} 