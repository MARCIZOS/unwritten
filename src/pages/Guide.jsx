import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSkill } from '../hooks/useSkill';
import { useLive } from '../hooks/useLive';
import { useOnline } from '../hooks/useOnline';
import { liveExperts, liveSessions, liveGaps, liveGuide } from '../data/watchers';
import { saveGuide } from '../data/guides';
import { addGaps } from '../data/gaps';
import { buildGuide, compareVoices, buildNotes } from '../ai';
import HybridBadge from '../components/HybridBadge';
import { Spinner, Empty, ErrorNote } from '../components/Common';

const STATUS_TEXT = { agreed: 'Agreed', context: 'Depends on the situation', conflict: 'They disagree' };

function StepCard({ step, index }) {
  return (
    <li className="step-card">
      <h3>{step.title || `Step ${index + 1}`}</h3>
      <p>{step.what}</p>
      {step.howYouKnow && <div className="know"><span className="know-label">how you know it&apos;s right</span><p>{step.howYouKnow}</p></div>}
      {step.why && <p className="step-extra"><strong>Why:</strong> {step.why}</p>}
      {step.pitfalls && <p className="step-extra"><strong>What goes wrong:</strong> {step.pitfalls}</p>}
      {step.sourceExperts?.length > 0 && <p className="step-extra">From {step.sourceExperts.join(' and ')}</p>}
    </li>
  );
}

function VoicesCard({ item, aName, bName }) {
  return (
    <article className="voices-card">
      <div className="row between">
        <h3>{item.topic}</h3>
        <span className={`voices-status status-${item.status}`}>{STATUS_TEXT[item.status]}</span>
      </div>
      <div className="voices-pair">
        <blockquote><span className="voice-name">{aName}</span>{item.accountA}</blockquote>
        <blockquote><span className="voice-name">{bName}</span>{item.accountB}</blockquote>
      </div>
      {item.contextNote && <p className="small context-note">{item.contextNote}</p>}
    </article>
  );
}

export default function Guide() {
  const { skillId } = useParams();
  const { skill, loading, role, error: skillError } = useSkill(skillId);
  const [experts] = useLive(liveExperts, [skillId], []);
  const [sessions] = useLive(liveSessions, [skillId], []);
  const [gaps] = useLive(liveGaps, [skillId], []);
  const [guide, guideLoading] = useLive(liveGuide, [skillId], null);
  const online = useOnline();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [pair, setPair] = useState({ a: '', b: '' });
  const [lastAction, setLastAction] = useState(null);

  const notes = useMemo(() => buildNotes(experts, sessions, gaps), [experts, sessions, gaps]);

  if (loading || guideLoading) return <Spinner />;
  if (!skill) return <ErrorNote error={skillError || new Error('You need an invite to see this skill')} />;
  const owner = role === 'owner';

  const build = async () => {
    setLastAction('guide');
    setBusy('guide');
    setError(null);
    try {
      const { guide: g, source } = await buildGuide({ skill, notes, skillId });
      saveGuide(skillId, { ...g, voices: guide?.voices || null, source, builtFrom: notes.flatMap((n) => n.sessionIds) });
      const existing = new Set(gaps.map((x) => x.text.toLowerCase()));
      addGaps(skillId, g.openGaps
        .filter((x) => !existing.has(x.text.toLowerCase()))
        .map((x) => ({ ...x, origin: 'interview', round: skill.currentRound || 1 })));
    } catch (err) {
      setError(err);
    }
    setBusy(null);
  };

  const aId = pair.a || notes[0]?.expertId;
  const bId = pair.b || notes.find((n) => n.expertId !== aId)?.expertId;
  const a = notes.find((n) => n.expertId === aId);
  const b = notes.find((n) => n.expertId === bId);

  const compare = async () => {
    if (!a || !b || a === b) return;
    setLastAction('voices');
    setBusy('voices');
    setError(null);
    try {
      const { items, source } = await compareVoices({ skill, a, b, skillId });
      // eslint-disable-next-line no-unused-vars
      const { id, createdAt, createdAtMs, ...base } = guide || { title: skill.title, steps: [], openGaps: [], checks: [] };
      saveGuide(skillId, { ...base, voices: { aName: a.expertName, bName: b.expertName, items, source } });
    } catch (err) {
      setError(err);
    }
    setBusy(null);
  };

  return (
    <>
      <header className="page-head">
        <div>
          <p className="crumb">{owner ? <Link to={`/s/${skillId}`}>{skill.title}</Link> : skill.title}, the guide</p>
          <h1>{guide?.title || skill.title}</h1>
          {guide && <p className="muted small">Written {new Date(guide.createdAtMs).toLocaleString()} <HybridBadge source={guide.source} small /></p>}
        </div>
        <div className="row gap wrap">
          {owner && (
            <button type="button" className="btn btn-primary" onClick={build} disabled={!online || !notes.length || busy}
              title={!online ? 'Needs internet' : !notes.length ? 'Finish an interview session first' : ''}>
              {busy === 'guide' ? 'Writing in the cloud…' : guide ? 'Rebuild guide' : 'Build guide'}
            </button>
          )}
          {guide?.steps?.length > 0 && <Link to={`/s/${skillId}/test`} className="btn">{owner ? 'Preview Apprentice Test' : 'Take the Apprentice Test'}</Link>}
        </div>
      </header>

      {owner && !online && <p className="notice">You&apos;re offline. Interviews keep working; building the guide needs internet.</p>}
      {owner && notes.length > 0 && (
        <p className="muted small">The cloud model sees only distilled notes from {notes.length} expert{notes.length === 1 ? '' : 's'}, never the raw interview.</p>
      )}
      <ErrorNote error={error} onRetry={online && !busy ? () => (lastAction === 'voices' ? compare() : build()) : null} />

      {busy === 'guide' && (!guide || !guide.steps?.length) ? (
        <section className="plain"><Empty title="Writing your guide…">Turning the interview notes into steps. This usually takes under a minute.</Empty></section>
      ) : !guide || !guide.steps?.length ? (
        <section className="plain">
          <Empty title="No guide yet">
            {!owner ? 'The expert hasn\'t written the guide yet. Check back soon.'
              : notes.length ? `Notes from ${notes.length} expert${notes.length === 1 ? '' : 's'} are ready. Press Build guide.`
                : 'Finish an interview session first, then build the guide.'}
          </Empty>
        </section>
      ) : (
        <section className="sheet"><ol className="steps">{guide.steps.map((s, i) => <StepCard key={i} step={s} index={i} />)}</ol></section>
      )}

      <section className="plain">
        <div className="section-title wrap">
          <h2>Two voices</h2>
          {owner && notes.length >= 2 && (
            <div className="row gap wrap">
              <select className="input select" value={aId} onChange={(e) => setPair({ ...pair, a: e.target.value })}>
                {notes.map((n) => <option key={n.expertId} value={n.expertId}>{n.expertName}</option>)}
              </select>
              <span className="muted">vs</span>
              <select className="input select" value={bId} onChange={(e) => setPair({ ...pair, b: e.target.value })}>
                {notes.map((n) => <option key={n.expertId} value={n.expertId}>{n.expertName}</option>)}
              </select>
              <button type="button" className="btn" onClick={compare} disabled={!online || busy || aId === bId}>
                {busy === 'voices' ? 'Comparing…' : 'Compare'}
              </button>
            </div>
          )}
        </div>
        <p className="muted small">When experts differ, both accounts are kept and credited, never averaged into one.</p>
        {guide?.voices?.items?.length ? (
          <div className="voices">{guide.voices.items.map((it, i) => <VoicesCard key={i} item={it} aName={guide.voices.aName} bName={guide.voices.bName} />)}</div>
        ) : (
          <Empty title={notes.length >= 2 ? 'Not compared yet' : 'Needs two experts'}>
            {notes.length >= 2 ? 'Compare two experts to see where they agree and differ.' : 'Interview a second expert to compare their versions.'}
          </Empty>
        )}
      </section>
    </>
  );
}
