/**
 * Client-side helper: call the Comfy proxy and return a File + data URL + dimensions.
 */
export async function requestGeneratedImageFromApi(
  prompt: string,
  signal: AbortSignal,
  options?: { skipSourceImage?: boolean }
): Promise<{ file: File; previewUrl: string; width: number; height: number }> {
  const payload: { prompt: string; skipSourceImage?: boolean } = { prompt };
  if (options?.skipSourceImage) {
    payload.skipSourceImage = true;
  }
  const res = await fetch('/api/image-gen/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Generation failed');
  }
  if (!data.imageBase64 || typeof data.imageBase64 !== 'string') {
    throw new Error('Invalid response from image service');
  }

  const mime = typeof data.mimeType === 'string' ? data.mimeType : 'image/png';
  const binary = atob(data.imageBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  const file = new File([blob], `ai-generated-${Date.now()}.png`, { type: mime });

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const img = new window.Image();
      img.onload = () => {
        resolve({
          file,
          previewUrl: dataUrl,
          width: img.width,
          height: img.height,
        });
      };
      img.onerror = () => reject(new Error('Could not read generated image'));
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(blob);
  });
}
