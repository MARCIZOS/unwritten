// Firestore write promises only resolve after the server acknowledges them, which never
// happens while offline. The local cache applies the write immediately, so the UI should
// not wait: fire the write, log failures, move on.
export function fire(promise, label = 'write') {
  promise.catch((err) => console.error(`[UNWRITTEN] ${label} failed`, err));
  return promise;
}

export function randomCode(len = 10) {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export function snapToList(snap) {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
