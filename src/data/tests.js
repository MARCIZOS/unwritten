import { collection, doc, setDoc, onSnapshot, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { fire, snapToList } from './util';

const col = (skillId) => collection(db, 'skills', skillId, 'tests');

export function submitTest(skillId, test) {
  const ref = doc(col(skillId));
  fire(setDoc(ref, { ...test, submittedAt: serverTimestamp(), submittedAtMs: Date.now() }), 'submit test');
  return ref.id;
}

/** Owner sees all tests; an apprentice only their own (matches the rules). */
export function watchTests(skillId, cb, apprenticeUid = null) {
  const q = apprenticeUid ? query(col(skillId), where('apprenticeUid', '==', apprenticeUid)) : col(skillId);
  return onSnapshot(q, (s) => cb(snapToList(s)), (err) => { console.error(err); cb([]); });
}
