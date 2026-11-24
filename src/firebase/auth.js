import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  GoogleAuthProvider,
  linkWithPopup,
  signInWithPopup,
  signInWithCredential,
  signOut as fbSignOut,
  connectAuthEmulator,
} from 'firebase/auth';
import { app } from './app';

export const auth = getAuth(app);

if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

/** Guest account: no sign-up, data tied to this browser until it is linked to Google. */
export async function continueAsGuest() {
  if (auth.currentUser) return auth.currentUser;
  const cred = await signInAnonymously(auth);
  return cred.user;
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

/** Friendly words for the auth errors people actually hit. Returns '' for "user closed the popup". */
export function authErrorMessage(err) {
  switch (err?.code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return '';
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google window. Allow pop-ups for this site and try again.';
    case 'auth/network-request-failed':
      return "Can't reach Google right now. Check your internet connection, or continue as a guest.";
    case 'auth/operation-not-allowed':
    case 'auth/admin-restricted-operation':
      return 'This sign-in option is turned off in Firebase. Enable it in Authentication > Sign-in method.';
    case 'auth/unauthorized-domain':
      return 'This web address is not allowed to sign in. Add it in Firebase > Authentication > Settings > Authorized domains.';
    default:
      return err?.message || 'Sign-in failed. Try again.';
  }
}

/**
 * Upgrades the anonymous account to Google so the same uid (and all skills) survive.
 * If that Google account already exists, signs into it instead; returns { switched: true }
 * so the UI can explain that anonymous skills stay with the old account.
 */
export async function saveWithGoogle() {
  const provider = new GoogleAuthProvider();
  const user = auth.currentUser;
  if (!user) {
    await signInWithPopup(auth, provider);
    return { switched: false };
  }
  try {
    await linkWithPopup(user, provider);
    return { switched: false };
  } catch (err) {
    if (err.code === 'auth/credential-already-in-use') {
      const cred = GoogleAuthProvider.credentialFromError(err);
      await signInWithCredential(auth, cred);
      return { switched: true };
    }
    throw err;
  }
}

export function signOut() {
  return fbSignOut(auth);
}
