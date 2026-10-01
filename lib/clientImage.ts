/** Browser-side: shrink big (e.g. Retina) screenshots before upload so they stay well under the 4 MB request limit. */
export async function prepareImage(file: Blob, maxWidth = 1400): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bmp.width);
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  const png: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  if (png && png.size <= 3.5 * 1024 * 1024) return png;
  const jpg: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.88));
  if (!jpg) throw new Error('Could not process the image');
  return jpg;
}
