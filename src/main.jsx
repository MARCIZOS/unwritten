import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './firebase'; // initialises Firebase and App Check first
import { loadRemoteConfig } from './firebase';
import App from './App';
import { AuthProvider } from './hooks/useAuth';
import { DeviceProvider } from './hooks/DeviceContext';
// Fonts are bundled (not loaded from Google Fonts) so the notebook looks right offline too.
import '@fontsource/rozha-one/400.css';
import '@fontsource/martel/400.css';
import '@fontsource/martel/700.css';
import '@fontsource/martel/800.css';
import '@fontsource/hind/400.css';
import '@fontsource/hind/500.css';
import '@fontsource/hind/600.css';
import '@fontsource/kalam/400.css';
import '@fontsource/kalam/700.css';
import './index.css';

loadRemoteConfig();

// Firebase's background services (Installations, Remote Config) can reject while the device is
// offline. The app already works offline, so these are expected: log them quietly.
window.addEventListener('unhandledrejection', (event) => {
  const msg = String(event.reason?.code || event.reason?.message || event.reason || '');
  if (/app-offline|installations|remoteconfig|network-request-failed|Failed to fetch/i.test(msg)) {
    event.preventDefault();
    console.warn('[UNWRITTEN] Background Firebase request failed (probably offline):', msg);
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <DeviceProvider>
          <App />
        </DeviceProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
