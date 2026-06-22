// LIVESTREAM DISABLED

import { NextRequest, NextResponse } from 'next/server';

export async function POST(_req: NextRequest) {
  return NextResponse.json({ error: 'Live streaming is currently unavailable' }, { status: 503 });
}

/*
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

const muxAuth = () =>
  'Basic ' + Buffer.from(`${process.env.MUX_TOKEN_ID}:${process.env.MUX_TOKEN_SECRET}`).toString('base64');

async function _POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { mux_playback_id, post_id, mux_stream_id } = await req.json();
    if (!mux_playback_id && !post_id) {
      return NextResponse.json({ error: 'mux_playback_id or post_id required' }, { status: 400 });
    }

    const admin = createServiceRoleClient();
    const { data: mediaRow, error: mediaError } = await (
      mux_playback_id
        ? admin.from('post_media').select('user_id, metadata').eq('mux_playback_id', mux_playback_id).single()
        : admin.from('post_media').select('user_id, metadata').eq('post_id', post_id).single()
    );

    if (mediaError || !mediaRow) {
      return NextResponse.json({ error: 'Stream not found' }, { status: 404 });
    }
    if (mediaRow.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (mux_stream_id) {
      await fetch(`https://api.mux.com/video/v1/live-streams/${mux_stream_id}/complete`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: muxAuth() },
      }).catch(err => console.error('end-stream: Mux complete error:', err));

      await fetch(`https://api.mux.com/video/v1/live-streams/${mux_stream_id}/disable`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: muxAuth() },
      }).catch(err => console.error('end-stream: Mux disable error:', err));
    }

    const existingMeta = (mediaRow.metadata as Record<string, unknown>) ?? {};
    const updateObj = {
      metadata: { ...existingMeta, status: 'ended', disconnected_at: new Date().toISOString() },
    };

    const { error: updateError } = await (
      mux_playback_id
        ? admin.from('post_media').update(updateObj).eq('mux_playback_id', mux_playback_id)
        : admin.from('post_media').update(updateObj).eq('post_id', post_id)
    );

    if (updateError) {
      console.error('end-stream: DB update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('end-stream: unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
*/
