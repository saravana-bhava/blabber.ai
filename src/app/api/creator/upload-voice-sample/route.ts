import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { voiceSampleFileExt } from '@/lib/voice-sample-upload';

const MAX_BYTES = 4 * 1024 * 1024;

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
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

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Expected multipart form data' },
        { status: 400 }
      );
    }

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        {
          error:
            'File too large for relayed upload (max 4MB). Use a shorter recording or upload from a network that allows direct access to storage.',
        },
        { status: 413 }
      );
    }

    if (file.size < 100) {
      return NextResponse.json({ error: 'File too small' }, { status: 400 });
    }

    const ext = voiceSampleFileExt(
      file,
      file instanceof File ? file.name : undefined
    );
    const filePath = `voice-samples/${session.user.id}-${Date.now()}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const mime = file.type?.split(';')[0]?.trim() || 'application/octet-stream';

    const { error: uploadError } = await supabase.storage
      .from('creator-content')
      .upload(filePath, buffer, {
        contentType: mime,
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('upload-voice-sample relay:', uploadError);
      return NextResponse.json(
        { error: uploadError.message || 'Storage upload failed' },
        { status: 502 }
      );
    }

    return NextResponse.json({ filePath });
  } catch (e) {
    console.error('upload-voice-sample:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
