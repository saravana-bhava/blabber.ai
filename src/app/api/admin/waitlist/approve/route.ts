import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import {
  getResend,
  getResendFromAddress,
  sendResendReactEmail,
} from '@/lib/email/resend';
import BetaWaitlistApprovedEmail from '@/emails/beta-waitlist-approved';

export const runtime = 'nodejs';

type ApproveResult = {
  id: string;
  email: string;
  emailed: boolean;
  error?: string;
};

function getDiscordInviteUrl(): string {
  return (
    process.env.BETA_DISCORD_INVITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_BETA_DISCORD_INVITE_URL?.trim() ||
    'https://discord.gg/your-invite'
  );
}

function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '') ||
    'https://blabber.ai'
  );
}

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

    const { data: entries, error: fetchError } = await supabase
      .from('beta_signup_emails')
      .select('id, email, instagram_handle')
      .in('id', ids);

    if (fetchError) {
      console.error('admin/waitlist/approve fetch:', fetchError);
      return NextResponse.json(
        { error: 'Failed to load waitlist entries' },
        { status: 500 }
      );
    }
    if (!entries || entries.length === 0) {
      return NextResponse.json(
        { error: 'Waitlist entries not found' },
        { status: 404 }
      );
    }

    const siteUrl = getSiteUrl();
    const signInUrl = `${siteUrl.replace(/\/+$/, '')}/sign-in`;
    const discordInviteUrl = getDiscordInviteUrl();
    const resend = getResend();

    if (!resend) {
      console.error(
        'admin/waitlist/approve: RESEND_API_KEY is not configured; will mark approved but skip emails'
      );
    }

    const results: ApproveResult[] = [];

    for (const entry of entries) {
      const recipientName = entry.instagram_handle?.trim() || null;
      let emailed = false;
      let emailError: string | undefined;

      if (resend) {
        try {
          const result = await sendResendReactEmail({
            to: entry.email,
            subject: "You're in — welcome to the Blabber AI beta",
            react: BetaWaitlistApprovedEmail({
              recipientName,
              discordInviteUrl,
              signInUrl,
              siteUrl,
            }),
          });
          if (result.ok) {
            emailed = true;
          } else {
            emailError = result.error;
            console.error('admin/waitlist/approve send failed:', {
              id: entry.id,
              email: entry.email,
              error: result.error,
              from: getResendFromAddress(),
            });
          }
        } catch (err) {
          emailError = err instanceof Error ? err.message : String(err);
          console.error('admin/waitlist/approve send threw:', err);
        }
      } else {
        emailError = 'RESEND_API_KEY not configured';
      }

      const nowIso = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('beta_signup_emails')
        .update({
          status: 'approved',
          reviewed_at: nowIso,
          reviewed_by: session.user.id,
          approved_email_sent_at: emailed ? nowIso : null,
        })
        .eq('id', entry.id);

      if (updateError) {
        console.error('admin/waitlist/approve update:', updateError);
        results.push({
          id: entry.id,
          email: entry.email,
          emailed,
          error: updateError.message,
        });
        continue;
      }

      results.push({
        id: entry.id,
        email: entry.email,
        emailed,
        ...(emailError ? { error: emailError } : {}),
      });
    }

    const approvedCount = results.filter((r) => !r.error).length;
    const emailedCount = results.filter((r) => r.emailed).length;

    return NextResponse.json({
      ok: true,
      approved: approvedCount,
      emailed: emailedCount,
      results,
    });
  } catch (e) {
    console.error('admin/waitlist/approve:', e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
