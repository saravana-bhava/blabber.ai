/** Mux Image API poster for feed placeholders (no HLS). */
export function muxThumbnailUrl(
  playbackId: string,
  options?: { time?: number; width?: number }
): string {
  const time = options?.time ?? 1;
  const width = options?.width ?? 800;
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${time}&width=${width}&fit_mode=smartcrop`;
}
