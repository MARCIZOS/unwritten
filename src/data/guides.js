import { collection, doc, setDoc, onSnapshot, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { fire } from './util';

const col = (skillId) => collection(db, 'skills', skillId, 'guides');

export function saveGuide(skillId, guide) {
  const ref = doc(col(skillId));
  fire(setDoc(ref, { ...guide, createdAt: serverTimestamp(), createdAtMs: Date.now() }), 'save guide');
  return ref.id;
}

export function watchLatestGuide(skillId, cb) {
  return onSnapshot(query(col(skillId), orderBy('createdAtMs', 'desc'), limit(1)),
    (s) => cb(s.empty ? null : { id: s.docs[0].id, ...s.docs[0].data() }),
    (err) => { console.error(err); cb(null); });
}
