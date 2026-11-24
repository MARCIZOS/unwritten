import { collection, doc, setDoc, updateDoc, onSnapshot, query, orderBy, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { fire, snapToList } from './util';

const col = (skillId) => collection(db, 'skills', skillId, 'gaps');

export const GAP_STATUS = ['open', 'asked', 'resolved', 'needs-hands-on'];

function gapDoc(g) {
  return {
    text: String(g.text || '').slice(0, 1000),
    questionForExpert: String(g.questionForExpert || g.text || '').slice(0, 500),
    stepTitle: String(g.stepTitle || '').slice(0, 200),
    origin: g.origin,
    status: g.status === 'needs-hands-on' ? 'needs-hands-on' : 'open',
    round: g.round,
    createdAtMs: Date.now(),
    ...(g.byUid ? { byUid: g.byUid } : {}),
    ...(g.expertId ? { expertId: g.expertId } : {}),
  };
}

/** Owner path: batch write (owner may write any field). */
export function addGaps(skillId, gaps) {
  if (!gaps.length) return Promise.resolve();
  const batch = writeBatch(db);
  gaps.forEach((g) => batch.set(doc(col(skillId)), gapDoc(g)));
  return fire(batch.commit(), 'add gaps');
}

/** Apprentice path: individual creates with origin 'apprentice', status 'open' (rules check this). */
export function addApprenticeGaps(skillId, gaps, uid) {
  return Promise.all(gaps.map((g) =>
    fire(setDoc(doc(col(skillId)), gapDoc({ ...g, origin: 'apprentice', byUid: uid })), 'add apprentice gap')));
}

export function updateGap(skillId, gapId, patch) {
  return fire(updateDoc(doc(col(skillId), gapId), patch), 'update gap');
}

export function watchGaps(skillId, cb) {
  return onSnapshot(query(col(skillId), orderBy('createdAtMs')), (s) => cb(snapToList(s)),
    (err) => { console.error(err); cb([]); });
}
