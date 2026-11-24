// Prompt builders (pure). On-device prompts stay short: Gemini Nano runs on CPU on many laptops.

const clip = (s, n) => {
  const t = String(s || '').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

const CUE_HELP = {
  vague_quantity: 'vague amount (andaz se, a little, enough, a pinch)',
  sensory: 'sensory check (smell, look, sound, feel, texture)',
  condition: 'hidden condition (depends, in summer, if it is humid)',
  hedge: 'hedge (usually, mostly, sometimes)',
  skipped_step: 'skipped step (jumps ahead without saying how)',
  just_know: '"you just know" (by feel, by eye, experience)',
};

export function nextTurnPrompt({ skill, expert, summary, recent, answer, probed, cueTypes }) {
  const who = [expert.name, expert.relation, expert.context].filter(Boolean).join(', ');
  const history = (recent || [])
    .map((t) => `Q: ${clip(t.q, 200)}\nA: ${clip(t.a, 400)}`)
    .join('\n');
  return [
    `You are a curious apprentice learning "${clip(skill.title, 100)}" from ${clip(who, 200)}.`,
    'Your job: spot knowledge the expert uses but did not put into words, then ask about it.',
    `Cue types: ${cueTypes.map((c) => CUE_HELP[c] || c).join('; ')}.`,
    summary ? `What you have learned so far: ${clip(summary, 500)}` : '',
    history ? `Recent conversation:\n${history}` : '',
    probed?.length ? `Already asked about (never ask again): ${probed.join(', ')}.` : '',
    `Latest answer: "${clip(answer, 1200)}"`,
    'Be a polite, patient apprentice. The expert is giving their time, so:',
    '- Ask ONE short, friendly question in simple words (under 20 words). No praise, no preamble, no lists.',
    '- Only flag a cue if a beginner truly could not copy it. Exact amounts, times and named tools are NOT cues.',
    '- Prefer concrete questions: what would I see, smell, hear or feel; roughly how much; what changes it.',
    '- If the expert says they cannot explain it, do not push: ask what they do next.',
    'Return JSON with:',
    '- cues: cue phrases copied word for word from the latest answer (empty list if none).',
    '- nextQuestion: the one question, about the most important cue, or "what do you do next" if there is none.',
    '- stepLabel: 2 to 5 words naming the step being discussed.',
  ].filter(Boolean).join('\n');
}

export function distillPrompt({ skill, expert, turns }) {
  const transcript = turns.map((t) => `Q: ${clip(t.q, 200)}\nA: ${clip(t.a, 600)}`).join('\n');
  return [
    `Condense this interview about "${clip(skill.title, 100)}" with ${expert.name} into notes.`,
    'Keep the expert\'s own signals (what they look, smell or feel for) and conditions.',
    'Do not invent anything that was not said.',
    `Interview:\n${clip(transcript, 6000)}`,
    'Return JSON: summary (2 sentences), steps (action, condition, signal), unresolved (things still vague, as short phrases).',
  ].join('\n');
}

const notesBlock = (n) => [
  `Expert: ${n.expertName}${n.relation ? ` (${n.relation})` : ''}`,
  `Summary: ${n.summary}`,
  ...n.steps.map((s, i) => `${i + 1}. ${s.action}${s.condition ? ` | when: ${s.condition}` : ''}${s.signal ? ` | signal: ${s.signal}` : ''}`),
  n.unresolved?.length ? `Still vague: ${n.unresolved.join('; ')}` : '',
  ...(n.answeredGaps || []).map((g) => `Answered question "${g.q}": ${g.a}`),
].filter(Boolean).join('\n');

export function guidePrompt({ skill, notes, checkCount }) {
  return [
    `Write a beginner's guide to "${skill.title}" from these interview notes.`,
    skill.description ? `About the skill: ${clip(skill.description, 400)}` : '',
    'Rules:',
    '- Use only what the experts said. Never invent amounts, times or temperatures.',
    '- For each step give: what to do, howYouKnow (the signal that it is right), why, pitfalls, and which experts said it.',
    '- If experts differ, keep both and say when each applies.',
    '- List openGaps: anything a beginner still could not do from these notes, each with a short questionForExpert.',
    `- Write ${checkCount} checks: "What would you do if...?" scenario questions that test understanding.`,
    `Notes:\n${notes.map(notesBlock).join('\n\n')}`,
  ].filter(Boolean).join('\n');
}

export function voicesPrompt({ skill, a, b }) {
  return [
    `Compare how two experts describe "${skill.title}".`,
    'For each topic where they say something, decide:',
    '- agreed: same advice;',
    '- context: different advice that fits different situations (say which, in contextNote);',
    '- conflict: real disagreement. Keep both accounts; never average them.',
    'Quote or closely paraphrase each expert. Do not invent details.',
    `Expert A notes:\n${notesBlock(a)}`,
    `Expert B notes:\n${notesBlock(b)}`,
    `Return JSON items with topic, status, accountA (${a.expertName}), accountB (${b.expertName}), contextNote.`,
  ].join('\n');
}

export function gapsPrompt({ skill, guide, unclear, checks, confidence }) {
  const steps = (guide.steps || []).map((s, i) => `${i + 1}. ${s.title}: ${s.what} | know it by: ${s.howYouKnow}`).join('\n');
  const marks = unclear.map((u) => `- "${clip(u.line, 200)}"${u.note ? ` (apprentice: ${clip(u.note, 200)})` : ''}`).join('\n');
  const answers = checks.map((c) => `- Q: ${clip(c.q, 200)}\n  A: ${clip(c.a, 300) || '(no answer)'}`).join('\n');
  return [
    `A beginner read this guide to "${skill.title}" and tested themselves. Find what the guide failed to transfer.`,
    `Guide:\n${clip(steps, 5000)}`,
    marks ? `Lines the beginner marked unclear:\n${marks}` : 'The beginner marked no lines unclear.',
    answers ? `Scenario answers:\n${answers}` : '',
    `Beginner confidence: ${confidence}/5.`,
    'Return JSON gaps: one per real gap (an unclear line, or a wrong or unsure scenario answer).',
    'Each gap: text (what the beginner could not do), stepTitle, questionForExpert (one short question for the expert, under 20 words).',
  ].filter(Boolean).join('\n');
}
