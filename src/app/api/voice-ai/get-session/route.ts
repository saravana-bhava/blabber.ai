import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimited = await checkRateLimit(user.id, 'ai_call_session');
    if (rateLimited) return rateLimited;

    const body = await request.json();
    const baseUrl = process.env.NEXT_PUBLIC_VOICE_AI_BASE_URL;

    if (!baseUrl) {
      return NextResponse.json({ error: 'Voice AI base URL not configured' }, { status: 500 });
    }

    const response = await fetch(`${baseUrl}/getSession`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Voice AI API error:', response.status, errorText);
      return NextResponse.json({ error: 'Failed to initialize call session' }, { status: response.status });
    }

    const sessionId = await response.text();
    return NextResponse.json({ sessionId }, { status: 200 });
  } catch (error) {
    console.error('Error proxying getSession request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
