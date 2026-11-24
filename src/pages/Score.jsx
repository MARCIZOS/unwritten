import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useSkill } from '../hooks/useSkill';
import { useLive } from '../hooks/useLive';
import { liveGaps, liveSessions, liveAllTests, liveExperts } from '../data/watchers';
import { updateGap } from '../data/gaps';
import { updateSkill } from '../data/skills';
import { transferScore } from '../ai/cues';
import PrivacyPanel from '../components/PrivacyPanel';
import { Spinner, Empty } from '../components/Common';

const STATUS_LABEL = { open: 'Open', asked: 'Asked', resolved: 'Filled in', 'needs-hands-on': 'Learn by watching' };
const ORIGIN_LABEL = { apprentice: 'from the apprentice', interview: 'from the interview' };

/** One tally stroke per gap, bundled in fives the way people count by hand. */
function Tallies({ gaps }) {
  const order = { resolved: 0, 'needs-hands-on': 1, asked: 2, open: 2 };
  // Round N+1 = go back to the expert with the gaps. Prefer whoever was interviewed last.
  const startNextRound = () => {
    updateSkill(skillId, { title: skill.title, currentRound: round + 1 });
    const expertId = sessions[0]?.expertId || experts[0]?.id;
    navigate(expertId ? `/s/${skillId}/interview/${expertId}` : `/s/${skillId}`);
  };
  const sorted = [...gaps].sort((a, b) => order[a.status] - order[b.status]);
  const groups = [];
  for (let i = 0; i < sorted.length; i += 5) groups.push(sorted.slice(i, i + 5));
  return (
    <div className="tallies" role="img" aria-label={`${gaps.length} gaps found, ${gaps.filter((g) => g.status === 'resolved').length} filled in`}>
      {groups.map((g, i) => (
        <span key={i} className={`tally-group ${g.length === 5 ? 'is-five' : ''}`}>
          {g.slice(0, g.length === 5 ? 4 : 5).map((gap) => (
            <span key={gap.id} className={`tally ${gap.status === 'resolved' ? 'is-resolved' : gap.status === 'needs-hands-on' ? 'is-hands' : ''}`} />
          ))}
        </span>
      ))}
    </div>
  );
}

export default function Score() {
  const { skillId } = useParams();
  const { skill, loading, role } = useSkill(skillId);
  const [gaps] = useLive(liveGaps, [skillId], []);
  const [sessions] = useLive(liveSessions, [skillId], []);
  const [tests] = useLive(liveAllTests, [skillId], []);
  const [experts] = useLive(liveExperts, [skillId], []);
  const navigate = useNavigate();

  if (loading) return <Spinner />;
  if (!skill) return <Empty title="This skill isn't available" />;
  if (role !== 'owner') return <Navigate to={`/s/${skillId}/guide`} replace />;

  const score = transferScore(gaps);
  const maxFound = Math.max(1, ...score.rounds.map((r) => r.found));
  const avgConf = tests.length ? (tests.reduce((n, t) => n + (t.confidence || 0), 0) / tests.length).toFixed(1) : null;
  const round = skill.currentRound || 1;
  // Round N+1 = go back to the expert with the gaps. Prefer whoever was interviewed last.
  const startNextRound = () => {
    updateSkill(skillId, { title: skill.title, currentRound: round + 1 });
    const expertId = sessions[0]?.expertId || experts[0]?.id;
    navigate(expertId ? `/s/${skillId}/interview/${expertId}` : `/s/${skillId}`);
  };
  const sorted = [...gaps].sort((a, b) => (a.status === 'resolved') - (b.status === 'resolved') || b.createdAtMs - a.createdAtMs);

  return (
    <>
      <header className="page-head">
        <div>
          <p className="crumb"><Link to={`/s/${skillId}`}>{skill.title}</Link>, Transfer Score</p>
          <h1>{score.found ? `${score.found} gaps found, ${score.resolved} filled in` : 'No gaps found yet'}</h1>
          <p className="lead-small">A gap is something a beginner couldn&apos;t do from the guide. It&apos;s filled in once the expert puts it into words.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={startNextRound}
          disabled={score.open === 0 || !experts.length} title={score.open === 0 ? 'No open questions to ask' : 'Starts the next round and opens an interview with these questions first'}>
          Ask the expert: round {round + 1} ({Math.min(score.open, 3)} question{Math.min(score.open, 3) === 1 ? '' : 's'})
        </button>
      </header>

      <section className="plain score-top">
        <div className="score-big">
          {score.rate}%
          <small>of the gaps filled in</small>
        </div>
        <div>
          {gaps.length ? <Tallies gaps={gaps} /> : <p className="muted">Run an interview or an Apprentice Test to find the first gaps.</p>}
          <div className="tally-key">
            <span><i style={{ background: 'var(--red)' }} />still open ({score.open})</span>
            <span><i style={{ background: 'var(--ink)' }} />filled in ({score.resolved})</span>
            <span><i style={{ background: 'var(--haldi)' }} />learn by watching ({score.handsOn})</span>
            <span>{tests.length} apprentice test{tests.length === 1 ? '' : 's'}{avgConf ? `, average confidence ${avgConf} of 5` : ''}</span>
          </div>
        </div>
      </section>

      {score.rounds.length > 0 && (
        <section className="plain">
          <div className="section-title"><h2>Round by round</h2></div>
          <div className="rounds">
            {score.rounds.map((r) => (
              <div key={r.round} className="round-row">
                <span className="round-name">round {r.round}</span>
                <div className="round-bars">
                  <span className="bar bar-found" style={{ width: `${(r.found / maxFound) * 100}%` }}>{r.found} found</span>
                  <span className="bar bar-resolved" style={{ width: `${(r.resolved / maxFound) * 100}%` }}>{r.resolved > 0 ? `${r.resolved} filled in` : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="plain">
        <div className="section-title"><h2>Every gap</h2></div>
        <p className="muted small">Some things can&apos;t be put into words. Mark them &ldquo;learn by watching&rdquo; so the apprentice knows to watch the expert do it.</p>
        {sorted.length === 0 ? <Empty title="No gaps yet">Run an interview or an Apprentice Test.</Empty> : (
          <ul className="gap-list">
            {sorted.map((g) => (
              <li key={g.id} className={`gap gap-${g.status}`}>
                <div className="row between wrap">
                  <span className="gap-q">{g.questionForExpert || g.text}</span>
                  <span className="row gap">
                    <span className="small muted">{ORIGIN_LABEL[g.origin] || g.origin}, round {g.round}</span>
                    <select className="input select small" value={g.status} onChange={(e) => updateGap(skillId, g.id, { status: e.target.value })}
                      aria-label="Gap status">
                      {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </span>
                </div>
                <span className="muted small">{g.text}</span>
                {g.answer && <p className="gap-answer">“{g.answer}”</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <PrivacyPanel skillId={skillId} sessions={sessions} />
    </>
  );
}
