/**
 * Marker Detection Logic for Alemeno Assignment
 *
 * Marker 1 specification:
 *  - 140x140 mm overall square with thick black border (~14mm border width = ~10% of total size)
 *  - Small 20x20 mm black square in the TOP-LEFT corner of the interior
 *  - ~75% interior is empty (white) -> meets the 60% empty requirement
 *  - The 20x20 corner square acts as the orientation marker
 *
 * Detection Algorithm:
 * 1. Convert frame to grayscale (luminance-based)
 * 2. Apply adaptive thresholding (binary image)
 * 3. Find contours via border-following
 * 4. Filter for large quadrilateral contours (potential markers)
 * 5. Validate: check outer border aspect ratio, inner corner square presence
 * 6. Determine orientation from corner square position
 * 7. Apply perspective correction / tight crop
 */

export interface Point {
  x: number;
  y: number;
}

export interface Quad {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

export interface DetectionResult {
  found: boolean;
  quad?: Quad;
  orientation?: number; // degrees: 0, 90, 180, 270
  confidence?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure JavaScript image-processing helpers operating on a flat RGBA Uint8Array
// ─────────────────────────────────────────────────────────────────────────────

/** Convert RGBA buffer to grayscale (luminance) */
export function toGrayscale(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): Uint8Array {
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = (r * 77 + g * 150 + b * 29) >> 8; // fast luminance
  }
  return gray;
}

/** 
 * Global Otsu threshold on grayscale image.
 * Returns a binary (0/255) Uint8Array.
 */
export function otsuThreshold(gray: Uint8Array, width: number, height: number): Uint8Array {
  const n = width * height;
  const hist = new Int32Array(256);
  for (let i = 0; i < n; i++) hist[gray[i]]++;

  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];

  let sumB = 0, wB = 0, wF = 0;
  let varMax = 0, threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    wF = n - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const varBetween = wB * wF * (mB - mF) ** 2;
    if (varBetween > varMax) {
      varMax = varBetween;
      threshold = t;
    }
  }

  const binary = new Uint8Array(n);
  for (let i = 0; i < n; i++) binary[i] = gray[i] > threshold ? 255 : 0;
  return binary;
}

/**
 * Simple blob-labelling connected components (4-connectivity).
 * Returns { labels, numLabels }
 */
export function connectedComponents(
  binary: Uint8Array,
  width: number,
  height: number,
): { labels: Int32Array; numLabels: number } {
  const labels = new Int32Array(width * height).fill(-1);
  let label = 0;
  const stack: number[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (binary[idx] === 0 && labels[idx] === -1) {
        // BFS flood fill for dark pixels (marker is black on white)
        stack.push(idx);
        labels[idx] = label;
        while (stack.length) {
          const cur = stack.pop()!;
          const cx = cur % width;
          const cy = (cur / width) | 0;
          const neighbors = [
            cy > 0 ? cur - width : -1,
            cy < height - 1 ? cur + width : -1,
            cx > 0 ? cur - 1 : -1,
            cx < width - 1 ? cur + 1 : -1,
          ];
          for (const nb of neighbors) {
            if (nb !== -1 && binary[nb] === 0 && labels[nb] === -1) {
              labels[nb] = label;
              stack.push(nb);
            }
          }
        }
        label++;
      }
    }
  }
  return { labels, numLabels: label };
}

/** Compute bounding rect of a label */
export function boundingRect(
  labels: Int32Array,
  labelId: number,
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number; area: number } {
  let minX = width, minY = height, maxX = 0, maxY = 0, area = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (labels[y * width + x] === labelId) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        area++;
      }
    }
  }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, area };
}

/**
 * Detect Marker 1 in a binary image.
 *
 * Strategy:
 * 1. Find all dark blobs
 * 2. Find the large square blob (the outer border) – aspect ratio close to 1
 * 3. Inside that blob's bounding box, find a small square blob in one corner
 * 4. That corner blob tells us the orientation
 *
 * Returns null if no valid marker is found.
 */
export interface MarkerDetectionData {
  outerRect: { x: number; y: number; w: number; h: number };
  cornerPosition: 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft';
  orientation: number; // degrees CW to rotate to canonical (corner=topLeft)
  confidence: number;
}

export function detectMarker1(
  binary: Uint8Array,
  width: number,
  height: number,
  labels: Int32Array,
  numLabels: number,
): MarkerDetectionData | null {
  const minOuterArea = (width * height) * 0.002;  // at least 0.2% of frame
  const maxOuterArea = (width * height) * 0.60;   // at most 60% of frame
  const minAspect = 0.70;
  const maxAspect = 1.30;

  // Collect all blob bounding rects
  const rects: Array<{ id: number; x: number; y: number; w: number; h: number; area: number }> = [];
  for (let id = 0; id < numLabels; id++) {
    const r = boundingRect(labels, id, width, height);
    rects.push({ id, ...r });
  }

  // Find candidate outer border blobs (large, roughly square)
  const outerCandidates = rects.filter(r => {
    if (r.area < minOuterArea || r.area > maxOuterArea) return false;
    const aspect = r.w / r.h;
    if (aspect < minAspect || aspect > maxAspect) return false;
    // Must be large enough in absolute pixels
    if (r.w < 50 || r.h < 50) return false;
    return true;
  });

  if (outerCandidates.length === 0) return null;

  // For each outer candidate, look for the orientation corner square inside
  for (const outer of outerCandidates) {
    // Expected interior: inset by border width (~10% each side)
    const borderFrac = 0.10;
    const bw = Math.round(outer.w * borderFrac);
    const bh = Math.round(outer.h * borderFrac);

    // Expected corner square size: ~20/140 * outerW = ~14.3% of interior width
    const cornerFrac = 0.143;
    const expectedCornerW = Math.round(outer.w * cornerFrac);
    const expectedCornerH = Math.round(outer.h * cornerFrac);
    const tolerance = 0.60; // ±60% tolerance on corner size

    // Define the 4 interior corner regions where the corner square could be
    const interiorX = outer.x + bw;
    const interiorY = outer.y + bh;
    const interiorW = outer.w - 2 * bw;
    const interiorH = outer.h - 2 * bh;

    const cornerRegions = {
      topLeft:     { x: interiorX, y: interiorY },
      topRight:    { x: interiorX + interiorW - expectedCornerW, y: interiorY },
      bottomRight: { x: interiorX + interiorW - expectedCornerW, y: interiorY + interiorH - expectedCornerH },
      bottomLeft:  { x: interiorX, y: interiorY + interiorH - expectedCornerH },
    } as const;

    type CornerKey = keyof typeof cornerRegions;

    // Look for small square blobs in each corner region
    for (const [cornerKey, region] of Object.entries(cornerRegions) as [CornerKey, {x:number;y:number}][]) {
      const searchPad = Math.round(expectedCornerW * 1.5);
      const searchX1 = Math.max(0, region.x - searchPad);
      const searchY1 = Math.max(0, region.y - searchPad);
      const searchX2 = Math.min(width - 1, region.x + expectedCornerW + searchPad);
      const searchY2 = Math.min(height - 1, region.y + expectedCornerH + searchPad);

      // Find blobs inside this corner search area that aren't the outer blob
      const cornerBlobs = rects.filter(r => {
        if (r.id === outer.id) return false;
        const cx = r.x + r.w / 2;
        const cy = r.y + r.h / 2;
        if (cx < searchX1 || cx > searchX2 || cy < searchY1 || cy > searchY2) return false;
        // Check size ~ expected corner size
        const wRatio = r.w / expectedCornerW;
        const hRatio = r.h / expectedCornerH;
        if (wRatio < (1 - tolerance) || wRatio > (1 + tolerance)) return false;
        if (hRatio < (1 - tolerance) || hRatio > (1 + tolerance)) return false;
        // Must be roughly square
        const cAspect = r.w / r.h;
        if (cAspect < 0.5 || cAspect > 2.0) return false;
        return true;
      });

      if (cornerBlobs.length > 0) {
        // Found the marker! Determine orientation
        const orientationMap: Record<CornerKey, number> = {
          topLeft:     0,
          topRight:    90,
          bottomRight: 180,
          bottomLeft:  270,
        };

        const confidence = Math.min(
          1.0,
          Math.min(outer.w, outer.h) / Math.max(outer.w, outer.h) * // squareness
          0.85 + cornerBlobs.length * 0.05 // bonus for multiple corner blobs
        );

        return {
          outerRect: { x: outer.x, y: outer.y, w: outer.w, h: outer.h },
          cornerPosition: cornerKey,
          orientation: orientationMap[cornerKey],
          confidence,
        };
      }
    }
  }

  return null;
}

/**
 * Detect Marker 2 in a binary image.
 *
 * Marker 2: 160x160 square
 *  - Solid thick L-shaped border on bottom + left sides
 *  - Dashed border on top + right sides
 *  - The solid corner is the bottom-left → orientation marker
 *
 * Detection approach:
 * 1. Find large dark blob (the L-bar)
 * 2. Check that the shape has an L-profile (more density on two adjacent sides)
 * 3. Determine orientation
 */
export function detectMarker2(
  binary: Uint8Array,
  width: number,
  height: number,
  labels: Int32Array,
  numLabels: number,
): MarkerDetectionData | null {
  // For brevity we'll do a simplified check similar to Marker1 but check for L-shape
  // Full implementation would analyse the edge-density profile
  // This placeholder returns null – real detection in JSI/native module
  return null;
}
