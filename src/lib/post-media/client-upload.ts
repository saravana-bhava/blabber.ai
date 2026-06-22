'use client';

import { v4 as uuidv4 } from 'uuid';
import type { SupabaseClient } from '@supabase/supabase-js';

const POST_IMAGE_BUCKET = 'post-images';
const POST_MEDIA_PREFIX = 'public/post_media';

/**
 * Result returned to the server action so it can insert post_media rows
 * without ever touching the original files. Mirrors the columns the action
 * previously generated server-side.
 */
export interface PreparedPostImage {
  /** Bucket-relative storage path of the original. */
  storagePath: string;
  /** Bucket-relative storage path of the canvas-blurred placeholder, if any. */
  blurredStoragePath: string | null;
  /** Original file name (used for error reporting only). */
  fileName: string;
  /** Natural dimensions if available. */
  width?: number;
  height?: number;
}

function extFromFile(file: File): string {
  const fromName = file.name.includes('.')
    ? file.name.split('.').pop()?.toLowerCase()
    : '';
  if (fromName && /^[a-z0-9]{1,8}$/.test(fromName)) return fromName;
  const fromMime = file.type.split('/')[1]?.split(';')[0]?.trim().toLowerCase();
  if (fromMime && /^[a-z0-9]{1,8}$/.test(fromMime)) return fromMime;
  return 'bin';
}

function buildOriginalPath(userId: string, file: File): string {
  return `${POST_MEDIA_PREFIX}/${userId}/${uuidv4()}.${extFromFile(file)}`;
}

function buildBlurredPath(userId: string): string {
  // Blurred placeholder is always re-encoded as JPEG.
  return `${POST_MEDIA_PREFIX}/${userId}/${uuidv4()}_blurred.jpg`;
}

/**
 * Generates an 800px-bounded, ~q50 JPEG blurred placeholder via canvas so we
 * never need to send the original image through a server action just to blur
 * it. Approximates the existing sharp-based output in postActions.ts.
 */
async function generateBlurredImageBlob(file: File): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('image decode failed'));
      el.src = url;
    });

    const maxSize = 800;
    const naturalW = img.naturalWidth || img.width;
    const naturalH = img.naturalHeight || img.height;
    if (!naturalW || !naturalH) return null;

    const scale = Math.min(maxSize / naturalW, maxSize / naturalH, 1);
    const width = Math.max(1, Math.round(naturalW * scale));
    const height = Math.max(1, Math.round(naturalH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // `filter` is supported in all current browsers; ~20px gaussian blur
    // closely matches sharp's `.blur(20)` we used to call server-side.
    ctx.filter = 'blur(20px)';
    ctx.drawImage(img, 0, 0, width, height);

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.5);
    });
  } catch (e) {
    console.warn('client blur failed:', e);
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Uploads a single post image (and optionally its blurred placeholder) directly
 * from the browser to Supabase Storage using the user's session — no Vercel
 * function in the path, so this is not subject to the 4.5 MB request body cap
 * that affects server actions.
 */
export async function uploadPostImageDirect({
  supabase,
  userId,
  file,
  width,
  height,
  needsBlurredVersion,
}: {
  supabase: SupabaseClient;
  userId: string;
  file: File;
  width?: number;
  height?: number;
  needsBlurredVersion: boolean;
}): Promise<PreparedPostImage> {
  const storagePath = buildOriginalPath(userId, file);

  const { error: uploadError } = await supabase.storage
    .from(POST_IMAGE_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type || 'application/octet-stream',
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message || `Failed to upload "${file.name}"`);
  }

  let blurredStoragePath: string | null = null;
  if (needsBlurredVersion) {
    const blurredBlob = await generateBlurredImageBlob(file);
    if (blurredBlob) {
      const blurredPath = buildBlurredPath(userId);
      const { error: blurErr } = await supabase.storage
        .from(POST_IMAGE_BUCKET)
        .upload(blurredPath, blurredBlob, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false,
        });
      if (blurErr) {
        // Blurred placeholder is best-effort — losing it just means the
        // subscribers-only thumbnail falls back to whatever the feed renders
        // when blurred_storage_path is null.
        console.warn(
          `blurred upload failed for "${file.name}":`,
          blurErr.message
        );
      } else {
        blurredStoragePath = blurredPath;
      }
    }
  }

  return {
    storagePath,
    blurredStoragePath,
    fileName: file.name,
    width,
    height,
  };
}
