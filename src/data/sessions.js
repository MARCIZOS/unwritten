import { collection, doc, setDoc, updateDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { fire, snapToList } from './util';

const col = (skillId) => collection(db, 'skills', skillId, 'sessions');

export function startSession(skillId, expertId, round) {
  const ref = doc(col(skillId));
  fire(setDoc(ref, {
    expertId,
    round,
    status: 'live',
    turns: [],
    summary: '',
    distilled: null,
    startedAt: serverTimestamp(),
    startedAtMs: Date.now(),
  }), 'start session');
  return ref.id;
}

/** Writes the whole turns list: one small document, safe to replay offline. */
export function saveTurns(skillId, sessionId, turns, extra = {}) {
  return fire(updateDoc(doc(col(skillId), sessionId), { turns, ...extra }), 'save turns');
}

export function finishSession(skillId, sessionId, patch) {
  return fire(updateDoc(doc(col(skillId), sessionId), {
    status: 'done',
    finishedAtMs: Date.now(),
    ...patch,
  }), 'finish session');
}

export function watchSessions(skillId, cb) {
  return onSnapshot(query(col(skillId), orderBy('startedAtMs', 'desc')), (s) => cb(snapToList(s)),
    (err) => { console.error(err); cb([]); });
}
