// Pure helpers (no Firebase): keyword cue detection, question templates, highlighting.
// These run on every answer alongside the model, and alone when no model is available.

export const CUE_LABELS = {
  vague_quantity: 'vague amount',
  sensory: 'sensory check',
  condition: 'hidden condition',
  hedge: 'hedge',
  skipped_step: 'skipped step',
  just_know: '"you just know"',
};

// Precision matters more than recall here: a false flag means an annoying, pointless question.
const SENSORY = /\b(smell\w*|sound\w*|taste\w*|colou?r|texture|sticky|golden|sour|crisp\w*|fluffy|airy|runny|foamy|frothy|springy|rang|khushboo|(?<!i |we |you )feels?(?! like)|looks? (right|done|ready|good|shiny|glossy|thick|thin)|until (it|the \w+) (looks|smells|sounds|feels|turns|matches|changes|becomes)( \w+)?)\b/i;
const CONDITION = /\b(depends|depending|if it'?s|in (summer|winter|monsoon|the rain\w*)|when it'?s (hot|cold|humid|wet|dry)|unless|after the first \w+)\b/i;
const HEDGE = /\b(usually|mostly|sometimes|generally|normally|often|roughly)\b/i;
const JUST_KNOW = /\b(just know|get a feel( for)?|by feel|by eye|by ear|by hand|by instinct|by experience|comes with (practice|experience)|you get used|you'?ll know|you can tell|i can tell|automatically|andaza)\b/i;
const VAGUE = /\b(andaa?z(e)?( se)?|a little|a bit|enough|a pinch|a handful|thoda( sa)?|zara|zyada|a while|until done|as needed|to taste|lightly|gently|little by little|bit by bit|thodi thodi|not too (much|hard|long|soft|tight|loose)|a few)\b/i;

const RULES = [
  ['just_know', JUST_KNOW],
  ['vague_quantity', VAGUE],
  ['condition', CONDITION],
  ['sensory', SENSORY],
  ['hedge', HEDGE],
];

/**
 * Finds cue phrases with rules plus the Remote Config keyword list.
 * Returns [{ phrase, type, why, by: 'rules' }], at most one per type, in priority order.
 */
const STOP = new Set(['and', 'it', 'is', 'the', 'a', 'an', 'then', 'so', 'but', 'to', 'of', 'when', 'if', 'you', 'i', 'we', 'has', 'have', 'was', 'with', 'for', 'or', 'like']);
const NUMBERISH = /\d|\b(one|two|three|four|five|six|seven|eight|nine|ten|half|twice|once|hours?|minutes?)\b/i;

/** "smells" -> "smells slightly sour": a sensory word plus up to two describing words after it. */
function extendSensory(text, index, phrase) {
  const after = text.slice(index + phrase.length).match(/^(\s+[A-Za-z\u0900-\u097f'-]+){0,2}/)?.[0] || '';
  const extra = [];
  for (const w of after.trim().split(/\s+/).filter(Boolean)) {
    if (STOP.has(w.toLowerCase())) break;
    extra.push(w.replace(/[.,;:!?]+$/, ''));
    if (/[.,;:!?]$/.test(w)) break;
  }
  return extra.length ? `${phrase} ${extra.join(' ')}` : phrase;
}

export function keywordCues(answer, extraKeywords = []) {
  const text = String(answer || '');
  const found = [];
  const seenTypes = new Set();
  for (const [type, re] of RULES) {
    const m = text.match(re);
    if (!m || seenTypes.has(type)) continue;
    let phrase = m[0];
    if (type === 'vague_quantity' && /^enough$/i.test(phrase)) {
      // "8 hours is enough" is precise; only flag "enough" when no amount is given nearby.
      const clause = text.slice(0, m.index + phrase.length).split(/[,;.]/).pop();
      if (NUMBERISH.test(clause)) continue;
    }
    if (type === 'sensory' && phrase.split(/\s+/).length === 1) phrase = extendSensory(text, m.index, phrase);
    found.push({ phrase, type, why: `"${phrase}" hides a judgment a beginner can't copy`, by: 'rules' });
    seenTypes.add(type);
  }
  const lower = text.toLowerCase();
  for (const kw of extraKeywords) {
    const k = kw.toLowerCase();
    if (!k || !lower.includes(k)) continue;
    if (found.some((c) => c.phrase.toLowerCase().includes(k) || k.includes(c.phrase.toLowerCase()))) continue;
    const start = lower.indexOf(k);
    found.push({ phrase: text.slice(start, start + k.length), type: 'just_know', why: 'flagged keyword', by: 'rules' });
  }
  return found;
}

// A model-suggested cue must contain a word that fits its type; otherwise Nano tends to flag
// plain instructions ("wet your hands") and the expert gets a pointless question.
const TYPE_HINTS = {
  vague_quantity: /\b(little|bit|some|enough|few|much|many|more|less|pinch|handful|andaa?z|thoda|zyada|zara|lightly|gently|slightly|roughly|approx\w*|taste|while|amount)\b/i,
  sensory: /\b(feel\w*|look\w*|smell\w*|sound\w*|tast\w*|colou?r\w*|textur\w*|soft|hard|smooth|rough|sticky|crisp\w*|golden|brown|sour|sweet|thick|thin|shiny|glossy|warm|hot|cold|bubbl\w*|noise|click\w*|wobbl\w*|even|rang)\b/i,
  condition: /\b(if|when|depend\w*|unless|summer|winter|monsoon|rain\w*|weather|humid\w*|season\w*|otherwise)\b/i,
  hedge: /\b(usually|mostly|sometimes|generally|normally|often|roughly|maybe|probably)\b/i,
  just_know: /\b(know|tell|feel|experience|practice|instinct|eye|ear|hand|used to|automatic\w*|sense)\b/i,
  skipped_step: /./,
};

const SPECIFIC = /\d|\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|half|quarter|dozen|once|twice|hundred)\b/i;

/**
 * Keeps only cues a beginner really could not copy:
 *  - the phrase must appear in the answer (drops model hallucinations),
 *  - short (a cue is a phrase, not the whole answer),
 *  - not a specific amount or count ("one spoon per cup" is an answer, not a gap).
 * `strict`: after a follow-up the expert is clarifying, so only cues the rules also see survive.
 */
export function groundCues(answer, cues, allowedTypes, { strict = false, ruleCues = [] } = {}) {
  const lower = String(answer || '').toLowerCase();
  const out = [];
  for (const c of cues || []) {
    const phrase = String(c?.phrase || '').trim().replace(/[.,;:!?]+$/, '');
    if (!phrase || phrase.length > 60 || phrase.split(/\s+/).length > 6) continue;
    if (!lower.includes(phrase.toLowerCase())) continue;
    if (SPECIFIC.test(phrase)) continue;
    if (strict && !ruleCues.some((r) => r.phrase.toLowerCase().includes(phrase.toLowerCase()) || phrase.toLowerCase().includes(r.phrase.toLowerCase()))) continue;
    let type = allowedTypes.includes(c.type) ? c.type : null;
    if (!c.by) {
      // Unknown or ill-fitting type: re-type it by its words, or drop it.
      if (!type || (TYPE_HINTS[type] && !TYPE_HINTS[type].test(phrase))) {
        type = allowedTypes.find((t) => t !== 'skipped_step' && TYPE_HINTS[t]?.test(phrase)) || null;
      }
      if (!type) continue;
    }
    type ||= 'just_know';
    if (out.some((o) => o.phrase.toLowerCase() === phrase.toLowerCase())) continue;
    out.push({ phrase, type, why: String(c.why || '').slice(0, 200) });
  }
  return out;
}

/** Model cues first, then rule cues that add a phrase the model missed. A longer rule phrase
 * ("smells slightly sour") replaces the model's shorter one ("smells"). */
export function mergeCues(primary, secondary) {
  const out = [...primary];
  for (const c of secondary) {
    const p = c.phrase.toLowerCase();
    const i = out.findIndex((o) => o.phrase.toLowerCase().includes(p) || p.includes(o.phrase.toLowerCase()));
    if (i < 0) out.push(c);
    else if (p.length > out[i].phrase.length && p.includes(out[i].phrase.toLowerCase())) out[i] = { ...out[i], phrase: c.phrase };
  }
  return out;
}

const TEMPLATES = {
  vague_quantity: (p) => `When you say "${p}", how do you know it's the right amount?`,
  sensory: (p) => `What exactly are you checking for with "${p}"?`,
  condition: (p) => `What do you do differently when "${p}"?`,
  hedge: (p) => `You said "${p}". When is it not like that?`,
  skipped_step: () => `What happens just before that step?`,
  just_know: (p) => `If a beginner tried "${p}", what would they get wrong?`,
};

export function templateQuestion(cue) {
  if (!cue) return 'What do you do next?';
  return (TEMPLATES[cue.type] || TEMPLATES.just_know)(cue.phrase);
}

/** Splits text into [{ text, cue? }] segments so the UI can underline cue phrases. */
export function highlightSegments(text, cues) {
  const src = String(text || '');
  const ranges = [];
  const lower = src.toLowerCase();
  for (const c of cues || []) {
    const i = lower.indexOf(String(c.phrase).toLowerCase());
    if (i < 0) continue;
    const end = i + c.phrase.length;
    if (ranges.some((r) => i < r.end && end > r.start)) continue;
    ranges.push({ start: i, end, cue: c });
  }
  ranges.sort((a, b) => a.start - b.start);
  const out = [];
  let pos = 0;
  for (const r of ranges) {
    if (r.start > pos) out.push({ text: src.slice(pos, r.start) });
    out.push({ text: src.slice(r.start, r.end), cue: r.cue });
    pos = r.end;
  }
  if (pos < src.length) out.push({ text: src.slice(pos) });
  return out;
}

/** Parses model output that should be JSON, tolerating ```json fences. */
export function parseJson(text) {
  const cleaned = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error('Model did not return JSON');
  }
}

/**
 * Transfer Score from gap list: found, resolved, hands-on, open, per round.
 */
export function transferScore(gaps) {
  const list = gaps || [];
  const by = (s) => list.filter((g) => g.status === s).length;
  const rounds = {};
  for (const g of list) {
    const r = g.round || 1;
    rounds[r] ??= { round: r, found: 0, resolved: 0 };
    rounds[r].found += 1;
    if (g.status === 'resolved') rounds[r].resolved += 1;
  }
  const found = list.length;
  const resolved = by('resolved');
  return {
    found,
    resolved,
    handsOn: by('needs-hands-on'),
    open: by('open') + by('asked'),
    rate: found ? Math.round((resolved / found) * 100) : 0,
    rounds: Object.values(rounds).sort((a, b) => a.round - b.round),
  };
}
