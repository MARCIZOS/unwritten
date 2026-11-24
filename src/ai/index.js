import { cfg } from '../firebase';
import { modelFor, InferenceMode, deviceAvailability, prepareDeviceModels as prepareModels } from './models';
import { record } from './ledger';
import {
  nextTurnSchema, DISTILL_SCHEMA, GUIDE_SCHEMA, VOICES_SCHEMA, GAPS_SCHEMA,
} from './schemas';
import {
  nextTurnPrompt, distillPrompt, guidePrompt, voicesPrompt, gapsPrompt,
} from './prompts';
import {
  keywordCues, groundCues, mergeCues, parseJson,
} from './cues';

export { deviceAvailability };
export * from './cues';
export { readLedger } from './ledger';
export { buildNotes } from './notes';
export * from './interviewer';

const cueTypes = () => cfg.list('cue_types');

export async function prepareDeviceModels(onProgress) {
  await prepareModels(onProgress, [
    ['nextTurn', nextTurnSchema(cueTypes())],
    ['distill', DISTILL_SCHEMA],
  ]);
  warmUp();
}

let warmed = null;
/**
 * The first on-device prompt loads Gemini Nano into memory, which can take 20+ seconds.
 * Fire a tiny prompt in the background while the expert reads the first question,
 * so their first real answer gets a fast reply.
 */
export function warmUp() {
  if (warmed) return warmed;
  const schema = nextTurnSchema(cueTypes());
  warmed = modelFor('nextTurn', InferenceMode.ONLY_ON_DEVICE, schema)
    .generateContent('Return JSON: cues [], nextQuestion "What do you do next?", stepLabel "Start".')
    .catch(() => { warmed = null; });
  return warmed;
}

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error(`${label} timed out`), { code: 'timeout' })), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * Runs one structured call. Returns { data, source } where source is 'on_device' or 'in_cloud'
 * (read from the SDK's response.inferenceSource). Retries once if the JSON does not parse.
 */
async function generate({ task, mode, schema, prompt, skillId, timeoutMs = 60000 }) {
  const model = modelFor(task, mode, schema);
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await withTimeout(model.generateContent(prompt), timeoutMs, task);
      const source = result.response.inferenceSource || 'in_cloud';
      const data = parseJson(result.response.text());
      record(skillId, {
        task,
        source,
        promptVersion: cfg.string('prompt_version'),
        sentChars: prompt.length,
        sent: source === 'in_cloud' ? prompt.slice(0, 1500) : null,
      });
      return { data, source };
    } catch (err) {
      lastErr = err;
      // Retry once: bad JSON, or a passing hiccup (dropped connection, 429, 5xx).
      const transient = /Failed to fetch|NetworkError|\[(429|500|502|503|504)/i.test(err.message || '');
      if (attempt === 0 && transient) { await new Promise((r) => { setTimeout(r, 1500); }); continue; }
      if (err.code === 'timeout' || !/JSON/i.test(err.message)) break;
    }
  }
  throw lastErr;
}

const arr = (v) => (Array.isArray(v) ? v : []);
const s = (v) => (typeof v === 'string' ? v.trim() : '');

/* ------------------------------------------------------------------ interview */

/**
 * Reads the latest answer, finds implicit-knowledge cues and asks one follow-up.
 * Privacy: on-device only. If there is no local model, the cloud is used only when the
 * owner opted in (allowCloud); otherwise rules + question templates keep the interview going.
 */
export async function nextTurn({ skill, expert, summary, recent, answer, probed, onDevice, allowCloud, skillId, afterFollowup = false, skipModel = false }) {
  const types = cueTypes();
  const ruleCues = keywordCues(answer, cfg.list('cue_keywords')).filter((c) => types.includes(c.type));
  // The question itself is chosen by decideNext() (src/ai/interviewer.js); rules only supply cues.
  const rulesResult = (reason) => ({ cues: ruleCues, nextQuestion: '', stepLabel: '', source: 'rules', reason });

  const mode = onDevice ? InferenceMode.ONLY_ON_DEVICE : allowCloud ? InferenceMode.ONLY_IN_CLOUD : null;
  if (!mode) return rulesResult('no-model');
  // "That's it", "I already told you", "I can't explain": no follow-up will be asked, so
  // don't make the expert wait for the model.
  if (skipModel) return { ...rulesResult('not-needed'), source: 'rules' };

  if (onDevice && warmed) await Promise.race([warmed, new Promise((r) => { setTimeout(r, 15000); })]);
  try {
    const { data, source } = await generate({
      task: 'nextTurn',
      mode,
      schema: nextTurnSchema(types),
      prompt: nextTurnPrompt({ skill, expert, summary, recent, answer, probed, cueTypes: types }),
      skillId,
      timeoutMs: onDevice ? cfg.number('ondevice_timeout_ms') : 30000,
    });
    const modelCues = groundCues(answer, arr(data.cues), types, { strict: afterFollowup, ruleCues });
    const cues = mergeCues(modelCues, ruleCues);
    return {
      cues,
      nextQuestion: s(data.nextQuestion).slice(0, 300),
      stepLabel: s(data.stepLabel).slice(0, 60),
      source,
    };
  } catch (err) {
    console.warn('[UNWRITTEN] nextTurn fell back to rules', err);
    return rulesResult(err.code === 'timeout' ? 'timeout' : 'error');
  }
}

/** Condenses one session into notes. Same privacy rule as nextTurn: raw words stay local. */
export async function distillSession({ skill, expert, turns, onDevice, allowCloud, skillId }) {
  const fallback = () => ({
    data: {
      summary: '',
      steps: turns.map((t) => ({ action: t.a.slice(0, 300), condition: '', signal: '' })),
      unresolved: [...new Set(turns.flatMap((t) => (t.cues || []).map((c) => c.phrase)))].slice(0, 10),
    },
    source: 'rules',
  });
  const mode = onDevice ? InferenceMode.ONLY_ON_DEVICE : allowCloud ? InferenceMode.ONLY_IN_CLOUD : null;
  if (!mode || !turns.length) return fallback();
  try {
    const { data, source } = await generate({
      task: 'distill',
      mode,
      schema: DISTILL_SCHEMA,
      prompt: distillPrompt({ skill, expert, turns }),
      skillId,
      timeoutMs: onDevice ? cfg.number('ondevice_timeout_ms') * 3 : 60000,
    });
    return {
      data: {
        summary: s(data.summary),
        steps: arr(data.steps).map((x) => ({ action: s(x.action), condition: s(x.condition), signal: s(x.signal) })).filter((x) => x.action),
        unresolved: arr(data.unresolved).map(s).filter(Boolean).slice(0, 10),
      },
      source,
    };
  } catch (err) {
    console.warn('[UNWRITTEN] distill fell back to rules', err);
    return fallback();
  }
}

/* ------------------------------------------------------------------ cloud jobs (distilled notes only) */

export async function buildGuide({ skill, notes, skillId }) {
  const { data, source } = await generate({
    task: 'buildGuide',
    // Cloud only: if the cloud is unreachable, a clear error beats a thin on-device guide.
    mode: InferenceMode.ONLY_IN_CLOUD,
    schema: GUIDE_SCHEMA,
    prompt: guidePrompt({ skill, notes, checkCount: cfg.number('scenario_count') }),
    skillId,
  });
  return {
    guide: {
      title: s(data.title) || skill.title,
      steps: arr(data.steps).map((x) => ({
        title: s(x.title), what: s(x.what), howYouKnow: s(x.howYouKnow), why: s(x.why),
        pitfalls: s(x.pitfalls), sourceExperts: arr(x.sourceExperts).map(s).filter(Boolean),
      })).filter((x) => x.what),
      openGaps: arr(data.openGaps).map((g) => ({ text: s(g.text), stepTitle: s(g.stepTitle), questionForExpert: s(g.questionForExpert) })).filter((g) => g.text),
      checks: arr(data.checks).map(s).filter(Boolean).slice(0, 6),
    },
    source,
  };
}

export async function compareVoices({ skill, a, b, skillId }) {
  const { data, source } = await generate({
    task: 'compareVoices',
    mode: InferenceMode.ONLY_IN_CLOUD,
    schema: VOICES_SCHEMA,
    prompt: voicesPrompt({ skill, a, b }),
    skillId,
  });
  return {
    items: arr(data.items).map((x) => ({
      topic: s(x.topic),
      status: ['agreed', 'context', 'conflict'].includes(x.status) ? x.status : 'context',
      accountA: s(x.accountA), accountB: s(x.accountB), contextNote: s(x.contextNote),
    })).filter((x) => x.topic),
    source,
  };
}

/** Maps an apprentice's confusion back to questions for the expert. Falls back to the raw marks. */
export async function gapsFromTest({ skill, guide, unclear, checks, confidence, skillId }) {
  const fallback = () => unclear.map((u) => ({
    text: `Unclear: "${u.line}"${u.note ? ` — ${u.note}` : ''}`,
    stepTitle: u.stepTitle || '',
    questionForExpert: `Can you explain this more simply: "${u.line.slice(0, 120)}"?`,
  }));
  try {
    const { data, source } = await generate({
      task: 'gapsFromTest',
      mode: InferenceMode.PREFER_IN_CLOUD,
      schema: GAPS_SCHEMA,
      prompt: gapsPrompt({ skill, guide, unclear, checks, confidence }),
      skillId,
    });
    const gaps = arr(data.gaps)
      .map((g) => ({ text: s(g.text), stepTitle: s(g.stepTitle), questionForExpert: s(g.questionForExpert) }))
      .filter((g) => g.text && g.questionForExpert);
    return { gaps: gaps.length || !unclear.length ? gaps : fallback(), source };
  } catch (err) {
    console.warn('[UNWRITTEN] gapsFromTest fell back to raw marks', err);
    return { gaps: fallback(), source: 'rules' };
  }
}
