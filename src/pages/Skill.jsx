import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useSkill } from '../hooks/useSkill';
import { useLive } from '../hooks/useLive';
import { liveExperts, liveSessions, liveGaps, liveGuide } from '../data/watchers';
import { addExpert } from '../data/experts';
import { deleteSkill } from '../data/skills';
import { pickExample } from '../data/examples';
import { transferScore } from '../ai/cues';
import { Spinner, Empty } from '../components/Common';
import InviteDialog from '../components/InviteDialog';
import HybridBadge from '../components/HybridBadge';

function AddExpert({ skillId }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', relation: '', context: '' });
  const [ex] = useState(pickExample);
  if (!open) return <button type="button" className="btn" onClick={() => setOpen(true)}>Add expert</button>;
  const save = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    addExpert(skillId, form);
    setForm({ name: '', relation: '', context: '' });
    setOpen(false);
  };
  return (
    <form className="expert-row" onSubmit={save}>
      <input className="input" autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={`Name, e.g. ${ex.name}`} aria-label="Expert name" maxLength={80} />
      <input className="input" value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })} placeholder={`Who they are, e.g. ${ex.relation}`} aria-label="Who the expert is" maxLength={80} />
      <input className="input" value={form.context} onChange={(e) => setForm({ ...form, context: e.target.value })} placeholder={`Background, e.g. ${ex.context}`} aria-label="Expert background" maxLength={500} />
      <button type="submit" className="btn btn-primary">Save expert</button>
    </form>
  );
}

function mainSource(turns) {
  const counts = {};
  (turns || []).forEach((t) => { counts[t.source] = (counts[t.source] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
}

export default function Skill() {
  const { skillId } = useParams();
  const navigate = useNavigate();
  const { skill, loading, role, error } = useSkill(skillId);
  const [experts] = useLive(liveExperts, [skillId], []);
  const [sessions] = useLive(liveSessions, [skillId], []);
  const [gaps] = useLive(liveGaps, [skillId], []);
  const [guide] = useLive(liveGuide, [skillId], null);
  const [inviting, setInviting] = useState(false);

  if (loading) return <Spinner />;
  if (error || !skill) {
    return (
      <Empty title="This skill isn't available">
        It may have been deleted, or you need an invite link from its owner. <Link to="/">Back to your skills</Link>
      </Empty>
    );
  }
  if (role !== 'owner') return <Navigate to={`/s/${skillId}/guide`} replace />;

  const score = transferScore(gaps);
  const openGaps = gaps.filter((g) => g.status === 'open' || g.status === 'asked');
  const expertName = (id) => experts.find((e) => e.id === id)?.name || 'Expert';

  const remove = async () => {
    if (!window.confirm(`Delete "${skill.title}" and every interview, guide and gap in it? This cannot be undone.`)) return;
    await deleteSkill(skillId);
    navigate('/');
  };

  return (
    <>
      <header className="page-head">
        <div>
          <p className="crumb"><Link to="/">Notebook</Link>, round {skill.currentRound || 1}</p>
          <h1>{skill.title}</h1>
          {skill.description && <p className="lead-small">{skill.description}</p>}
        </div>
        <div className="row gap wrap">
          <Link to={`/s/${skillId}/guide`} className="btn">Guide</Link>
          <Link to={`/s/${skillId}/score`} className="btn">Transfer Score</Link>
          <button type="button" className="btn btn-primary" onClick={() => setInviting(true)}>Invite apprentice</button>
        </div>
      </header>

      <ol className="loop" aria-label="The apprentice loop">
        <li>Interview the expert</li>
        <li>Spot what was left unsaid</li>
        <li>Write the guide</li>
        <li>Keep both voices</li>
        <li>A beginner tests it</li>
        <li>Ask again</li>
      </ol>

      <section className="plain">
        <div className="section-title">
          <h2>Experts</h2>
          <AddExpert skillId={skillId} />
        </div>
        {experts.length === 0 ? <Empty title="No experts yet">Add the person who does this best, by instinct.</Empty> : (
          <ul className="expert-list">
            {experts.map((ex) => {
              const done = sessions.filter((s) => s.expertId === ex.id && s.status === 'done').length;
              const waiting = Math.min(3, openGaps.filter((g) => g.origin === 'apprentice' || !g.expertId || g.expertId === ex.id).length);
              return (
                <li key={ex.id} className="expert-item">
                  <div>
                    <span className="expert-name">{ex.name}</span>{ex.relation && <span className="muted">, {ex.relation}</span>}
                    {ex.context && <p className="muted small">{ex.context}</p>}
                    <p className="small">{done === 0 ? 'Not interviewed yet' : `${done} finished session${done === 1 ? '' : 's'}`}</p>
                  </div>
                  <Link to={`/s/${skillId}/interview/${ex.id}`} className="btn btn-primary">
                    {waiting ? `Interview (${waiting} question${waiting === 1 ? '' : 's'} waiting)` : 'Interview'}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="two-col">
        <section className="plain">
          <div className="section-title"><h2>Sessions</h2></div>
          {sessions.length === 0 ? <Empty title="No interviews yet">Start with your first expert above.</Empty> : (
            <ul className="session-list">
              {sessions.map((s) => {
                const cues = (s.turns || []).reduce((n, t) => n + (t.cues?.length || 0), 0);
                return (
                  <li key={s.id}>
                    <Link to={`/s/${skillId}/session/${s.id}`} className="session-link">
                      <span className="row between">
                        <span><strong>{expertName(s.expertId)}</strong>, round {s.round}, {new Date(s.startedAtMs).toLocaleDateString()}</span>
                        <HybridBadge source={mainSource(s.turns)} small />
                      </span>
                      <span className="muted small">{(s.turns || []).length} answers, {cues} things unsaid{s.status === 'done' ? '' : ' (in progress)'}. Read it</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="plain">
          <div className="section-title"><h2>So far</h2></div>
          <div className="stat-row">
            <div className="stat"><span className="stat-num">{guide ? (guide.steps || []).length : 0}</span><span className="stat-label">guide steps</span></div>
            <div className="stat"><span className="stat-num">{score.found}</span><span className="stat-label">gaps found</span></div>
            <div className="stat"><span className="stat-num">{score.resolved}</span><span className="stat-label">filled in</span></div>
          </div>
          <p className="small">
            {guide ? <>Guide last written {new Date(guide.createdAtMs).toLocaleString()}. </> : 'No guide yet. Finish a session, then write it. '}
            <Link to={`/s/${skillId}/guide`}>Open the guide</Link>
          </p>
        </section>
      </div>

      <p className="danger-zone"><button type="button" className="link-btn danger" onClick={remove}>Delete this skill</button></p>
      {inviting && <InviteDialog skill={skill} onClose={() => setInviting(false)} />}
    </>
  );
}
