# Alemeno Marker Detector (PWA)

A highly performant Progressive Web Application (PWA) to detect, extract, and orient custom printed markers (Marker 1).

## Features
* **Progressive Web App (PWA):** Installable on any smartphone (iOS/Android) directly from the browser without an App Store.
* **Responsive Design:** Automatically uses the device's main camera.
* Pure JavaScript marker detection algorithm running in the browser using HTML5 Canvas.
* Robust Otsu thresholding and geometric validation for accurate detection.
* Perfect 300x300px extraction, utilizing bilinear sampling.
* Orientation detection and auto-rotation.

## Dependencies & Requirements
- Node.js (v22+)

## Setup Instructions

1. **Install Node modules:**
   ```bash
   npm install
   ```

2. **Run the Development Server:**
   ```bash
   npm run dev
   ```

3. **Accessing on your Phone (Mobile Testing):**
   - Ensure your phone and computer are on the same WiFi network.
   - Run the dev server with the `--host` flag to expose it to your network: `npm run dev -- --host`
   - Open your phone's browser and navigate to the local IP address shown in your terminal (e.g., `http://192.168.1.5:5173`).

4. **Install as an App:**
   - On **iOS (Safari):** Tap the "Share" icon at the bottom, then select "Add to Home Screen".
   - On **Android (Chrome):** Tap the three-dot menu icon, then select "Install app" or "Add to Home screen".

## Usage:
- Grant the camera permission on the first launch.
- Point the camera at **Marker 1**.
- The app will flash green on successful detection and incrementally save frames.
- Once 20 frames are processed, it will display them in a grid.

## Marker details
This implementation targets the provided **Marker 1**:
* 140x140 square
* Thick continuous black border
* Internal top-left 20x20 black orientation square.
