export function Spinner({ label = 'Turning the pages…' }) {
  return (
    <div className="spinner-wrap" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {children && <div className="empty-body">{children}</div>}
    </div>
  );
}

export function ErrorNote({ error, onRetry }) {
  if (!error) return null;
  const raw = error.message || String(error);
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  const network = /Failed to fetch|NetworkError|ERR_|network-request-failed|timed out/i.test(raw);
  // Firebase AI wraps every failed request as "Error fetching from <url>: [status] reason".
  const detail = raw.match(/\[(\d{3})[^\]]*\]\s*(.*)$/s);
  const msg = offline || (network && !detail)
    ? "Couldn't reach the cloud AI. Check your internet connection"
    : detail
      ? `The cloud AI said ${detail[1]}: ${detail[2].replace(/https?:\/\/\S+/g, '').trim().slice(0, 200)}`
      : raw.replace(/https?:\/\/\S+/g, '').trim();
  const hint = /app.?check|attestation|403|permission|fetch-status-error/i.test(raw)
    ? ' Firebase did not accept this browser (App Check). Copy the "App Check debug token" from the browser console (F12) and add it in Firebase → App Check → Apps → Manage debug tokens.'
    : /quota|429|resource.?exhausted/i.test(raw)
      ? ' The free quota is busy; wait a minute and try again.'
      : '';
  return (
    <div className="error-note" role="alert">
      <span>Something went wrong: {msg}.{hint}</span>
      {onRetry && <button type="button" className="btn btn-small" onClick={onRetry}>Try again</button>}
    </div>
  );
}
