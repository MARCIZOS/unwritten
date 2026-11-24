import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSkill } from '../hooks/useSkill';
import { useLive } from '../hooks/useLive';
import { useOnline } from '../hooks/useOnline';
import { liveGuide } from '../data/watchers';
import { addGaps, addApprenticeGaps } from '../data/gaps';
import { submitTest } from '../data/tests';
import { gapsFromTest } from '../ai';
import HybridBadge from '../components/HybridBadge';
import { Spinner, Empty, ErrorNote } from '../components/Common';

/** Every sentence a beginner might trip on: each step's action and its "how you know" line. */
function guideLines(guide) {
  return (guide?.steps || []).flatMap((s, i) => [
    { key: `${i}-what`, stepTitle: s.title, kind: 'Do', line: s.what },
    ...(s.howYouKnow ? [{ key: `${i}-know`, stepTitle: s.title, kind: 'Know it by', line: s.howYouKnow }] : []),
  ]).filter((l) => l.line);
}

export default function ApprenticeTest() {
  const { skillId } = useParams();
  const { skill, loading, role, uid } = useSkill(skillId);
  const [guide, guideLoading] = useLive(liveGuide, [skillId], null);
  const online = useOnline();
  const [unclear, setUnclear] = useState({}); // key -> note
  const [answers, setAnswers] = useState({});
  const [confidence, setConfidence] = useState(3);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  if (loading || guideLoading) return <Spinner />;
  if (!skill) return <ErrorNote error={new Error('You need an invite to see this skill')} />;
  if (!guide?.steps?.length) return <Empty title="The guide isn't ready yet">Check back once the expert has built it.</Empty>;

  const lines = guideLines(guide);
  const checks = guide.checks || [];
  const toggle = (key) => setUnclear((u) => {
    const next = { ...u };
    if (key in next) delete next[key]; else next[key] = '';
    return next;
  });

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const marked = lines.filter((l) => l.key in unclear).map((l) => ({ line: l.line, stepTitle: l.stepTitle, note: unclear[l.key] }));
      const checkAnswers = checks.map((q, i) => ({ q, a: (answers[i] || '').trim() }));
      const { gaps, source } = await gapsFromTest({
        skill, guide, unclear: marked, checks: checkAnswers, confidence, skillId,
      });
      const round = skill.currentRound || 1;
      if (role === 'owner') addGaps(skillId, gaps.map((g) => ({ ...g, origin: 'apprentice', round })));
      else addApprenticeGaps(skillId, gaps.map((g) => ({ ...g, round })), uid);
      submitTest(skillId, {
        apprenticeUid: uid,
        guideId: guide.id,
        unclearLines: marked.map((m) => m.line).slice(0, 50),
        scenarioAnswers: checkAnswers,
        confidence,
        gapCount: gaps.length,
      });
      setResult({ count: gaps.length, source, gaps });
    } catch (err) {
      setError(err);
    }
    setBusy(false);
  };

  if (result) {
    return (
      <section className="plain result">
        <h1>{result.count ? `${result.count} question${result.count === 1 ? '' : 's'} sent to the expert` : 'Nothing unclear. The guide worked for you.'}</h1>
        <p className="muted">Checked <HybridBadge source={result.source} small /></p>
        {result.gaps.length > 0 && (
          <ul className="gap-list">{result.gaps.map((g, i) => <li key={i}><span className="gap-q">{g.questionForExpert}</span><span className="muted small">{g.text}</span></li>)}</ul>
        )}
        <p>They&apos;ll be asked in the next interview round. The guide gets better each time.</p>
        <Link to={`/s/${skillId}/guide`} className="btn">Back to the guide</Link>
      </section>
    );
  }

  return (
    <div className="test">
      <header className="page-head">
        <div>
          <p className="crumb">{skill.title}, the Apprentice Test</p>
          <h1>Could you do this tomorrow?</h1>
          <p className="lead-small">Tap every line you couldn&apos;t act on without asking. Be honest: each one becomes a question for the expert.</p>
        </div>
      </header>

      <section className="plain">
        <h2>1. Mark what&apos;s unclear</h2>
        <ul className="test-lines">
          {lines.map((l) => {
            const marked = l.key in unclear;
            return (
              <li key={l.key} className={marked ? 'is-marked' : ''}>
                <button type="button" className="test-line" onClick={() => toggle(l.key)} aria-pressed={marked}>
                  <span className="test-kind">{l.kind}</span>
                  <span>{l.line}</span>
                  <span className="test-mark">{marked ? 'unclear!' : 'clear?'}</span>
                </button>
                {marked && (
                  <input className="input" placeholder="What's missing? (optional)" value={unclear[l.key]}
                    onChange={(e) => setUnclear({ ...unclear, [l.key]: e.target.value })} maxLength={300} />
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {checks.length > 0 && (
        <section className="plain">
          <h2>2. What would you do?</h2>
          {checks.map((q, i) => (
            <label key={i} className="field">
              <span>{q}</span>
              <textarea className="input" rows={2} value={answers[i] || ''} onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })} placeholder="Your answer, or 'not sure'" maxLength={600} />
            </label>
          ))}
        </section>
      )}

      <section className="plain">
        <h2>{checks.length ? '3' : '2'}. How confident are you?</h2>
        <div className="confidence" role="radiogroup" aria-label="Confidence from 1 to 5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={confidence === n} className={`conf ${confidence === n ? 'is-on' : ''}`} onClick={() => setConfidence(n)}>{n}</button>
          ))}
        </div>
        <p className="muted small">1 = I&apos;d need the expert next to me · 5 = I could do it alone</p>
      </section>

      <ErrorNote error={error} onRetry={online && !busy ? submit : null} />
      {!online && <p className="notice">You&apos;re offline. Submitting needs internet.</p>}
      <button type="button" className="btn btn-primary btn-large" onClick={submit} disabled={busy || !online}>
        {busy ? 'Finding the gaps…' : 'Submit to the expert'}
      </button>
    </div>
  );
}
