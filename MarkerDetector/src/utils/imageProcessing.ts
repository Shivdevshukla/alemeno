/**
 * Image processing utilities for marker extraction and orientation correction.
 * All operations work on flat RGBA Uint8Array buffers for maximum performance.
 */

import type { MarkerDetectionData } from './markerDetection';

export interface ImageBuffer {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Bilinear sample at a float coordinate (clamps to bounds).
 */
function bilinearSample(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  fx: number,
  fy: number,
): [number, number, number, number] {
  const x0 = Math.max(0, Math.min(width - 1, Math.floor(fx)));
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(fy)));
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const dx = fx - x0;
  const dy = fy - y0;

  const i00 = (y0 * width + x0) * 4;
  const i10 = (y0 * width + x1) * 4;
  const i01 = (y1 * width + x0) * 4;
  const i11 = (y1 * width + x1) * 4;

  const r = (data[i00] * (1 - dx) * (1 - dy) + data[i10] * dx * (1 - dy) +
             data[i01] * (1 - dx) * dy + data[i11] * dx * dy);
  const g = (data[i00+1] * (1 - dx) * (1 - dy) + data[i10+1] * dx * (1 - dy) +
             data[i01+1] * (1 - dx) * dy + data[i11+1] * dx * dy);
  const b = (data[i00+2] * (1 - dx) * (1 - dy) + data[i10+2] * dx * (1 - dy) +
             data[i01+2] * (1 - dx) * dy + data[i11+2] * dx * dy);
  const a = (data[i00+3] * (1 - dx) * (1 - dy) + data[i10+3] * dx * (1 - dy) +
             data[i01+3] * (1 - dx) * dy + data[i11+3] * dx * dy);

  return [r, g, b, a];
}

/**
 * Extract and correct the marker region from the source frame.
 * - Crops tightly to the bounding rect of the detected marker
 * - Rotates to canonical orientation (corner square top-left)
 * - Scales to 300x300px output
 */
export function extractAndCorrectMarker(
  src: ImageBuffer,
  detection: MarkerDetectionData,
  outputSize = 300,
): Uint8Array {
  const { outerRect, orientation } = detection;

  // Step 1: Crop to the outer rect
  const cropW = outerRect.w;
  const cropH = outerRect.h;
  const cropData = new Uint8Array(cropW * cropH * 4);

  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      const srcX = outerRect.x + x;
      const srcY = outerRect.y + y;
      if (srcX >= 0 && srcX < src.width && srcY >= 0 && srcY < src.height) {
        const si = (srcY * src.width + srcX) * 4;
        const di = (y * cropW + x) * 4;
        cropData[di]     = (src.data as Uint8Array)[si];
        cropData[di + 1] = (src.data as Uint8Array)[si + 1];
        cropData[di + 2] = (src.data as Uint8Array)[si + 2];
        cropData[di + 3] = (src.data as Uint8Array)[si + 3];
      } else {
        const di = (y * cropW + x) * 4;
        cropData[di] = cropData[di+1] = cropData[di+2] = 255;
        cropData[di+3] = 255;
      }
    }
  }

  // Step 2: Rotate to canonical orientation
  const rotatedData = rotateCrop(cropData, cropW, cropH, orientation);
  const rotW = orientation === 90 || orientation === 270 ? cropH : cropW;
  const rotH = orientation === 90 || orientation === 270 ? cropW : cropH;

  // Step 3: Scale to outputSize x outputSize
  const output = new Uint8Array(outputSize * outputSize * 4);
  const scaleX = rotW / outputSize;
  const scaleY = rotH / outputSize;

  for (let y = 0; y < outputSize; y++) {
    for (let x = 0; x < outputSize; x++) {
      const fx = (x + 0.5) * scaleX - 0.5;
      const fy = (y + 0.5) * scaleY - 0.5;
      const [r, g, b, a] = bilinearSample(rotatedData, rotW, rotH, fx, fy);
      const di = (y * outputSize + x) * 4;
      output[di]     = Math.round(r);
      output[di + 1] = Math.round(g);
      output[di + 2] = Math.round(b);
      output[di + 3] = Math.round(a);
    }
  }

  return output;
}

/**
 * Rotate a flat RGBA buffer by a multiple of 90 degrees.
 * orientation: degrees clockwise to rotate.
 * Returns rotated buffer.
 */
export function rotateCrop(
  data: Uint8Array,
  width: number,
  height: number,
  degrees: number,
): Uint8Array {
  const norm = ((degrees % 360) + 360) % 360;
  if (norm === 0) return data;

  if (norm === 90) {
    // 90° CW: new dimensions are (height, width)
    const out = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const si = (y * width + x) * 4;
        // destination: (x, height-1-y) in new (height x width) image
        const di = (x * height + (height - 1 - y)) * 4;
        out[di]     = data[si];
        out[di + 1] = data[si + 1];
        out[di + 2] = data[si + 2];
        out[di + 3] = data[si + 3];
      }
    }
    return out;
  }

  if (norm === 180) {
    const out = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const si = (y * width + x) * 4;
        const di = ((height - 1 - y) * width + (width - 1 - x)) * 4;
        out[di]     = data[si];
        out[di + 1] = data[si + 1];
        out[di + 2] = data[si + 2];
        out[di + 3] = data[si + 3];
      }
    }
    return out;
  }

  if (norm === 270) {
    // 270° CW = 90° CCW: new dimensions are (height, width)
    const out = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const si = (y * width + x) * 4;
        // destination: (width-1-x, y) in new (height x width) image
        const di = ((width - 1 - x) * height + y) * 4;
        out[di]     = data[si];
        out[di + 1] = data[si + 1];
        out[di + 2] = data[si + 2];
        out[di + 3] = data[si + 3];
      }
    }
    return out;
  }

  return data;
}

/**
 * Encode an RGBA Uint8Array as a raw PNG-like base64 data URI.
 * Uses a simple PPM-style encoding via base64 for display in Image component.
 *
 * We can't use browser Canvas in RN, so we write a minimal PNG encoder.
 */
export function rgbaToBase64Png(
  rgba: Uint8Array,
  width: number,
  height: number,
): string {
  // Minimal PNG encoder
  const png = encodePng(rgba, width, height);
  return 'data:image/png;base64,' + uint8ToBase64(png);
}

function uint8ToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i = 0;
  for (; i < bytes.length - 2; i += 3) {
    const b0 = bytes[i], b1 = bytes[i+1], b2 = bytes[i+2];
    result += chars[b0 >> 2] + chars[((b0 & 3) << 4) | (b1 >> 4)] +
              chars[((b1 & 15) << 2) | (b2 >> 6)] + chars[b2 & 63];
  }
  if (i < bytes.length) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    result += chars[b0 >> 2] + chars[((b0 & 3) << 4) | (b1 >> 4)] +
              (i + 1 < bytes.length ? chars[(b1 & 15) << 2] : '=') + '=';
  }
  return result;
}

// ─── Minimal PNG encoder ──────────────────────────────────────────────────────

function crc32(data: Uint8Array, start = 0, length = data.length): number {
  let crc = 0xffffffff;
  const table = crc32Table;
  for (let i = start; i < start + length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const crc32Table = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function adler32(data: Uint8Array): number {
  let s1 = 1, s2 = 0;
  for (let i = 0; i < data.length; i++) {
    s1 = (s1 + data[i]) % 65521;
    s2 = (s2 + s1) % 65521;
  }
  return (s2 << 16) | s1;
}

function deflateRaw(data: Uint8Array): Uint8Array {
  // Uncompressed deflate blocks (store-only, no compression)
  const maxBlock = 65535;
  const numBlocks = Math.ceil(data.length / maxBlock) || 1;
  const out: number[] = [];
  for (let i = 0; i < numBlocks; i++) {
    const start = i * maxBlock;
    const blockData = data.slice(start, start + maxBlock);
    const len = blockData.length;
    const isLast = i === numBlocks - 1 ? 1 : 0;
    out.push(isLast); // BFINAL | BTYPE=00
    out.push(len & 0xff, (len >> 8) & 0xff);
    out.push((~len) & 0xff, ((~len) >> 8) & 0xff);
    for (let j = 0; j < len; j++) out.push(blockData[j]);
  }
  return new Uint8Array(out);
}

function zlib(data: Uint8Array): Uint8Array {
  const deflated = deflateRaw(data);
  const checksum = adler32(data);
  const result = new Uint8Array(2 + deflated.length + 4);
  result[0] = 0x78; result[1] = 0x01; // CMF, FLG (no compression)
  result.set(deflated, 2);
  const pos = 2 + deflated.length;
  result[pos]   = (checksum >> 24) & 0xff;
  result[pos+1] = (checksum >> 16) & 0xff;
  result[pos+2] = (checksum >> 8) & 0xff;
  result[pos+3] = checksum & 0xff;
  return result;
}

function writeU32BE(arr: Uint8Array, offset: number, val: number) {
  arr[offset]   = (val >> 24) & 0xff;
  arr[offset+1] = (val >> 16) & 0xff;
  arr[offset+2] = (val >> 8)  & 0xff;
  arr[offset+3] = val & 0xff;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new Uint8Array(4);
  for (let i = 0; i < 4; i++) typeBytes[i] = type.charCodeAt(i);
  const combined = new Uint8Array(typeBytes.length + data.length);
  combined.set(typeBytes);
  combined.set(data, 4);
  const crc = crc32(combined);
  const chunk = new Uint8Array(4 + 4 + data.length + 4);
  writeU32BE(chunk, 0, data.length);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  writeU32BE(chunk, 8 + data.length, crc);
  return chunk;
}

function encodePng(rgba: Uint8Array, width: number, height: number): Uint8Array {
  // PNG signature
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = new Uint8Array(13);
  writeU32BE(ihdr, 0, width);
  writeU32BE(ihdr, 4, height);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB (we'll drop alpha for simplicity)
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Image data: filter byte 0 (None) before each scanline
  const rawData = new Uint8Array(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 3)] = 0; // filter=None
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      const di = y * (1 + width * 3) + 1 + x * 3;
      rawData[di]     = rgba[si];
      rawData[di + 1] = rgba[si + 1];
      rawData[di + 2] = rgba[si + 2];
    }
  }

  const compressed = zlib(rawData);
  const ihdrChunk = pngChunk('IHDR', ihdr);
  const idatChunk = pngChunk('IDAT', compressed);
  const iendChunk = pngChunk('IEND', new Uint8Array(0));

  const totalLen = sig.length + ihdrChunk.length + idatChunk.length + iendChunk.length;
  const png = new Uint8Array(totalLen);
  let offset = 0;
  png.set(sig, offset); offset += sig.length;
  png.set(ihdrChunk, offset); offset += ihdrChunk.length;
  png.set(idatChunk, offset); offset += idatChunk.length;
  png.set(iendChunk, offset);
  return png;
}
