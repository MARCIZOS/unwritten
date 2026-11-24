import { collection, doc, setDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { fire, snapToList } from './util';

const col = (skillId) => collection(db, 'skills', skillId, 'experts');

export function addExpert(skillId, { name, relation, context }) {
  const ref = doc(col(skillId));
  fire(setDoc(ref, {
    name: name.trim().slice(0, 80),
    relation: (relation || '').trim().slice(0, 80),
    context: (context || '').trim().slice(0, 500),
    createdAt: serverTimestamp(),
    createdAtMs: Date.now(),
  }), 'add expert');
  return ref.id;
}

export function watchExperts(skillId, cb) {
  return onSnapshot(query(col(skillId), orderBy('createdAtMs')), (s) => cb(snapToList(s)),
    (err) => { console.error(err); cb([]); });
}
