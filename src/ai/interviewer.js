// Pure interview pacing logic (no Firebase): decides the next question so the interview feels
// like a polite, curious apprentice, never an interrogation.
//
// Rules that keep it pleasant for the expert:
//  1. At most `maxFollowups` follow-ups on one step, then move on.
//  2. Never ask about the same phrase twice, never repeat a question.
//  3. Ignore cue words that just echo our own question.
//  4. Hedges ("usually") are only worth asking about when nothing better was said.
//  5. "I can't explain it" / "you have to see it" ends the probing: it becomes a learn-by-doing note.
//  6. Signs of irritation ("I already told you") end the probing with a short apology.
//  7. A very short reply to a follow-up is accepted; we don't drill.
//  8. Questions are one sentence, short, and the wording rotates so it never sounds robotic.
//  9. After a long session we suggest stopping instead of asking forever.

export const CUE_PRIORITY = ['just_know', 'vague_quantity', 'sensory', 'condition', 'skipped_step', 'hedge'];
export const MAX_QUESTION_WORDS = 25;
export const SUGGEST_FINISH_AFTER = 15;

const CANT_EXPLAIN = /\b(don'?t know how to (say|explain|describe)|(can'?t|cannot|can not|couldn'?t) (really )?(explain|describe|say|put it|tell you)|hard to (explain|say|describe|put)|difficult to (explain|say|describe)|(have|need|got) to (see|watch|feel|do|try|taste|smell|hear|touch) it|only (by|with) (doing|practice|experience)|no idea|not sure how|pata nahi|nahi bata|samjha nahi|dekh ke|karke dekho|it just happens)\b/i;
const FRUSTRATED = /\b(already (told|said|answered|explained)|i (just )?(said|told you)|told you|same (thing|as (before|i said))|stop asking|too many questions|why do you keep|asked (that|this) (already|before)|bata (diya|to diya))\b/i;
const DONE = /^(that'?s (it|all)|nothing (else|more)|that is all|bas( itna)?( hi)?|done|finished|i'?m done)[.! ]*$/i;

export const ACKS = ['Got it.', 'That helps.', 'Makes sense.', 'Thank you.', 'Understood.'];
export const NEXT_STEP_QUESTIONS = [
  'What do you do after that?',
  'What comes next?',
  "What's the next step?",
  'And after that?',
];
export const CLOSING_QUESTION = 'What do beginners usually get wrong with this?';
export const LAST_QUESTION = 'Is there anything else a beginner should know?';
export const MAX_FOLLOWUP_RUN = 3;
export const WRAP_TEXT = 'Add anything else here, or press Finish session when you are done.';

const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean);
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9ऀ-ॿ ]+/g, ' ').replace(/\s+/g, ' ').trim();
const pick = (list, i) => list[((i % list.length) + list.length) % list.length];

export function detectSignal(answer) {
  const a = String(answer || '').trim();
  if (FRUSTRATED.test(a)) return 'frustrated';
  if (CANT_EXPLAIN.test(a)) return 'cant_explain';
  if (DONE.test(a)) return 'done';
  const w = words(a);
  if (w.length <= 2 && !/\d/.test(a)) return 'too_short';
  return null;
}

/** Keeps the first question sentence, trims it, and rejects anything long or not a question. */
export function cleanQuestion(q) {
  let t = String(q || '').replace(/\s+/g, ' ').trim().replace(/^["'“]|["'”]$/g, '');
  if (!t) return null;
  const qm = t.indexOf('?');
  if (qm >= 0) t = t.slice(0, qm + 1);
  else return null;
  // Drop a leading statement before the question ("Great answer! How...?" -> "How...?")
  const parts = t.split(/(?<=[.!])\s+/);
  t = parts[parts.length - 1];
  if (words(t).length > MAX_QUESTION_WORDS || words(t).length < 3) return null;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const TEMPLATES = {
  vague_quantity: [
    (p) => `When you say "${p}", how much is that roughly?`,
    (p) => `How would I know I've got "${p}" right?`,
    (p) => `If you had to guess, how much is "${p}"?`,
  ],
  sensory: [
    (p) => `When you say "${p}", what exactly should I notice?`,
    (p) => `How would a beginner recognise "${p}"?`,
    (p) => `What is it like just before "${p}"?`,
  ],
  condition: [
    (p) => (/^depend/i.test(p) ? 'What does it depend on?'
      : /^in /i.test(p) ? `What changes ${p.toLowerCase()}?` : `What do you do differently ${p.toLowerCase()}?`),
    (p) => (/^depend/i.test(p) ? 'What makes you decide one way or the other?'
      : /^in /i.test(p) ? `What do you do differently ${p.toLowerCase()}?` : `How is it different ${p.toLowerCase()}?`),
  ],
  hedge: [
    () => 'When do you do it differently?',
    () => 'What would make you change that?',
  ],
  just_know: [
    () => 'What would you tell a beginner to watch for?',
    () => 'What would a beginner probably get wrong here?',
    () => 'What told you it was right the last time you did it?',
  ],
  skipped_step: [
    () => 'What happens just before that?',
  ],
};

/** "until the colour looks right" reads better quoted as "the colour looks right". */
export function quotable(phrase) {
  return String(phrase || '').trim().replace(/^(until|till|jab tak)\s+/i, '').replace(/[.,!?;:]+$/, '');
}

export function templateFor(cue, turnIndex = 0) {
  if (!cue) return pick(NEXT_STEP_QUESTIONS, turnIndex);
  return pick(TEMPLATES[cue.type] || TEMPLATES.just_know, turnIndex)(quotable(cue.phrase));
}

export function rankCues(cues, { question = '', askedPhrases = [] } = {}) {
  const asked = new Set(askedPhrases.map(norm));
  const q = norm(question);
  const fresh = (cues || []).filter((c) => {
    const p = norm(c.phrase);
    return p && !asked.has(p) && !q.includes(p);
  });
  const ranked = fresh.sort((a, b) => CUE_PRIORITY.indexOf(a.type) - CUE_PRIORITY.indexOf(b.type));
  // A hedge is only worth a question when nothing stronger was said.
  return ranked.length > 1 ? ranked.filter((c) => c.type !== 'hedge') : ranked;
}

export const newStep = (label = '') => ({ label, probed: [], followups: 0, pending: [] });
export const newHistory = () => ({ askedQuestions: [], askedPhrases: [], closingAsked: false, followupRun: 0, wrapUp: false });

/**
 * Decides the next question.
 * input: { answer, question (what we just asked, {text, kind, cue?}), result (from nextTurn: cues,
 *   nextQuestion, stepLabel), step, history, gapQueue, maxFollowups, turnIndex }
 * returns: { question: {text, kind, cue?, gapId?}, ack, step, history, handsOn?, suggestFinish }
 */
export function decideNext({
  answer, question = {}, result = {}, step = newStep(), history = newHistory(),
  gapQueue = [], maxFollowups = 2, turnIndex = 0, forceMoveOn = false,
}) {
  const signal = forceMoveOn ? null : detectSignal(answer);
  const hist = {
    askedQuestions: [...history.askedQuestions],
    askedPhrases: [...history.askedPhrases],
    closingAsked: history.closingAsked,
    followupRun: history.followupRun || 0,
    wrapUp: history.wrapUp || false,
  };
  let st = { ...step, probed: [...(step.probed || [])], pending: [...(step.pending || [])] };
  let ack = '';
  let handsOn = null;

  const label = String(result.stepLabel || '').trim();
  // The expert often answers a follow-up and carries on to the next step ("...then mix both").
  // A new step label resets the per-step budget, but never past MAX_FOLLOWUP_RUN in a row.
  const substantive = words(answer).length >= 6;
  if (label && norm(label) !== norm(st.label)
    && (question.kind !== 'followup' || (substantive && hist.followupRun < MAX_FOLLOWUP_RUN))) st = newStep(label);

  const isDup = (text) => hist.askedQuestions.some((q) => norm(q) === norm(text));

  const moveOn = () => {
    st = newStep();
    if (gapQueue.length) {
      const g = gapQueue[0];
      return { text: cleanQuestion(g.questionForExpert) || g.questionForExpert || g.text, kind: 'gap', gapId: g.id };
    }
    // When moving on we always use our own neutral wording: the model tends to keep probing
    // the same detail ("what does it smell like...?"), which is exactly what annoys experts.
    for (let i = 0; i < NEXT_STEP_QUESTIONS.length; i += 1) {
      const t = pick(NEXT_STEP_QUESTIONS, turnIndex + i);
      if (!hist.askedQuestions.slice(-2).some((q) => norm(q) === norm(t))) return { text: t, kind: 'next-step' };
    }
    return { text: pick(NEXT_STEP_QUESTIONS, turnIndex), kind: 'next-step' };
  };

  let next;
  if (forceMoveOn) {
    next = moveOn();
  } else if (signal === 'frustrated') {
    ack = "Sorry, let's move on.";
    next = moveOn();
  } else if (signal === 'cant_explain') {
    if (question.kind === 'followup' && question.cue) handsOn = question.cue.phrase;
    ack = handsOn ? "No problem, I'll note that as something to learn by watching." : 'No problem.';
    next = moveOn();
  } else if (question.kind === 'closing') {
    ack = 'Thank you, that is really useful.';
    hist.wrapUp = true;
    next = { text: LAST_QUESTION, kind: 'last' };
  } else if (question.kind === 'last' || question.kind === 'wrap' || (hist.wrapUp && signal === 'done')) {
    ack = question.kind === 'wrap' ? 'Noted, thank you.' : 'Thank you, that was really helpful.';
    next = { text: WRAP_TEXT, kind: 'wrap' };
  } else if (signal === 'done') {
    if (!hist.closingAsked) {
      hist.closingAsked = true;
      ack = 'Thank you.';
      next = { text: CLOSING_QUESTION, kind: 'closing' };
    } else {
      ack = 'Thank you, that was really helpful.';
      next = moveOn();
    }
  } else {
    // Cues from this answer first, then ones left over from earlier in the same step.
    const ranked = rankCues([...(result.cues || []), ...st.pending], { question: question.text, askedPhrases: hist.askedPhrases })
      .filter((c, i, all) => all.findIndex((x) => norm(x.phrase) === norm(c.phrase)) === i);
    const cue = ranked.find((c) => !st.probed.includes(c.type));
    const shortReplyToFollowup = signal === 'too_short' && question.kind === 'followup';
    const hedgeOnlyAfterProbe = cue?.type === 'hedge' && st.followups > 0;
    const tooManyInARow = hist.followupRun >= MAX_FOLLOWUP_RUN;
    if (cue && st.followups < maxFollowups && !shortReplyToFollowup && !hedgeOnlyAfterProbe && !tooManyInARow) {
      const model = cleanQuestion(result.nextQuestion);
      const modelAboutCue = model && ranked.some((c) => norm(model).includes(norm(c.phrase)));
      let text = modelAboutCue && !isDup(model) ? model : templateFor(cue, turnIndex);
      if (isDup(text)) text = templateFor(cue, turnIndex + 1);
      st.probed.push(cue.type);
      st.followups += 1;
      st.pending = ranked.filter((c) => c !== cue).slice(0, 3);
      next = { text, kind: 'followup', cue };
    } else {
      ack = pick(ACKS, turnIndex);
      next = moveOn();
    }
  }

  if (next.cue) hist.askedPhrases.push(next.cue.phrase);
  hist.followupRun = next.kind === 'followup' ? hist.followupRun + 1 : 0;
  if (next.kind !== 'wrap') hist.askedQuestions.push(next.text);
  return {
    question: next,
    ack,
    step: st,
    history: hist,
    handsOn,
    suggestFinish: hist.wrapUp || turnIndex + 1 >= SUGGEST_FINISH_AFTER,
  };
}

/** Expert or interviewer chose to skip: move on to an apprentice question or the next step. */
export function skipQuestion({ history = newHistory(), gapQueue = [], turnIndex = 0 }) {
  return decideNext({
    answer: '', question: { kind: 'skip' }, result: { cues: [] }, step: newStep(), history, gapQueue, turnIndex, forceMoveOn: true,
  });
}

/** Turns an item from the session notes into one clean question. Gemini Nano sometimes writes
 * a whole question ("What counts as off lag?"), sometimes just a phrase ("a bit"). */
export function gapQuestion(item) {
  const t = String(item || '').trim().replace(/^["'“]|["'”]$/g, '');
  if (/\?$/.test(t)) return t;
  if (t.split(/\s+/).length > 6) return `${t.replace(/[.!]+$/, '')}?`;
  return `What exactly do you mean by "${t}"?`;
}
