// Per-skill record of every AI call: where it ran and, for cloud calls, exactly what was sent.
// Shown in the privacy panel. Kept in this browser only.

const KEY = (skillId) => `unwritten-ledger:${skillId}`;
const MAX = 150;

export function readLedger(skillId) {
  try {
    return JSON.parse(localStorage.getItem(KEY(skillId)) || '[]');
  } catch {
    return [];
  }
}

export function record(skillId, entry) {
  if (!skillId) return;
  try {
    const list = readLedger(skillId);
    list.unshift({ at: Date.now(), ...entry });
    localStorage.setItem(KEY(skillId), JSON.stringify(list.slice(0, MAX)));
    window.dispatchEvent(new CustomEvent('unwritten-ledger', { detail: skillId }));
  } catch {
    /* storage full or blocked: the panel just shows less */
  }
}
