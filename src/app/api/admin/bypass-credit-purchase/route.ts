import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { assertAdminTestBypassAllowed } from '@/lib/payments/require-admin-test-bypass';

type CreditPackage = { amount: number; price_cents: number };

function parseCreditPackages(raw: string | null | undefined): CreditPackage[] {
  if (raw == null || raw === '') return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is CreditPackage =>
        !!p &&
        typeof p === 'object' &&
        Number.isInteger((p as CreditPackage).amount) &&
        Number.isInteger((p as CreditPackage).price_cents)
    );
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const denied = await assertAdminTestBypassAllowed(supabase, user.id, true);
    if (denied) return denied;

    const body = await request.json();
    const credits = Number(body.credits);
    const amountCents = Number(body.amountCents);

    if (!Number.isFinite(credits) || !Number.isFinite(amountCents)) {
      return NextResponse.json({ error: 'Invalid credits or amount' }, { status: 400 });
    }
    if (credits < 5 || !Number.isInteger(credits)) {
      return NextResponse.json({ error: 'Minimum purchase is 5 credits' }, { status: 400 });
    }
    if (amountCents <= 0 || !Number.isInteger(amountCents)) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const admin = createServiceRoleClient();
    const { data: settingsRows } = await admin
      .from('platform_settings')
      .select('key, value')
      .in('key', ['price_per_credit', 'credit_packages']);

    const priceVal = settingsRows?.find((r) => r.key === 'price_per_credit')?.value;
    const packagesVal = settingsRows?.find((r) => r.key === 'credit_packages')?.value;

    const pricePerCredit = priceVal != null ? parseInt(String(priceVal), 10) : NaN;
    if (!Number.isFinite(pricePerCredit) || pricePerCredit <= 0) {
      console.error('bypass-credit-purchase: missing price_per_credit');
      return NextResponse.json({ error: 'Credit pricing unavailable' }, { status: 500 });
    }

    const packages = parseCreditPackages(
      packagesVal != null ? String(packagesVal) : undefined
    );
    const matchesPackage = packages.some(
      (p) => p.amount === credits && p.price_cents === amountCents
    );
    const listTotalCents = credits * pricePerCredit;
    const matchesCustomListPrice = amountCents === listTotalCents;

    if (!matchesPackage && !matchesCustomListPrice) {
      return NextResponse.json({ error: 'Amount does not match current credit price' }, { status: 400 });
    }

    const ref = `admin_test_credit_${Date.now()}`;
    const { error: txErr } = await admin.from('credit_transactions').insert({
      user_id: user.id,
      amount_cents: amountCents,
      credits_purchased: credits,
      currency: 'USD',
      payment_provider: 'admin_test',
      status: 'succeeded',
      provider_transaction_reference: ref,
      provider_specific_details: { admin_test_bypass: true },
    });
    if (txErr) {
      console.error('bypass-credit-purchase insert:', txErr);
      return NextResponse.json({ error: 'Failed to record credit purchase' }, { status: 500 });
    }

    const { data: profile } = await admin.from('profiles').select('credits').eq('id', user.id).single();
    const { error: upErr } = await admin
      .from('profiles')
      .update({ credits: (profile?.credits || 0) + credits })
      .eq('id', user.id);
    if (upErr) {
      console.error('bypass-credit-purchase profile:', upErr);
      return NextResponse.json({ error: 'Failed to update credits' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('bypass-credit-purchase:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
