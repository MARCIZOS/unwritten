import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { createExampleSkill } from '../data/example';
import { useLive } from '../hooks/useLive';
import { liveOwnedSkills, liveJoinedIds, liveSkill } from '../data/watchers';
import { Spinner, Empty, ErrorNote } from '../components/Common';
import { HeroDemo, ChaiStain, Pencil } from '../components/Desk';


function SkillRow({ skill, role }) {
  const to = role === 'owner' ? `/s/${skill.id}` : `/s/${skill.id}/guide`;
  return (
    <li>
      <Link to={to} className="skill-card">
        <span className="skill-title">{skill.title}</span>
        <span className="skill-meta">{role === 'owner' ? `round ${skill.currentRound || 1}` : 'learning'}</span>
        {skill.description && <span className="skill-desc">{skill.description}</span>}
      </Link>
    </li>
  );
}

function JoinedSkill({ skillId }) {
  const [skill] = useLive(liveSkill, [skillId]);
  if (!skill) return null;
  return <SkillRow skill={skill} role="apprentice" />;
}

export default function Home() {
  const { user } = useAuth();
  const [owned, loadingOwned] = useLive(liveOwnedSkills, [user.uid], []);
  const [joined] = useLive(liveJoinedIds, [user.uid], []);
  const sorted = [...(owned || [])].sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  const navigate = useNavigate();
  const [opening, setOpening] = useState(false);
  const [exampleError, setExampleError] = useState(null);

  // One click to a finished notebook: useful before you have an expert to interview.
  const openExample = async () => {
    const existing = sorted.find((s) => s.example);
    if (existing) { navigate(`/s/${existing.id}`); return; }
    setOpening(true);
    setExampleError(null);
    const { id, saved } = createExampleSkill(user.uid);
    const outcome = await Promise.race([
      saved.then(() => 'saved', (err) => err),
      new Promise((resolve) => { setTimeout(() => resolve('queued'), navigator.onLine ? 8000 : 500); }),
    ]);
    if (outcome instanceof Error) { setExampleError(outcome); setOpening(false); return; }
    navigate(`/s/${id}`);
  };

  return (
    <>
      <section className="desk">
        <div className="spread">
          <div className="spread-page left">
            <h1 className="hero-title">Some knowledge was never written down.</h1>
            <p className="lead">
              Unwritten interviews an expert the way a curious apprentice would, catches what they know but never say,
              and checks that a beginner can really learn it.
            </p>
            <div className="hero-actions">
              <Link to="/skills/new" className="btn btn-primary btn-large">Capture a new skill</Link>
              <button type="button" className="btn btn-large" onClick={openExample} disabled={opening}>
                {opening ? 'Opening the example…' : 'Open an example'}
              </button>
            </div>
            <p className="landing-signin">The example is an engineer&apos;s on-call fix, with a finished interview, guide and Transfer Score.</p>
            {exampleError && <ErrorNote error={exampleError} onRetry={openExample} />}
          </div>
          <div className="spine" aria-hidden="true" />
          <div className="spread-page right">
            <HeroDemo />
          </div>
        </div>
        <ChaiStain />
        <Pencil />
      </section>

      {user.isAnonymous && (
        <p className="notice small">You&apos;re using a guest account in this browser. Use <strong>Save with Google</strong> at the top so clearing your browser data doesn&apos;t lose your skills.</p>
      )}

      <section className="plain">
        <div className="section-title"><h2>Your notebook</h2></div>
        {loadingOwned ? <Spinner /> : sorted.length === 0 ? (
          <Empty title="Nothing written yet">
            Start with something someone does by instinct: a recipe, a repair, an on-call fix, a craft, a deploy only one person trusts.
          </Empty>
        ) : (
          <ul className="index-list">{sorted.map((s) => <SkillRow key={s.id} skill={s} role="owner" />)}</ul>
        )}
      </section>

      {joined?.length > 0 && (
        <section className="plain">
          <div className="section-title"><h2>Skills you&apos;re learning</h2></div>
          <ul className="index-list">{joined.map((id) => <JoinedSkill key={id} skillId={id} />)}</ul>
        </section>
      )}
    </>
  );
}
