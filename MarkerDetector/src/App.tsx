import { useEffect, useRef, useState } from 'react';
import { useMarkerScanner } from './hooks/useMarkerScanner';
import { ScanOverlay } from './components/ScanOverlay';
import { MarkerGallery } from './components/MarkerGallery';

function App() {
  const { state, processVideoFrame, startScanning } = useMarkerScanner();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasCamera, setHasCamera] = useState(true);

  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Camera access denied:', err);
        setHasCamera(false);
      }
    }
    setupCamera();
  }, []);

  useEffect(() => {
    let animationFrameId: number;

    const loop = () => {
      if (videoRef.current && canvasRef.current && state.scanning) {
        processVideoFrame(videoRef.current, canvasRef.current);
      }
      animationFrameId = requestAnimationFrame(loop);
    };

    if (state.scanning && !state.isComplete) {
      loop();
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [state.scanning, state.isComplete, processVideoFrame]);

  return (
    <div style={{ width: '100%', height: '100dvh', backgroundColor: '#000', position: 'relative' }}>
      {!state.isComplete ? (
        <>
          {hasCamera ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'white' }}>
              Camera access required. Please allow camera permissions.
            </div>
          )}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          <ScanOverlay
            scannedCount={state.scannedCount}
            totalNeeded={20}
            lastDetectionTime={state.lastDetectionTime}
            scanning={state.scanning}
          />
          {state.scannedCount === 0 && (
            <div style={{ position: 'absolute', bottom: '30px', width: '100%', display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={startScanning}
                style={{ padding: '12px 24px', fontSize: '18px', borderRadius: '8px', backgroundColor: '#00d4ff', color: '#000', fontWeight: 'bold' }}
              >
                Start Scanning
              </button>
            </div>
          )}
        </>
      ) : (
        <MarkerGallery markers={state.markers} />
      )}
    </div>
  );
}

export default App;
