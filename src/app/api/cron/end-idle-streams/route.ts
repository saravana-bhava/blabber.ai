// LIVESTREAM DISABLED

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ ended: 0, checked: 0, disabled: true });
}

/*
import { createServiceRoleClient } from '@/lib/supabase/server';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

const muxAuth = () =>
  'Basic ' +
  Buffer.from(`${process.env.MUX_TOKEN_ID}:${process.env.MUX_TOKEN_SECRET}`).toString('base64');

async function signalMuxStreamEnded(muxStreamId: string) {
  await fetch(`https://api.mux.com/video/v1/live-streams/${muxStreamId}/complete`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: muxAuth() },
  }).catch(err => console.error(`end-idle-streams: Mux complete error (${muxStreamId}):`, err));

  await fetch(`https://api.mux.com/video/v1/live-streams/${muxStreamId}/disable`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: muxAuth() },
  }).catch(err => console.error(`end-idle-streams: Mux disable error (${muxStreamId}):`, err));
}

async function _GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  const now = Date.now();

  const { data: idleStreams, error: fetchError } = await admin
    .from('post_media')
    .select('id, metadata')
    .filter('metadata->>status', 'eq', 'idle');

  if (fetchError) {
    console.error('end-idle-streams: fetch error:', fetchError);
    return NextResponse.json({ error: 'Failed to fetch idle streams' }, { status: 500 });
  }

  if (!idleStreams?.length) {
    return NextResponse.json({ ended: 0, checked: 0 });
  }

  const timedOut = idleStreams.filter(row => {
    const meta = row.metadata as Record<string, unknown>;
    const idleAt = meta?.idle_at as string | undefined;
    if (!idleAt) return false;
    return now - new Date(idleAt).getTime() >= IDLE_TIMEOUT_MS;
  });

  let ended = 0;
  for (const row of timedOut) {
    const meta = row.metadata as Record<string, unknown>;
    const muxStreamId = meta?.mux_stream_id as string | undefined;

    if (muxStreamId) {
      await signalMuxStreamEnded(muxStreamId);
    }

    const { error: updateError } = await admin
      .from('post_media')
      .update({
        metadata: {
          ...meta,
          status: 'ended',
          disconnected_at: new Date().toISOString(),
        },
      })
      .eq('id', row.id);

    if (updateError) {
      console.error(`end-idle-streams: DB update error for row ${row.id}:`, updateError);
    } else {
      ended++;
    }
  }

  return NextResponse.json({ ended, checked: idleStreams.length });
}
*/
