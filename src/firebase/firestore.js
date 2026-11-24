import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import { app } from './app';

// Persistent local cache = reads and writes keep working with Wi-Fi off and sync on reconnect.
function createDb() {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch (err) {
    console.warn('[UNWRITTEN] Offline cache unavailable, using memory cache.', err);
    return getFirestore(app);
  }
}

export const db = createDb();

if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
