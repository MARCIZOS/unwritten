import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLive } from '../hooks/useLive';
import { liveOwnedSkills, liveJoinedIds, liveSkill } from '../data/watchers';
import { Spinner, Empty } from '../components/Common';
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
            <Link to="/skills/new" className="btn btn-primary btn-large">Capture a new skill</Link>
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
