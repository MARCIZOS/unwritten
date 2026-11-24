// Stable (module-level) watcher functions with the callback last, for useLive().
import { watchExperts } from './experts';
import { watchSessions } from './sessions';
import { watchLatestGuide } from './guides';
import { watchGaps } from './gaps';
import { watchTests } from './tests';
import { watchOwnedSkills, watchJoinedSkillIds, watchSkill } from './skills';

export const liveExperts = (skillId, cb) => watchExperts(skillId, cb);
export const liveSessions = (skillId, cb) => watchSessions(skillId, cb);
export const liveGuide = (skillId, cb) => watchLatestGuide(skillId, cb);
export const liveGaps = (skillId, cb) => watchGaps(skillId, cb);
export const liveAllTests = (skillId, cb) => watchTests(skillId, cb);
export const liveMyTests = (skillId, uid, cb) => watchTests(skillId, cb, uid);
export const liveOwnedSkills = (uid, cb) => watchOwnedSkills(uid, cb);
export const liveJoinedIds = (uid, cb) => watchJoinedSkillIds(uid, cb);
export const liveSkill = (skillId, cb) => watchSkill(skillId, cb, () => cb(null));
