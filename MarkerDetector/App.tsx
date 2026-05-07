/**
 * App.tsx – Root navigation controller
 *
 * State machine:
 *   splash → camera → results → (reset) → splash
 */

import React, { useState, useCallback } from 'react';
import { StatusBar } from 'react-native';
import { SplashScreen } from './src/screens/SplashScreen';
import { CameraScreen } from './src/screens/CameraScreen';
import { ResultsScreen } from './src/screens/ResultsScreen';
import type { ScannedMarker } from './src/hooks/useMarkerScanner';

type Screen = 'splash' | 'camera' | 'results';

export default function App() {
  const [screen, setScreen] = useState<Screen>('splash');
  const [capturedMarkers, setCapturedMarkers] = useState<ScannedMarker[]>([]);

  const handleStart = useCallback(() => {
    setScreen('camera');
  }, []);

  const handleComplete = useCallback((markers: ScannedMarker[]) => {
    setCapturedMarkers(markers);
    setScreen('results');
  }, []);

  const handleReset = useCallback(() => {
    setCapturedMarkers([]);
    setScreen('splash');
  }, []);

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a1a" />
      {screen === 'splash' && <SplashScreen onStart={handleStart} />}
      {screen === 'camera' && (
        <CameraScreen onComplete={handleComplete} />
      )}
      {screen === 'results' && (
        <ResultsScreen markers={capturedMarkers} onReset={handleReset} />
      )}
    </>
  );
}
