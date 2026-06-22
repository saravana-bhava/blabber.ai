import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { deflateSync } from 'zlib';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';
import workflowTemplate from '@/lib/comfy/workflow-image-gen.json';

const WORKFLOW = workflowTemplate as Record<string, Record<string, unknown>>;

function comfyBaseUrl(): string {
  const raw = process.env.COMFY_API_BASE_URL?.trim() || '';
  return raw.replace(/\/+$/, '');
}

function comfyHeaders(): HeadersInit {
  const key = process.env.COMFY_API_KEY?.trim();
  if (!key) return {};
  return { Authorization: `Bearer ${key}` };
}

function extFromPath(path: string): string {
  const base = path.split('/').pop() || '';
  const i = base.lastIndexOf('.');
  return i >= 0 ? base.slice(i + 1).toLowerCase() : 'png';
}

function mimeFromExt(ext: string): string {
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    default:
      return 'image/png';
  }
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function pngCrc32(data: Buffer | Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function generateBlankWhitePng(width = 1024, height = 1024): Buffer {
  const channels = 3;
  const rawRow = Buffer.alloc(1 + width * channels, 0xff);
  rawRow[0] = 0;

  const rawData = Buffer.concat(Array.from({ length: height }, () => rawRow));
  const compressed = deflateSync(rawData);

  const buf = Buffer.alloc(8 + 25 + (12 + compressed.length) + 12);
  let off = 0;

  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(buf, off); off += 8;

  const writeCrc = (start: number, end: number) => {
    buf.writeUInt32BE(pngCrc32(buf.subarray(start, end)), end);
  };

  // IHDR
  buf.writeUInt32BE(13, off); off += 4;
  const ihdrTypeStart = off;
  buf.write('IHDR', off); off += 4;
  buf.writeUInt32BE(width, off); off += 4;
  buf.writeUInt32BE(height, off); off += 4;
  buf.writeUInt8(8, off++);
  buf.writeUInt8(2, off++);
  buf.writeUInt8(0, off++);
  buf.writeUInt8(0, off++);
  buf.writeUInt8(0, off++);
  writeCrc(ihdrTypeStart, off); off += 4;

  // IDAT
  buf.writeUInt32BE(compressed.length, off); off += 4;
  const idatTypeStart = off;
  buf.write('IDAT', off); off += 4;
  compressed.copy(buf, off); off += compressed.length;
  writeCrc(idatTypeStart, off); off += 4;

  // IEND
  buf.writeUInt32BE(0, off); off += 4;
  const iendTypeStart = off;
  buf.write('IEND', off); off += 4;
  writeCrc(iendTypeStart, off); off += 4;

  return buf.subarray(0, off);
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type ComfyImageRef = { filename: string; subfolder?: string; type?: string };

function pickOutputImage(outputs: Record<string, { images?: ComfyImageRef[] }>): ComfyImageRef | null {
  const preferred = outputs['9']?.images?.[0];
  if (preferred) return preferred;
  for (const nodeId of Object.keys(outputs)) {
    const imgs = outputs[nodeId]?.images;
    if (imgs?.length) return imgs[0];
  }
  return null;
}

async function getImageGenCreditCost(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'image_gen_credit_cost')
    .maybeSingle();
  const n = parseInt(data?.value ?? '10', 10);
  return Number.isFinite(n) && n >= 1 ? n : 10;
}

export async function POST(request: NextRequest) {
  const base = comfyBaseUrl();
  if (!base) {
    return NextResponse.json(
      { error: 'COMFY_API_BASE_URL is not configured on the server.' },
      { status: 500 }
    );
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError || !session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: creatorAccess, error: creatorAccessError } = await supabase
    .from('creators')
    .select('can_img_gen')
    .eq('profile_id', session.user.id)
    .maybeSingle();

  if (creatorAccessError || !creatorAccess?.can_img_gen) {
    return NextResponse.json({ error: 'Image generation is not enabled for your account.' }, { status: 403 });
  }

  const rateLimited = await checkRateLimit(session.user.id, 'image_gen');
  if (rateLimited) return rateLimited;

  let body: { prompt?: string; skipSourceImage?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const promptText = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!promptText) {
    return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
  }

  const creditCost = await getImageGenCreditCost(supabase);
  const { data: creditRow, error: creditFetchError } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', session.user.id)
    .single();
  if (creditFetchError || (creditRow?.credits ?? 0) < creditCost) {
    return NextResponse.json(
      {
        error: `Not enough credits. Image generation costs ${creditCost} credits.`,
        creditCost,
      },
      { status: 402 }
    );
  }

  const skipSource = body.skipSourceImage === true;

  let refBytes: Buffer;
  let uploadName: string;
  let uploadMime: string;

  if (skipSource) {
    refBytes = generateBlankWhitePng(1024, 1024);
    uploadName = `persona-${session.user.id.slice(0, 8)}-${Date.now()}.png`;
    uploadMime = 'image/png';
  } else {
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('image_gen_source_path')
      .eq('profile_id', session.user.id)
      .single();

    if (creatorError || !creator?.image_gen_source_path) {
      return NextResponse.json(
        { error: 'Add a reference photo in creator settings before generating images.' },
        { status: 400 }
      );
    }

    const service = createServiceRoleClient();
    const { data: sourceBlob, error: dlError } = await service.storage
      .from('creator-content')
      .download(creator.image_gen_source_path);

    if (dlError || !sourceBlob) {
      console.error('image-gen: download reference failed', dlError);
      return NextResponse.json({ error: 'Could not load your reference image from storage.' }, { status: 500 });
    }

    refBytes = Buffer.from(await sourceBlob.arrayBuffer());
    const ext = extFromPath(creator.image_gen_source_path);
    uploadName = `ref-${session.user.id.slice(0, 8)}-${Date.now()}.${ext}`;
    uploadMime = mimeFromExt(ext);
  }

  const form = new FormData();
  form.append('image', new Blob([refBytes as BlobPart], { type: uploadMime }), uploadName);

  const uploadRes = await fetch(`${base}/upload/image`, {
    method: 'POST',
    body: form,
    headers: comfyHeaders(),
  });

  if (!uploadRes.ok) {
    const t = await uploadRes.text();
    console.error('image-gen: comfy upload failed', uploadRes.status, t);
    return NextResponse.json({ error: 'ComfyUI image upload failed.' }, { status: 502 });
  }

  let uploadJson: { name?: string };
  try {
    uploadJson = await uploadRes.json();
  } catch {
    return NextResponse.json({ error: 'ComfyUI upload returned invalid JSON.' }, { status: 502 });
  }

  if (!uploadJson.name) {
    console.error('image-gen: comfy upload missing name', uploadJson);
    return NextResponse.json({ error: 'ComfyUI did not return an uploaded filename.' }, { status: 502 });
  }

  const workflow = JSON.parse(JSON.stringify(WORKFLOW)) as Record<string, Record<string, unknown>>;
  const loadNode = workflow['76']?.inputs as Record<string, unknown> | undefined;
  const textNode = workflow['75:74']?.inputs as Record<string, unknown> | undefined;
  if (!loadNode || !textNode) {
    console.error('image-gen: workflow missing nodes 76 or 75:74');
    return NextResponse.json({ error: 'Workflow template is misconfigured.' }, { status: 500 });
  }
  loadNode.image = uploadJson.name;
  textNode.text = promptText;

  const promptRes = await fetch(`${base}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...comfyHeaders() },
    body: JSON.stringify({ prompt: workflow }),
  });

  if (!promptRes.ok) {
    const t = await promptRes.text();
    console.error('image-gen: comfy /prompt failed', promptRes.status, t);
    return NextResponse.json({ error: 'ComfyUI rejected the workflow.' }, { status: 502 });
  }

  let promptJson: { prompt_id?: string; error?: unknown; node_errors?: unknown };
  try {
    promptJson = await promptRes.json();
  } catch {
    return NextResponse.json({ error: 'ComfyUI /prompt returned invalid JSON.' }, { status: 502 });
  }

  if (promptJson.error) {
    console.error('image-gen: comfy prompt error', promptJson.error, promptJson.node_errors);
    return NextResponse.json({ error: 'ComfyUI workflow error.' }, { status: 502 });
  }

  const promptId = promptJson.prompt_id;
  if (!promptId) {
    console.error('image-gen: no prompt_id', promptJson);
    return NextResponse.json({ error: 'ComfyUI did not return a job id.' }, { status: 502 });
  }

  const deadline = Date.now() + 15 * 60 * 1000;
  let jobOutputs: Record<string, { images?: ComfyImageRef[] }> | null = null;

  while (Date.now() < deadline) {
    await sleep(3000);
    const historyRes = await fetch(`${base}/history/${encodeURIComponent(promptId)}`, {
      headers: comfyHeaders(),
    });

    if (!historyRes.ok) continue;

    let historyRaw: unknown;
    try {
      historyRaw = await historyRes.json();
    } catch {
      continue;
    }

    if (!historyRaw || typeof historyRaw !== 'object') continue;
    const history = historyRaw as Record<string, { outputs?: Record<string, { images?: ComfyImageRef[] }>; status?: { error?: unknown } }>;
    const job = history[promptId];
    if (!job) continue;

    if (job.status?.error) {
      console.error('image-gen: comfy job error', job.status.error);
      return NextResponse.json({ error: 'Image generation failed on the GPU server.' }, { status: 502 });
    }

    const outs = job.outputs;
    if (outs && Object.keys(outs).length > 0) {
      jobOutputs = outs;
      break;
    }
  }

  if (!jobOutputs) {
    return NextResponse.json({ error: 'Image generation timed out.' }, { status: 504 });
  }

  const imgRef = pickOutputImage(jobOutputs);
  if (!imgRef?.filename) {
    return NextResponse.json({ error: 'No output image was produced.' }, { status: 502 });
  }

  const viewParams = new URLSearchParams({
    filename: imgRef.filename,
    type: imgRef.type || 'output',
  });
  if (imgRef.subfolder) viewParams.set('subfolder', imgRef.subfolder);

  const viewRes = await fetch(`${base}/view?${viewParams.toString()}`, {
    headers: comfyHeaders(),
  });

  if (!viewRes.ok) {
    console.error('image-gen: view fetch failed', viewRes.status);
    return NextResponse.json({ error: 'Could not download the generated image.' }, { status: 502 });
  }

  const outBuf = Buffer.from(await viewRes.arrayBuffer());
  const outMime = viewRes.headers.get('content-type') || 'image/png';

  const admin = createServiceRoleClient();
  const { data: debitData, error: debitError } = await admin.rpc(
    'debit_credits_if_sufficient',
    { p_user_id: session.user.id, p_credits: creditCost }
  );
  const debitResult = debitData as { ok: boolean; error?: string } | null;
  if (debitError || !debitResult?.ok) {
    if (debitResult?.error === 'insufficient_credits') {
      return NextResponse.json(
        { error: `Not enough credits. Image generation costs ${creditCost} credits.`, creditCost },
        { status: 402 }
      );
    }
    console.error('image-gen: credit deduction failed', debitError ?? debitResult?.error);
    return NextResponse.json({ error: 'Could not deduct credits.' }, { status: 500 });
  }

  return NextResponse.json({
    imageBase64: outBuf.toString('base64'),
    mimeType: outMime,
    creditCost,
  });
}
