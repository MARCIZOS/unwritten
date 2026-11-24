import { useCallback, useEffect, useState } from 'react';
import { deviceAvailability, prepareDeviceModels } from '../ai';

/**
 * status: 'checking' | 'unsupported' | 'unavailable' | 'downloadable' | 'downloading' | 'available'
 * prepare() must be called from a click (Chrome requires a user gesture to start the download).
 */
export function useDeviceModel() {
  const [status, setStatus] = useState('checking');
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => setStatus(await deviceAvailability()), []);

  useEffect(() => { refresh(); }, [refresh]);

  const prepare = useCallback(async () => {
    setError(null);
    const current = await deviceAvailability();
    if (current === 'unsupported' || current === 'unavailable') {
      setStatus(current);
      return current;
    }
    try {
      if (current !== 'available') setStatus('downloading');
      await prepareDeviceModels((p) => setProgress(p));
    } catch (err) {
      console.error(err);
      setError(err);
    }
    const after = await deviceAvailability();
    setStatus(after);
    setProgress(null);
    return after;
  }, []);

  return { status, progress, error, prepare, refresh, onDevice: status === 'available' };
}
