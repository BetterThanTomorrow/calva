/**
 * Base64 image data URL detection for text output destinations.
 * Starts from the Backseat Driver `reduce-images` pattern, with the image subtype restricted to
 * MIME token characters so a match cannot run across prose to a later `;base64,`.
 * Free of VS Code dependencies.
 */

import { isWebviewOutputDestination } from './output-destinations';

const IMAGE_DATA_URL_RE = /data:(image\/[A-Za-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)/g;
const BASE64_CHAR_RE = /[A-Za-z0-9+/]/;
const WRAP_WIDTHS = [64, 76];

type ImageDataUrl = { start: number; end: number; mime: string; base64: string };

function lineBreakLength(text: string, i: number): number {
  if (text[i] === '\n') {
    return 1;
  }
  return text[i] === '\r' && text[i + 1] === '\n' ? 2 : 0;
}

/**
 * Length of the line break at `i` when it wraps base64, otherwise 0. `width` is the wrap width
 * set by the first wrapped line, if any.
 */
function wrapBreakLength(
  text: string,
  i: number,
  lineLength: number,
  width: number | undefined
): number {
  const breakLength = lineBreakLength(text, i);
  const fullLine = width === undefined ? WRAP_WIDTHS.includes(lineLength) : lineLength === width;
  return fullLine && BASE64_CHAR_RE.test(text[i + breakLength] ?? '') ? breakLength : 0;
}

/**
 * Index where the base64 payload starting at `start` ends: right after `=` padding, or at the
 * first character outside the base64 alphabet. A line break continues the payload when it wraps
 * base64: the line before it is 64 or 76 characters (later lines the same width as the first)
 * and more base64 follows.
 */
export function base64PayloadEnd(text: string, start: number): number {
  let i = start;
  let lineStart = start;
  let width: number | undefined;
  while (i < text.length) {
    if (BASE64_CHAR_RE.test(text[i])) {
      i += 1;
      continue;
    }
    if (text[i] === '=') {
      return text[i + 1] === '=' ? i + 2 : i + 1;
    }
    const lineLength = i - lineStart;
    const breakLength = wrapBreakLength(text, i, lineLength, width);
    if (breakLength === 0) {
      return i;
    }
    width = lineLength;
    i += breakLength;
    lineStart = i;
  }
  return i;
}

/**
 * Finds base64 image data URLs in `text`. `IMAGE_DATA_URL_RE` finds where each one
 * starts; `base64PayloadEnd` decides where it ends, and the search resumes there.
 */
function findImageDataUrls(text: string): ImageDataUrl[] {
  const re = new RegExp(IMAGE_DATA_URL_RE.source, 'g');
  const found: ImageDataUrl[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const mime = match[1];
    const payloadStart = match.index + `data:${mime};base64,`.length;
    const end = base64PayloadEnd(text, payloadStart);
    re.lastIndex = end;
    if (end > payloadStart) {
      found.push({ start: match.index, end, mime, base64: text.slice(payloadStart, end) });
    }
  }
  return found;
}

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
 * numbered from 1 per call.
 */
export function replaceImageDataUrls(text: string): string {
  if (!text.includes('data:image/')) {
    return text;
  }
  let result = '';
  let rest = 0;
  findImageDataUrls(text).forEach(({ start, end, mime, base64 }, i) => {
    const subtype = mime.slice('image/'.length);
    const size = formatByteSize(decodedByteCount(base64));
    result += `${text.slice(rest, start)}<<image-${i + 1} ${subtype} ${size}>>`;
    rest = end;
  });
  return result + text.slice(rest);
}

/**
 * Webview destinations get the message as is. Text destinations get image data URLs as
 * placeholders when `imagesEnabled` is true, and the message as is otherwise.
 */
export function messageForDestination(
  destination: string,
  message: string,
  imagesEnabled: boolean
): string {
  return imagesEnabled && !isWebviewOutputDestination(destination)
    ? replaceImageDataUrls(message)
    : message;
}
