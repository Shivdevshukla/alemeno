import { useState, useCallback, useRef } from 'react';
import {
  toGrayscale,
  otsuThreshold,
  connectedComponents,
  detectMarker1,
} from '../utils/markerDetection';
import { extractAndCorrectMarker, rgbaToBase64Png } from '../utils/imageProcessing';

export interface ScannedMarker {
  id: string;
  dataUri: string;
  timestamp: number;
  orientation: number;
  confidence: number;
}

export interface ScannerState {
  scanning: boolean;
  scannedCount: number;
  markers: ScannedMarker[];
  isComplete: boolean;
  lastDetectionTime: number | null;
}

const TARGET_COUNT = 20;
const MIN_DETECT_INTERVAL_MS = 200;

export function useMarkerScanner() {
  const [state, setState] = useState<ScannerState>({
    scanning: false,
    scannedCount: 0,
    markers: [],
    isComplete: false,
    lastDetectionTime: null,
  });

  const markersRef = useRef<ScannedMarker[]>([]);
  const isCompleteRef = useRef(false);
  const lastDetectMs = useRef(0);

  const processVideoFrame = useCallback(
    (videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement): boolean => {
      if (isCompleteRef.current) return false;

      const now = Date.now();
      if (now - lastDetectMs.current < MIN_DETECT_INTERVAL_MS) return false;

      const fw = videoElement.videoWidth;
      const fh = videoElement.videoHeight;
      if (fw === 0 || fh === 0) return false;

      // Draw the current video frame to the hidden canvas
      canvasElement.width = fw;
      canvasElement.height = fh;
      const ctx = canvasElement.getContext('2d', { willReadFrequently: true });
      if (!ctx) return false;

      ctx.drawImage(videoElement, 0, 0, fw, fh);
      const imageData = ctx.getImageData(0, 0, fw, fh);
      const rgbaData = imageData.data;

      // Downsample for fast detection
      const scale = Math.min(1, 600 / Math.max(fw, fh));
      const dw = Math.round(fw * scale);
      const dh = Math.round(fh * scale);

      // Nearest-neighbour downsample
      const dsData = new Uint8Array(dw * dh * 4);
      for (let y = 0; y < dh; y++) {
        for (let x = 0; x < dw; x++) {
          const sx = Math.min(Math.round(x / scale), fw - 1);
          const sy = Math.min(Math.round(y / scale), fh - 1);
          const si = (sy * fw + sx) * 4;
          const di = (y * dw + x) * 4;
          dsData[di] = rgbaData[si];
          dsData[di + 1] = rgbaData[si + 1];
          dsData[di + 2] = rgbaData[si + 2];
          dsData[di + 3] = 255;
        }
      }

      const gray = toGrayscale(dsData, dw, dh);
      const binary = otsuThreshold(gray, dw, dh);
      const { labels, numLabels } = connectedComponents(binary, dw, dh);
      const detection = detectMarker1(binary, dw, dh, labels, numLabels);

      if (!detection || detection.confidence < 0.45) return false;

      lastDetectMs.current = now;

      // Extraction on full-res frame
      const scaledRect = {
        x: Math.round(detection.outerRect.x / scale),
        y: Math.round(detection.outerRect.y / scale),
        w: Math.round(detection.outerRect.w / scale),
        h: Math.round(detection.outerRect.h / scale),
      };

      const extracted = extractAndCorrectMarker(
        { data: rgbaData, width: fw, height: fh },
        { ...detection, outerRect: scaledRect },
        300,
      );

      const dataUri = rgbaToBase64Png(extracted, 300, 300);

      const marker: ScannedMarker = {
        id: `m-${now}-${Math.random().toString(36).slice(2, 6)}`,
        dataUri,
        timestamp: now,
        orientation: detection.orientation,
        confidence: detection.confidence,
      };

      markersRef.current = [...markersRef.current, marker];
      const newCount = markersRef.current.length;
      const complete = newCount >= TARGET_COUNT;
      isCompleteRef.current = complete;

      setState({
        scanning: !complete,
        scannedCount: newCount,
        markers: markersRef.current,
        isComplete: complete,
        lastDetectionTime: now,
      });

      return true;
    },
    [],
  );

  const startScanning = useCallback(() => {
    markersRef.current = [];
    isCompleteRef.current = false;
    lastDetectMs.current = 0;
    setState({
      scanning: true,
      scannedCount: 0,
      markers: [],
      isComplete: false,
      lastDetectionTime: null,
    });
  }, []);

  const stopScanning = useCallback(() => {
    setState((prev) => ({ ...prev, scanning: false }));
  }, []);

  const reset = useCallback(() => {
    markersRef.current = [];
    isCompleteRef.current = false;
    lastDetectMs.current = 0;
    setState({
      scanning: false,
      scannedCount: 0,
      markers: [],
      isComplete: false,
      lastDetectionTime: null,
    });
  }, []);

  return { state, processVideoFrame, startScanning, stopScanning, reset };
}
