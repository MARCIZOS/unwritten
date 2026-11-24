import { useEffect, useState } from 'react';

/**
 * Subscribes to a Firestore watcher of shape (…args, cb) => unsubscribe.
 * Returns [value, loading]. Pass null as the first arg to skip.
 */
export function useLive(watch, args, initial = null) {
  const [value, setValue] = useState(initial);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(args);
  useEffect(() => {
    if (!watch || args.some((a) => a === null || a === undefined)) {
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    // Offline, a query that was never cached can wait a long time for its first snapshot.
    // Stop showing a spinner after a few seconds; the snapshot still updates the value later.
    const timer = setTimeout(() => setLoading(false), 4000);
    const unsub = watch(...args, (v) => {
      clearTimeout(timer);
      setValue(v);
      setLoading(false);
    });
    return () => {
      clearTimeout(timer);
      unsub?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watch, key]);
  return [value, loading];
}
