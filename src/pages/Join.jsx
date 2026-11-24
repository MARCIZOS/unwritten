import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getSkillOnce, joinSkill } from '../data/skills';
import { Spinner } from '../components/Common';

export default function Join() {
  const { skillId, code } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [state, setState] = useState('checking');
  const [error, setError] = useState(null);

  // If the owner (or an existing member) opens the link, skip joining.
  useEffect(() => {
    let cancelled = false;
    getSkillOnce(skillId).then((skill) => {
      if (cancelled) return;
      if (skill?.ownerUid === user.uid) navigate(`/s/${skillId}`, { replace: true });
      else if (skill) navigate(`/s/${skillId}/guide`, { replace: true });
      else setState('ready');
    });
    return () => { cancelled = true; };
  }, [skillId, user.uid, navigate]);

  const join = async (e) => {
    e.preventDefault();
    setState('joining');
    setError(null);
    if (!navigator.onLine) {
      setError(new Error('You are offline. Joining needs internet'));
      setState('ready');
      return;
    }
    try {
      await Promise.race([
        joinSkill(user.uid, skillId, code, name.trim()),
        new Promise((_, reject) => { setTimeout(() => reject(new Error('The connection timed out')), 15000); }),
      ]);
      navigate(`/s/${skillId}/guide`, { replace: true });
    } catch (err) {
      setError(err);
      setState('ready');
    }
  };

  if (state === 'checking') return <Spinner label="Opening invite…" />;

  return (
    <form className="plain form narrow" onSubmit={join}>
      <h1>You&apos;re invited to learn a skill</h1>
      <p>Read the guide, then take the Apprentice Test. What you find unclear goes back to the expert as new questions.</p>
      <label className="field">
        <span>Your name (optional)</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="How the expert knows you" />
      </label>
      {error && (
        <p className="error-note">
          {error.code === 'permission-denied' ? 'This invite link no longer works. Ask for a new one.' : `${error.message}. Try again.`}
        </p>
      )}
      <button type="submit" className="btn btn-primary btn-large" disabled={state === 'joining'}>
        {state === 'joining' ? 'Joining…' : 'Join as apprentice'}
      </button>
    </form>
  );
}
