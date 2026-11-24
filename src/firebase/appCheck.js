import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { app, configMissing } from './app';

// Firebase AI Logic enforces App Check, so this must run before any AI or Firestore call.
// Locally, the debug flag makes the SDK print a debug token in the browser console:
// register it in Firebase console > App Check > Apps > Manage debug tokens.
const siteKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY;

if (import.meta.env.DEV && import.meta.env.VITE_APPCHECK_DEBUG === 'true') {
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

export const appCheckReady = !configMissing && Boolean(siteKey);

export const appCheck = appCheckReady
  ? initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    })
  : null;

if (!appCheckReady && !configMissing) {
  console.warn('[UNWRITTEN] VITE_RECAPTCHA_ENTERPRISE_SITE_KEY is not set, so App Check is off and AI calls will be rejected.');
}
