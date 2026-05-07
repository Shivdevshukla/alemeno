import React from 'react';
import type { ScannedMarker } from '../hooks/useMarkerScanner';

interface Props {
  markers: ScannedMarker[];
}

export const MarkerGallery: React.FC<Props> = ({ markers }) => {
  return (
    <div style={{ padding: '20px', height: '100%', overflowY: 'auto', backgroundColor: '#0f0f1a' }}>
      <h2 style={{ textAlign: 'center', color: '#00d4ff', marginBottom: '24px' }}>
        Detection Complete
      </h2>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: '16px',
        paddingBottom: '40px'
      }}>
        {markers.map((marker, index) => (
          <div key={marker.id} style={{
            backgroundColor: '#1a1a2e',
            borderRadius: '12px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
            transition: 'transform 0.2s',
          }}>
            <img 
              src={marker.dataUri} 
              alt={`Marker ${index + 1}`}
              style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '8px', marginBottom: '8px' }}
            />
            <div style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>#{index + 1}</div>
            <div style={{ color: '#888', fontSize: '12px' }}>
              Conf: {(marker.confidence * 100).toFixed(0)}%
            </div>
          </div>
        ))}
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
        <button 
          onClick={() => window.location.reload()}
          style={{
            backgroundColor: '#00d4ff',
            color: '#000',
            padding: '12px 32px',
            borderRadius: '24px',
            fontWeight: 'bold',
            fontSize: '16px'
          }}
        >
          Scan Again
        </button>
      </div>
    </div>
  );
};
