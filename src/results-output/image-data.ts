/**
 * Base64 image data URL detection for text output destinations.
 * Same pattern as Backseat Driver `reduce-images`, so both tools agree on what counts as an image.
 * Free of VS Code dependencies.
 */

const IMAGE_DATA_URL_RE = /data:(image\/[^;]+);base64,([A-Za-z0-9+/=\s]+)/g;

export function decodedByteCount(base64: string): number {
  const compact = base64.replace(/\s/g, '');
  const padding = compact.endsWith('==') ? 2 : compact.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((compact.length * 3) / 4) - padding);
}

export function formatByteSize(bytes: number): string {
  if (bytes < 1000) {
    return `${bytes} B`;
  }
  const kB = Math.round(bytes / 1000);
  if (kB < 1000) {
    return `${kB} kB`;
  }
  return `${Math.round(bytes / 1_000_000)} MB`;
}

/**
 * Replaces each base64 image data URL in `text` with `<<image-N TYPE SIZE>>`,
 * numbered from 1 per call. Whitespace trailing a match is kept after the placeholder.
 */
export function replaceImageDataUrls(text: string): string {
  if (!text.includes('data:image/')) {
    return text;
  }
  let n = 0;
  return text.replace(IMAGE_DATA_URL_RE, (_match, mime: string, base64: string) => {
    n += 1;
    const subtype = mime.slice('image/'.length);
    const size = formatByteSize(decodedByteCount(base64));
    const trailingWhitespace = base64.match(/\s*$/)[0];
    return `<<image-${n} ${subtype} ${size}>>${trailingWhitespace}`;
  });
}
