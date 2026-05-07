import React, { useEffect, useState } from 'react';

interface Props {
  scannedCount: number;
  totalNeeded: number;
  lastDetectionTime: number | null;
  scanning: boolean;
}

export const ScanOverlay: React.FC<Props> = ({ scannedCount, totalNeeded, lastDetectionTime, scanning }) => {
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (lastDetectionTime) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 300);
      return () => clearTimeout(timer);
    }
  }, [lastDetectionTime]);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
      {/* Scanning Target Box */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '280px',
        height: '280px',
        border: `4px solid ${flash ? '#00ff00' : 'rgba(255, 255, 255, 0.4)'}`,
        borderRadius: '16px',
        transition: 'border-color 0.2s',
      }}>
        {scanning && (
          <div className="scan-line" style={{
            position: 'absolute',
            width: '100%',
            height: '2px',
            backgroundColor: flash ? '#00ff00' : '#00d4ff',
            boxShadow: `0 0 8px ${flash ? '#00ff00' : '#00d4ff'}`,
            animation: 'scan 2s linear infinite',
          }} />
        )}
      </div>

      {/* Progress Counter */}
      <div style={{
        position: 'absolute',
        top: '40px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: '12px 24px',
        borderRadius: '24px',
        backdropFilter: 'blur(4px)',
      }}>
        <div style={{ color: '#fff', fontSize: '20px', fontWeight: 'bold' }}>
          {scannedCount} / {totalNeeded} Scanned
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
};
