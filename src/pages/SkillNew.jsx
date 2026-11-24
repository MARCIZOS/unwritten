import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { createSkill } from '../data/skills';
import { ErrorNote } from '../components/Common';
import { pickExample } from '../data/examples';

const blankExpert = () => ({ name: '', relation: '', context: '' });

export default function SkillNew() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [experts, setExperts] = useState([blankExpert()]);
  const [saving, setSaving] = useState(false);
  const [ex] = useState(pickExample);
  const [error, setError] = useState(null);

  const setExpert = (i, key, value) => setExperts((list) => list.map((e, j) => (j === i ? { ...e, [key]: value } : e)));
  const valid = title.trim() && experts.some((e) => e.name.trim());

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    const { id, saved } = createSkill(user.uid, { title, description }, experts.filter((x) => x.name.trim()));
    // Wait for the server (usually under a second) so the skill page can read it.
    // Offline the write stays queued on this device; continue after a few seconds anyway.
    const outcome = await Promise.race([
      saved.then(() => 'saved', (err) => err),
      new Promise((resolve) => { setTimeout(() => resolve('queued'), navigator.onLine ? 8000 : 500); }),
    ]);
    if (outcome instanceof Error) {
      setError(outcome);
      setSaving(false);
      return;
    }
    navigate(`/s/${id}`);
  };

  return (
    <form className="plain form" onSubmit={submit}>
      <h1>Capture a new skill</h1>
      <label className="field">
        <span>What is the skill?</span>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`e.g. ${ex.skill}`} aria-label="Skill name" maxLength={120} required />
      </label>
      <label className="field">
        <span>A line of context (optional)</span>
        <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={`e.g. ${ex.about}`} aria-label="Context for the skill" maxLength={2000} />
      </label>

      <h2>Who knows it?</h2>
      <p className="muted">The person who does this by instinct: a parent, a mentor, a senior colleague. Add a second expert later to compare their versions.</p>
      {experts.map((person, i) => (
        <div className="expert-row" key={i}>
          <input className="input" value={person.name} onChange={(e) => setExpert(i, 'name', e.target.value)} placeholder={`Name, e.g. ${ex.name}`} aria-label="Expert name" maxLength={80} />
          <input className="input" value={person.relation} onChange={(e) => setExpert(i, 'relation', e.target.value)} placeholder={`Who they are, e.g. ${ex.relation}`} aria-label="Who the expert is" maxLength={80} />
          <input className="input" value={person.context} onChange={(e) => setExpert(i, 'context', e.target.value)} placeholder={`Background, e.g. ${ex.context}`} aria-label="Expert background" maxLength={500} />
        </div>
      ))}
      <div className="row gap">
        <button type="button" className="btn" onClick={() => setExperts((l) => [...l, blankExpert()])}>Add another expert</button>
        <button type="submit" className="btn btn-primary" disabled={!valid || saving}>{saving ? 'Saving…' : 'Create skill'}</button>
      </div>
      <ErrorNote error={error} />
    </form>
  );
}
