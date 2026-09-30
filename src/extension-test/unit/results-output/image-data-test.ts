import * as expectLib from 'expect';
import * as imageData from '../../../results-output/image-data';

const expect = expectLib.expect;

// 8 base64 chars, no padding -> 6 bytes
const PNG_6_BYTES = 'data:image/png;base64,iVBORw0K';

describe('image-data', () => {
  describe('decodedByteCount', () => {
    it('counts 3 bytes per 4 base64 chars', () => {
      expect(imageData.decodedByteCount('AAAAAAAA')).toBe(6);
    });
    it('subtracts one byte for = padding', () => {
      expect(imageData.decodedByteCount('AAAAAAA=')).toBe(5);
    });
    it('subtracts two bytes for == padding', () => {
      expect(imageData.decodedByteCount('AAAAAA==')).toBe(4);
    });
    it('ignores whitespace and newlines', () => {
      expect(imageData.decodedByteCount('AAAA\n AA\tAA\r\n')).toBe(6);
    });
  });

  describe('formatByteSize', () => {
    it('uses B below 1000 bytes', () => {
      expect(imageData.formatByteSize(0)).toBe('0 B');
      expect(imageData.formatByteSize(999)).toBe('999 B');
    });
    it('uses rounded kB from 1000 bytes', () => {
      expect(imageData.formatByteSize(1000)).toBe('1 kB');
      expect(imageData.formatByteSize(12_345)).toBe('12 kB');
      expect(imageData.formatByteSize(12_500)).toBe('13 kB');
    });
    it('uses rounded MB when kB rounds to 1000 or more', () => {
      expect(imageData.formatByteSize(999_499)).toBe('999 kB');
      expect(imageData.formatByteSize(999_500)).toBe('1 MB');
      expect(imageData.formatByteSize(2_600_000)).toBe('3 MB');
    });
  });

  describe('replaceImageDataUrls', () => {
    it('returns the text untouched when there is no image data URL', () => {
      const text = '{:a 1 :b "data:text/plain;base64,SGVsbG8="}';
      expect(imageData.replaceImageDataUrls(text)).toBe(text);
    });
    it('replaces one png data URL and keeps surrounding text', () => {
      expect(imageData.replaceImageDataUrls(`before ${PNG_6_BYTES}`)).toBe(
        'before <<image-1 png 6 B>>'
      );
    });
    it('keeps the quotes of a Clojure string literal', () => {
      expect(imageData.replaceImageDataUrls(`{:img "${PNG_6_BYTES}"}`)).toBe(
        '{:img "<<image-1 png 6 B>>"}'
      );
    });
    it('numbers several images from 1 in order', () => {
      const text = `["${PNG_6_BYTES}" "data:image/jpeg;base64,AAAA" "data:image/gif;base64,AA=="]`;
      expect(imageData.replaceImageDataUrls(text)).toBe(
        '["<<image-1 png 6 B>>" "<<image-2 jpeg 3 B>>" "<<image-3 gif 1 B>>"]'
      );
    });
    it('restarts numbering on each call', () => {
      imageData.replaceImageDataUrls(PNG_6_BYTES);
      expect(imageData.replaceImageDataUrls(PNG_6_BYTES)).toBe('<<image-1 png 6 B>>');
    });
    it('keeps the full mime subtype', () => {
      expect(imageData.replaceImageDataUrls('"data:image/svg+xml;base64,AAAA"')).toBe(
        '"<<image-1 svg+xml 3 B>>"'
      );
    });
    it('ignores whitespace inside the base64 for the size', () => {
      expect(imageData.replaceImageDataUrls('"data:image/png;base64,AAAA\nAAAA"')).toBe(
        '"<<image-1 png 6 B>>"'
      );
    });
    it('keeps whitespace trailing the base64 after the placeholder', () => {
      expect(imageData.replaceImageDataUrls(`${PNG_6_BYTES}\n`)).toBe('<<image-1 png 6 B>>\n');
    });
    it('leaves non-image data URLs untouched next to an image', () => {
      const text = `"data:application/pdf;base64,AAAA" "${PNG_6_BYTES}"`;
      expect(imageData.replaceImageDataUrls(text)).toBe(
        '"data:application/pdf;base64,AAAA" "<<image-1 png 6 B>>"'
      );
    });
    it('reports the size of a larger image in kB', () => {
      const base64 = 'A'.repeat(16_000);
      expect(imageData.replaceImageDataUrls(`"data:image/png;base64,${base64}"`)).toBe(
        '"<<image-1 png 12 kB>>"'
      );
    });
  });
});
