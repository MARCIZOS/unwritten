import {
  collection, doc, setDoc, updateDoc, deleteDoc, getDocs, getDoc, onSnapshot,
  query, where, serverTimestamp, arrayUnion, arrayRemove, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { fire, randomCode, snapToList } from './util';

const skillsCol = () => collection(db, 'skills');
export const skillRef = (skillId) => doc(db, 'skills', skillId);

/**
 * Creates the skill, then its first experts. Separate writes on purpose: the expert rules
 * check the skill's owner on the server, so the skill must land first (Firestore sends a
 * client's writes in order). Returns { id, saved }: `saved` resolves when the server has
 * everything. Offline it never resolves, so callers should not wait forever.
 */
export function createSkill(uid, { title, description }, experts = []) {
  const ref = doc(skillsCol());
  const writes = [fire(setDoc(ref, {
    title: title.trim().slice(0, 120),
    description: (description || '').trim().slice(0, 2000),
    ownerUid: uid,
    inviteCode: randomCode(),
    currentRound: 1,
    createdAt: serverTimestamp(),
    createdAtMs: Date.now(),
  }), 'create skill')];
  experts.forEach((x) => {
    writes.push(fire(setDoc(doc(collection(db, 'skills', ref.id, 'experts')), {
      name: x.name.trim().slice(0, 80),
      relation: (x.relation || '').trim().slice(0, 80),
      context: (x.context || '').trim().slice(0, 500),
      createdAt: serverTimestamp(),
      createdAtMs: Date.now(),
    }), 'add expert'));
  });
  return { id: ref.id, saved: Promise.all(writes) };
}

export function watchOwnedSkills(uid, cb) {
  return onSnapshot(query(skillsCol(), where('ownerUid', '==', uid)), (s) => cb(snapToList(s)),
    (err) => { console.error(err); cb([]); });
}

export function watchSkill(skillId, cb, onError) {
  return onSnapshot(skillRef(skillId), (s) => cb(s.exists() ? { id: s.id, ...s.data() } : null),
    (err) => { console.error(err); onError?.(err); });
}

export function updateSkill(skillId, patch) {
  return fire(updateDoc(skillRef(skillId), patch), 'update skill');
}

export function rotateInvite(skillId) {
  return updateSkill(skillId, { inviteCode: randomCode() });
}

export function inviteLink(skill) {
  return `${location.origin}/join/${skill.id}/${skill.inviteCode}`;
}

/** Apprentice joins: membership doc carries the invite code, which the rules check. */
export async function joinSkill(uid, skillId, code, displayName = '') {
  await setDoc(doc(db, 'skills', skillId, 'members', uid), {
    role: 'apprentice',
    code,
    joinedAt: serverTimestamp(),
    displayName: displayName.slice(0, 80),
  });
  fire(setDoc(doc(db, 'users', uid), { joined: arrayUnion(skillId) }, { merge: true }), 'save joined');
}

export function watchJoinedSkillIds(uid, cb) {
  return onSnapshot(doc(db, 'users', uid), (s) => cb(s.exists() ? s.data().joined || [] : []),
    () => cb([]));
}

export async function getSkillOnce(skillId) {
  try {
    const s = await getDoc(skillRef(skillId));
    return s.exists() ? { id: s.id, ...s.data() } : null;
  } catch {
    return null;
  }
}

export function forgetJoined(uid, skillId) {
  return fire(setDoc(doc(db, 'users', uid), { joined: arrayRemove(skillId) }, { merge: true }));
}

const SUBCOLLECTIONS = ['experts', 'sessions', 'guides', 'gaps', 'tests', 'members'];

/**
 * Deletes the skill and everything under it. Reads what this device can see (server or cache),
 * then queues the deletes without waiting for the server, so it also works offline.
 */
export async function deleteSkill(skillId) {
  await Promise.all(SUBCOLLECTIONS.map(async (name) => {
    let snap;
    try {
      snap = await Promise.race([
        getDocs(collection(db, 'skills', skillId, name)),
        new Promise((_, reject) => { setTimeout(() => reject(new Error('timeout')), 5000); }),
      ]);
    } catch {
      return;
    }
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    fire(batch.commit(), `delete ${name}`);
  }));
  fire(deleteDoc(skillRef(skillId)), 'delete skill');
}
