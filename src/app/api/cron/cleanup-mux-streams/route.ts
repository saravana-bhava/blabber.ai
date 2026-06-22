// LIVESTREAM DISABLED

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ deleted: 0, checked: 0, disabled: true });
}

/*
import { createServiceRoleClient } from '@/lib/supabase/server';

// Wait 24 hours after a stream ends before deleting it.
const CLEANUP_DELAY_MS = 24 * 60 * 60 * 1000;

// NOTE: Deleting a Mux live stream resource also deletes its associated
// recording asset. To keep recordings for on-demand playback, dissociate
// the asset before deleting the stream.
const muxAuth = () =>
  'Basic ' +
  Buffer.from(`${process.env.MUX_TOKEN_ID}:${process.env.MUX_TOKEN_SECRET}`).toString('base64');

async function _GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createServiceRoleClient();

  const { data: rows, error: fetchError } = await admin
    .from('post_media')
    .select('id, metadata')
    .eq('media_type', 'live_stream')
    .filter('metadata->>status', 'eq', 'ended');

  if (fetchError) {
    console.error('cleanup-mux-streams: fetch error:', fetchError);
    return NextResponse.json({ error: 'Failed to fetch streams' }, { status: 500 });
  }

  if (!rows?.length) {
    return NextResponse.json({ deleted: 0, checked: 0 });
  }

  const now = Date.now();

  const due = rows.filter(row => {
    const meta = row.metadata as Record<string, unknown>;
    if (meta?.mux_cleaned_up === true) return false;
    const disconnectedAt = meta?.disconnected_at as string | undefined;
    if (!disconnectedAt) return false;
    return now - new Date(disconnectedAt).getTime() >= CLEANUP_DELAY_MS;
  });

  if (!due.length) {
    return NextResponse.json({ deleted: 0, checked: rows.length });
  }

  let deleted = 0;
  for (const row of due) {
    const meta = row.metadata as Record<string, unknown>;
    const muxStreamId = meta?.mux_stream_id as string | undefined;

    if (muxStreamId) {
      const res = await fetch(
        `https://api.mux.com/video/v1/live-streams/${muxStreamId}`,
        { method: 'DELETE', headers: { Authorization: muxAuth() } }
      ).catch(err => {
        console.error(`cleanup-mux-streams: Mux delete error (${muxStreamId}):`, err);
        return null;
      });

      if (res && !res.ok && res.status !== 404) {
        console.error(`cleanup-mux-streams: Mux ${res.status} for stream ${muxStreamId}`);
        continue;
      }
    }

    const { error: updateError } = await admin
      .from('post_media')
      .update({ metadata: { ...meta, mux_cleaned_up: true } })
      .eq('id', row.id);

    if (updateError) {
      console.error(`cleanup-mux-streams: DB update error for row ${row.id}:`, updateError);
    } else {
      deleted++;
    }
  }

  return NextResponse.json({ deleted, checked: rows.length, due: due.length });
}
*/
