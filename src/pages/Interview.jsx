import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { cfg } from '../firebase';
import { useSkill } from '../hooks/useSkill';
import { useLive } from '../hooks/useLive';
import { useDevice } from '../hooks/DeviceContext';
import { useOnline } from '../hooks/useOnline';
import { liveExperts, liveGaps } from '../data/watchers';
import { startSession, saveTurns, finishSession } from '../data/sessions';
import { updateGap, addGaps } from '../data/gaps';
import {
  nextTurn, distillSession, highlightSegments, decideNext, skipQuestion, detectSignal, newStep, newHistory, cleanQuestion,
  warmUp, gapQuestion,
} from '../ai';
import HybridBadge from '../components/HybridBadge';
import CueChip, { Highlighted } from '../components/CueChip';
import { Spinner, ErrorNote } from '../components/Common';

const stepSummary = (turns) => {
  const steps = [...new Set(turns.map((t) => t.step).filter(Boolean))];
  return steps.length ? `Steps covered: ${steps.join(', ')}` : '';
};

const opener = (skill) => `Let's start at the very beginning. What is the first thing you do for "${skill.title}"?`;
const MAX_ANSWER = 4000;

// Catch-up questions from earlier rounds per session: more than this feels like a quiz.
const MAX_GAP_QUESTIONS = 3;

export default function Interview() {
  const { skillId, expertId } = useParams();
  const navigate = useNavigate();
  const { skill, loading, role } = useSkill(skillId);
  const [experts] = useLive(liveExperts, [skillId], []);
  const [gaps] = useLive(liveGaps, [skillId], []);
  const device = useDevice();
  const online = useOnline();

  const [sessionId, setSessionId] = useState(null);
  const [turns, setTurns] = useState([]);
  const [question, setQuestion] = useState(null); // { text, kind, cue?, gapId?, source? }
  const [ack, setAck] = useState('');
  const [suggestFinish, setSuggestFinish] = useState(false);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [allowCloud, setAllowCloud] = useState(false);
  const [askedGapIds, setAskedGapIds] = useState([]);
  const [error, setError] = useState(null);
  const stepRef = useRef(newStep());
  const historyRef = useRef(newHistory());
  const bottomRef = useRef(null);

  const expert = experts.find((e) => e.id === expertId);
  const gapQueue = useMemo(() => {
    const open = gaps
      .filter((g) => (g.status === 'open' || g.status === 'asked') && !askedGapIds.includes(g.id))
      // The apprentice's questions can go to any expert; follow-ups from an interview go back
      // to the same expert (asking Priya what Ravi meant by "a bit" makes no sense).
      .filter((g) => g.origin === 'apprentice' || !g.expertId || g.expertId === expertId)
      // The apprentice's own questions first: they are proof the guide didn't work.
      .sort((a, b) => (a.origin === 'apprentice' ? 0 : 1) - (b.origin === 'apprentice' ? 0 : 1) || a.createdAtMs - b.createdAtMs);
    return open.slice(0, Math.max(0, MAX_GAP_QUESTIONS - askedGapIds.length));
  }, [gaps, askedGapIds]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [turns.length, question]);

  // Load Gemini Nano into memory while the interviewer reads the checklist, so the
  // first answer doesn't wait 20+ seconds for a cold start.
  useEffect(() => { if (device.status === 'available') warmUp(); }, [device.status]);

  if (loading) return <Spinner />;
  if (!skill) return <ErrorNote error={new Error('Skill not found')} />;
  if (role !== 'owner') return <Navigate to={`/s/${skillId}/guide`} replace />;
  if (!expert) return <Spinner label="Loading expert…" />;

  const onDevice = device.status === 'available';
  const noModel = !onDevice && !(allowCloud && online);

  const markAsked = (gapId) => {
    setAskedGapIds((ids) => [...ids, gapId]);
    updateGap(skillId, gapId, { status: 'asked' });
  };

  const start = async () => {
    setError(null);
    // The click is the user gesture Chrome needs to start or load the on-device model.
    if (device.status !== 'unsupported' && device.status !== 'unavailable') {
      await device.prepare();
    }
    const id = startSession(skillId, expertId, skill.currentRound || 1);
    setSessionId(id);
    const g = gapQueue[0];
    const first = g
      ? { text: cleanQuestion(g.questionForExpert) || g.questionForExpert || g.text, kind: 'gap', gapId: g.id, gapOrigin: g.origin }
      : { text: opener(skill), kind: 'opener' };
    if (g) markAsked(g.id);
    historyRef.current = { ...newHistory(), askedQuestions: [first.text] };
    setQuestion(first);
  };

  const submit = async (e) => {
    e?.preventDefault();
    const a = answer.trim();
    if (!a || busy || !question) return;
    setBusy(true);
    setError(null);

    if (question.gapId) {
      updateGap(skillId, question.gapId, { status: 'resolved', answer: a.slice(0, 1000), resolvedInSession: sessionId });
    }

    const result = await nextTurn({
      skill,
      expert,
      summary: stepSummary(turns),
      recent: turns.slice(-3),
      answer: a,
      probed: historyRef.current.askedPhrases.slice(-8),
      onDevice,
      allowCloud: allowCloud && online,
      skillId,
      afterFollowup: question.kind === 'followup',
      skipModel: ['done', 'frustrated', 'cant_explain', 'too_short'].includes(detectSignal(a))
        || ['closing', 'last', 'wrap'].includes(question.kind),
    });

    const decision = decideNext({
      answer: a,
      question,
      result,
      step: stepRef.current,
      history: historyRef.current,
      gapQueue,
      maxFollowups: cfg.number('max_followups_per_step'),
      turnIndex: turns.length,
    });
    stepRef.current = decision.step;
    historyRef.current = decision.history;

    if (decision.handsOn) recordHandsOn(decision.handsOn);
    const next = { ...decision.question, source: decision.question.kind === 'followup' || decision.question.kind === 'next-step' ? result.source : null };
    if (next.gapId) next.gapOrigin = gaps.find((g) => g.id === next.gapId)?.origin;
    if (next.gapId) markAsked(next.gapId);

    // Don't show a chip for a word that only echoes our own question ("colour" after
    // "how would a beginner recognise the colour?").
    const shownCues = result.cues.filter((c) => !question.text.toLowerCase().includes(c.phrase.toLowerCase()));
    const turn = {
      q: question.text,
      a: a.slice(0, MAX_ANSWER),
      cues: shownCues,
      source: result.source,
      step: result.stepLabel || decision.step.label || '',
      at: Date.now(),
      ...(question.gapId ? { gapId: question.gapId, gapOrigin: question.gapOrigin || 'interview' } : {}),
      ...(result.reason ? { fallback: result.reason } : {}),
    };
    const updated = [...turns, turn].slice(-200);
    setTurns(updated);
    saveTurns(skillId, sessionId, updated);
    setAck(decision.ack);
    setSuggestFinish(decision.suggestFinish);
    setQuestion(next);
    setAnswer('');
    setBusy(false);
  };

  // "They can't put it into words": note it for learning by watching, and move on without pushing.
  const recordHandsOn = (phrase) => {
    addGaps(skillId, [{
      expertId,
      text: `Learn by watching: "${phrase}"`,
      questionForExpert: `Show the apprentice "${phrase}" in person.`,
      origin: 'interview',
      round: skill.currentRound || 1,
      status: 'needs-hands-on',
    }]);
  };

  const cantExplain = () => {
    if (question?.cue) recordHandsOn(question.cue.phrase);
    moveOn("No problem, I'll note that as something to learn by watching.");
  };

  const moveOn = (ackText = '') => {
    const decision = skipQuestion({ history: historyRef.current, gapQueue, turnIndex: turns.length });
    stepRef.current = decision.step;
    historyRef.current = decision.history;
    if (decision.question.gapId) {
      markAsked(decision.question.gapId);
      decision.question.gapOrigin = gaps.find((g) => g.id === decision.question.gapId)?.origin;
    }
    setAck(ackText);
    setQuestion(decision.question);
  };

  const skip = () => moveOn('');

  const finish = async () => {
    setFinishing(true);
    setError(null);
    try {
      const { data, source } = await distillSession({
        skill, expert, turns, onDevice, allowCloud: allowCloud && online, skillId,
      });
      finishSession(skillId, sessionId, { distilled: data, distillSource: source });
      const existing = new Set(gaps.map((g) => g.text.toLowerCase()));
      const newGaps = data.unresolved
        .filter((u) => !existing.has(`still vague: ${u}`.toLowerCase()))
        .map((u) => ({
          text: `Still vague: ${u}`,
          questionForExpert: gapQuestion(u),
          origin: 'interview',
          round: skill.currentRound || 1,
          expertId,
        }));
      addGaps(skillId, newGaps);
      navigate(`/s/${skillId}`);
    } catch (err) {
      setError(err);
      setFinishing(false);
    }
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e);
  };

  const cueCount = turns.reduce((n, t) => n + t.cues.length, 0);

  return (
    <div className="interview">
      <header className="page-head">
        <div>
          <p className="crumb"><Link to={`/s/${skillId}`}>{skill.title}</Link>, round {skill.currentRound || 1}</p>
          <h1>Interviewing {expert.name}</h1>
          {expert.context && <p className="muted">{expert.context}</p>}
        </div>
        {sessionId && (
          <div className="row gap">
            <span className="session-meta">{turns.length} answers, {cueCount} things unsaid</span>
            <button type="button" className="btn" onClick={finish} disabled={finishing || busy || turns.length === 0}>
              {finishing ? 'Writing notes…' : 'Finish session'}
            </button>
          </div>
        )}
      </header>

      {!sessionId ? (
        <section className="plain">
          <h2>Before you start</h2>
          <ul className="start-list">
            <li>Sit with {expert.name}. Read each question aloud and type the answer in their own words.</li>
            <li>Keep the casual phrases, like “a bit”, “by feel”, “when it looks right” or “you just know”. Those are what the apprentice listens for.</li>
            <li>{onDevice
              ? 'Answers are read by the AI on this laptop, so you can switch Wi-Fi off.'
              : device.status === 'downloadable' || device.status === 'downloading'
                ? 'Start interview downloads Chrome\'s on-device AI (about 4 GB) the first time.'
                : 'This browser has no on-device AI. Choose cloud AI below, or carry on with keyword rules only.'}
            </li>
            {gapQueue.length > 0 && <li>The apprentice has <strong>{gapQueue.length} question{gapQueue.length === 1 ? '' : 's'}</strong> from last time; they come first.</li>}
          </ul>
          {!onDevice && (
            <label className="toggle">
              <input type="checkbox" checked={allowCloud} onChange={(e) => setAllowCloud(e.target.checked)} />
              <span>Use cloud AI for this interview (answers are sent to Gemini in the cloud)</span>
            </label>
          )}
          {device.status === 'downloading' && device.progress != null && (
            <div className="progress"><span style={{ width: `${Math.round(device.progress * 100)}%` }} /></div>
          )}
          <button type="button" className="btn btn-primary btn-large" onClick={start}>Start interview</button>
        </section>
      ) : (
        <div className="sheet">
          <ol className="transcript">
            {turns.map((t, i) => (
              <li key={t.at} className="turn sheet-row">
                <div className="margin-col">
                  {t.cues.map((c) => <CueChip key={c.phrase} cue={c} />)}
                  <HybridBadge source={t.source} small />
                </div>
                <div>
                  <p className="turn-q"><span className="turn-num">{i + 1}.</span>{t.q}{t.gapId && <span className="tag"> {t.gapOrigin === 'apprentice' ? '(the apprentice asked this)' : '(follow-up from last time)'}</span>}</p>
                  <p className="turn-a"><Highlighted segments={highlightSegments(t.a, t.cues)} /></p>
                </div>
              </li>
            ))}
          </ol>

          <form className="ask sheet-row" onSubmit={submit}>
            <div className="margin-col">
              {question?.source && <HybridBadge source={question.source} small />}
              {question?.gapId && <span className="tag">{question.gapOrigin === 'apprentice' ? 'from the apprentice' : 'from last time'}</span>}
            </div>
            <div>
              {ack && <p className="ack">{ack}</p>}
              <p className="question">{question?.text}</p>
              {suggestFinish && (
                <p className="notice small">That&apos;s plenty of detail. Press <strong>Finish session</strong> whenever you like.</p>
              )}
              <textarea
                className="input answer"
                rows={4}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={onKey}
                maxLength={MAX_ANSWER}
                placeholder={`${expert.name}'s answer, in their own words…`}
                aria-label={`${expert.name}'s answer`}
                disabled={busy}
                autoFocus
              />
              {(noModel || answer.length > MAX_ANSWER * 0.8) && (
                <p className="small muted">
                  {noModel ? 'No AI model in use: keyword rules spot the gaps and simple templates ask the follow-ups. ' : ''}
                  {answer.length > MAX_ANSWER * 0.8 ? `${answer.length}/${MAX_ANSWER} characters` : ''}
                </p>
              )}
              <div className="ask-actions">
                <span className="row gap wrap">
                  <button type="button" className="btn btn-ghost btn-small" onClick={skip} disabled={busy}>Skip question</button>
                  {question?.kind === 'followup' && (
                    <button type="button" className="btn btn-ghost btn-small" onClick={cantExplain} disabled={busy} title="Saves it as something to learn by watching, and moves on">
                      Can&apos;t put it into words
                    </button>
                  )}
                </span>
                {busy
                  ? <span className="thinking" role="status">{onDevice ? 'The apprentice is reading on this laptop' : 'The apprentice is reading'}</span>
                  : <button type="submit" className="btn btn-primary" disabled={!answer.trim()}>Next (Ctrl + Enter)</button>}
              </div>
            </div>
          </form>
          <ErrorNote error={error} onRetry={!finishing && turns.length ? finish : null} />
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
