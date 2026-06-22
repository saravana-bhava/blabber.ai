import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('isAdmin')
      .eq('id', session.user.id)
      .single();

    if (!profile?.isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => null)) as
      | { ids?: unknown }
      | null;
    const rawIds = Array.isArray(body?.ids) ? body!.ids : [];
    const ids = rawIds.filter(
      (v): v is string => typeof v === 'string' && v.length > 0
    );

    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'No waitlist entries provided' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('beta_signup_emails')
      .update({
        status: 'archived',
        reviewed_at: new Date().toISOString(),
        reviewed_by: session.user.id,
      })
      .in('id', ids)
      .select('id');

    if (error) {
      console.error('admin/waitlist/archive update:', error);
      return NextResponse.json(
        { error: 'Failed to archive waitlist entries' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, archived: data?.length ?? 0 });
  } catch (e) {
    console.error('admin/waitlist/archive:', e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
