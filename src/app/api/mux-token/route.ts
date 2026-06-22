// LIVESTREAM DISABLED

import { NextRequest, NextResponse } from 'next/server';

export async function POST(_request: NextRequest) {
  return NextResponse.json({ error: 'Live streaming is currently unavailable' }, { status: 503 });
}

/*
import { cookies } from 'next/headers';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import jwt from 'jsonwebtoken';

const TOKEN_EXPIRY = '12h';

async function _POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { postId } = await request.json();
    if (!postId) {
      return NextResponse.json({ error: 'postId required' }, { status: 400 });
    }

    const admin = createServiceRoleClient();

    const [{ data: post, error: postErr }, { data: media, error: mediaErr }] =
      await Promise.all([
        admin
          .from('posts')
          .select('id, user_id, access_level')
          .eq('id', postId)
          .single(),
        admin
          .from('post_media')
          .select('mux_playback_id')
          .eq('post_id', postId)
          .eq('media_type', 'live_stream')
          .single(),
      ]);

    if (postErr || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }
    if (mediaErr || !media?.mux_playback_id) {
      return NextResponse.json({ error: 'Stream not found' }, { status: 404 });
    }

    if (post.user_id !== user.id) {
      if (post.access_level === 'ppv') {
        const { data: tx } = await admin
          .from('ppv_transactions')
          .select('id')
          .eq('user_id', user.id)
          .eq('post_id', postId)
          .eq('status', 'succeeded')
          .maybeSingle();
        if (!tx) {
          return NextResponse.json({ error: 'PPV purchase required' }, { status: 403 });
        }
      } else if (post.access_level === 'subscribers_only') {
        const { data: sub } = await admin
          .from('subscriptions')
          .select('id')
          .eq('follower_id', user.id)
          .eq('following_id', post.user_id)
          .eq('status', 'active')
          .maybeSingle();
        if (!sub) {
          return NextResponse.json({ error: 'Subscription required' }, { status: 403 });
        }
      }
    }

    const signingKeyId = process.env.MUX_SIGNING_KEY_ID;
    const signingKey = process.env.MUX_SIGNING_PRIVATE_KEY;
    if (!signingKeyId || !signingKey) {
      console.error('mux-token: MUX_SIGNING_KEY_ID or MUX_SIGNING_PRIVATE_KEY not set');
      return NextResponse.json(
        { error: 'Signing credentials not configured' },
        { status: 500 },
      );
    }

    const privateKey = Buffer.from(signingKey, 'base64');
    const token = jwt.sign(
      { sub: media.mux_playback_id, aud: 'v' },
      privateKey,
      {
        algorithm: 'RS256',
        expiresIn: TOKEN_EXPIRY,
        keyid: signingKeyId,
      },
    );

    return NextResponse.json({ token });
  } catch (err) {
    console.error('mux-token: unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
*/
