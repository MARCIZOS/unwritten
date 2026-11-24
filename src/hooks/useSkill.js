import { useEffect, useState } from 'react';
import { watchSkill } from '../data/skills';
import { useAuth } from './useAuth';

/** Live skill doc + the viewer's role ('owner' | 'apprentice'). */
export function useSkill(skillId) {
  const { user } = useAuth();
  const [state, setState] = useState({ skill: null, loading: true, error: null });

  useEffect(() => {
    if (!user || !skillId) return undefined;
    setState((s) => ({ ...s, loading: true }));
    let unsub = null;
    let timer = null;
    let tries = 0;
    const listen = () => {
      unsub = watchSkill(
        skillId,
        (skill) => setState({ skill, loading: false, error: null }),
        (error) => {
          // A denied read right after creating or joining usually means the server
          // hasn't caught up yet: retry a few times before showing the error.
          if (error.code === 'permission-denied' && tries < 3) {
            tries += 1;
            timer = setTimeout(listen, 1500 * tries);
            return;
          }
          setState({ skill: null, loading: false, error });
        },
      );
    };
    listen();
    return () => {
      clearTimeout(timer);
      unsub?.();
    };
  }, [skillId, user]);

  const role = state.skill && user ? (state.skill.ownerUid === user.uid ? 'owner' : 'apprentice') : null;
  return { ...state, role, uid: user?.uid };
}
