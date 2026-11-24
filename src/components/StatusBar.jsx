import { useOnline } from '../hooks/useOnline';

const DEVICE_TEXT = {
  checking: 'Checking on-device AI…',
  available: 'On-device AI ready',
  downloadable: 'On-device AI: download on first use',
  downloading: 'On-device AI downloading…',
  unavailable: 'No on-device AI on this device',
  unsupported: 'No on-device AI in this browser',
};

export function OfflineDot() {
  const online = useOnline();
  return (
    <span className={`status-pill ${online ? 'is-online' : 'is-offline'}`} title={online ? 'Online' : 'Offline: work is saved on this device and syncs later'}>
      <span className="status-dot" aria-hidden="true" />
      {online ? 'Online' : 'Offline'}
    </span>
  );
}

export function DevicePill({ status }) {
  return (
    <span className={`status-pill device-${status}`} title="Chrome's built-in Gemini Nano">
      <span className="status-dot" aria-hidden="true" />
      {DEVICE_TEXT[status] || status}
    </span>
  );
}
