import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { fetchVoiceAiGetResponse } from '@/lib/voice-ai/fetch-get-response';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitResponse = await checkRateLimit(user.id, 'get_response');
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const aiResponse = await fetchVoiceAiGetResponse(body);
    return NextResponse.json({ response: aiResponse }, { status: 200 });
  } catch (error) {
    console.error('Error proxying getResponse request:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message.includes('not configured') ? 500 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
