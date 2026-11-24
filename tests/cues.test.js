import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  keywordCues, groundCues, mergeCues, templateQuestion, highlightSegments, parseJson, transferScore,
} from '../src/ai/cues.js';
import { buildNotes } from '../src/ai/notes.js';
import { nextTurnPrompt, guidePrompt } from '../src/ai/prompts.js';
import { nextTurnSchema } from '../src/ai/schemas.js';

const TYPES = ['vague_quantity', 'sensory', 'condition', 'hedge', 'skipped_step', 'just_know'];

test('keyword cues catch the classic phrases', () => {
  const cues = keywordCues('Add salt andaz se and ferment until it smells a little sour. Usually overnight.');
  const types = cues.map((c) => c.type);
  assert.ok(types.includes('vague_quantity'));
  assert.ok(types.includes('sensory'));
  assert.ok(types.includes('hedge'));
});

test('keyword cues stay quiet on plain instructions', () => {
  assert.equal(keywordCues('Soak two cups of rice for four hours.').length, 0);
});

test('"you just know" is detected', () => {
  const cues = keywordCues('You just know when the batter is ready.');
  assert.equal(cues[0].type, 'just_know');
});

test('extra Remote Config keywords are used', () => {
  const cues = keywordCues('Mix it jaldi jaldi', ['jaldi']);
  assert.equal(cues.length, 1);
  assert.equal(cues[0].phrase.toLowerCase(), 'jaldi');
});

test('groundCues drops phrases the model invented', () => {
  const answer = 'Grind it till smooth, then add salt by feel.';
  const out = groundCues(answer, [
    { phrase: 'by feel', type: 'just_know' },
    { phrase: 'two teaspoons', type: 'vague_quantity' },
    { phrase: 'till smooth', type: 'not_a_type' },
  ], TYPES);
  assert.deepEqual(out.map((c) => c.phrase), ['by feel', 'till smooth']);
  assert.equal(out[1].type, 'sensory', 'unknown type is re-typed by its words');
});

test('mergeCues keeps model cues first and adds missing rule cues', () => {
  const merged = mergeCues([{ phrase: 'by feel', type: 'just_know' }], [{ phrase: 'feel', type: 'sensory' }, { phrase: 'usually', type: 'hedge' }]);
  assert.deepEqual(merged.map((c) => c.phrase), ['by feel', 'usually']);
});

test('templateQuestion quotes the phrase', () => {
  assert.match(templateQuestion({ phrase: 'andaz se', type: 'vague_quantity' }), /andaz se/);
  assert.equal(templateQuestion(null), 'What do you do next?');
});

test('highlightSegments rebuilds the original text', () => {
  const text = 'Add salt andaz se, then wait.';
  const segs = highlightSegments(text, [{ phrase: 'andaz se', type: 'vague_quantity' }]);
  assert.equal(segs.map((s) => s.text).join(''), text);
  assert.equal(segs.filter((s) => s.cue).length, 1);
});

test('parseJson tolerates code fences and stray text', () => {
  assert.deepEqual(parseJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJson('Sure! {"a":2} done'), { a: 2 });
  assert.throws(() => parseJson('no json here'));
});

test('transferScore counts by status and round', () => {
  const s = transferScore([
    { status: 'resolved', round: 1 }, { status: 'open', round: 1 }, { status: 'asked', round: 2 },
    { status: 'needs-hands-on', round: 2 }, { status: 'resolved', round: 2 },
  ]);
  assert.equal(s.found, 5);
  assert.equal(s.resolved, 2);
  assert.equal(s.open, 2);
  assert.equal(s.handsOn, 1);
  assert.equal(s.rate, 40);
  assert.deepEqual(s.rounds, [{ round: 1, found: 2, resolved: 1 }, { round: 2, found: 3, resolved: 1 }]);
  assert.equal(transferScore([]).rate, 0);
});

test('buildNotes uses only finished, distilled sessions and credits answered gaps', () => {
  const experts = [{ id: 'e1', name: 'Paati' }, { id: 'e2', name: 'Amma' }];
  const sessions = [
    { id: 's1', expertId: 'e1', status: 'done', startedAtMs: 1, distilled: { summary: 'Soak and grind.', steps: [{ action: 'Soak rice' }], unresolved: ['a little'] } },
    { id: 's2', expertId: 'e2', status: 'live', startedAtMs: 2, distilled: null },
  ];
  const gaps = [{ status: 'resolved', answer: 'About 1 tsp', questionForExpert: 'How much salt?', resolvedInSession: 's1' }];
  const notes = buildNotes(experts, sessions, gaps);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].expertName, 'Paati');
  assert.deepEqual(notes[0].answeredGaps, [{ q: 'How much salt?', a: 'About 1 tsp' }]);
});

test('prompts stay short and carry the answer', () => {
  const p = nextTurnPrompt({
    skill: { title: 'Dosa batter' }, expert: { name: 'Paati', relation: 'grandmother' },
    summary: '', recent: [], answer: 'Add salt andaz se', probed: ['hedge'], cueTypes: TYPES,
  });
  assert.match(p, /andaz se/);
  assert.match(p, /never ask again\): hedge/);
  assert.ok(p.length < 2500);
  const g = guidePrompt({ skill: { title: 'Dosa' }, notes: [{ expertName: 'Paati', summary: 's', steps: [{ action: 'a' }], unresolved: [] }], checkCount: 3 });
  assert.match(g, /Never invent/);
});

test('nextTurn schema enum follows configured cue types', () => {
  const schema = nextTurnSchema(['sensory', 'hedge']);
  assert.deepEqual(schema.properties.cues.items.properties.type.enum, ['sensory', 'hedge']);
});

test('groundCues: specific amounts and whole-answer copies are not cues', () => {
  const T = ['vague_quantity', 'sensory', 'hedge', 'just_know', 'condition', 'skipped_step'];
  const a = 'About one spoon for each cup, dark reddish brown.';
  const out = groundCues(a, [
    { phrase: 'About one spoon for each cup', type: 'hedge' },
    { phrase: 'About one spoon for each cup, dark reddish brown', type: 'sensory' },
  ], T);
  assert.deepEqual(out, []);
});

test('groundCues strict mode keeps only rule-confirmed cues after a follow-up', () => {
  const T = ['vague_quantity', 'sensory', 'hedge', 'just_know'];
  const a = 'Dark reddish brown, like a wooden table, add a little more if weak.';
  const rules = keywordCues(a);
  const out = groundCues(a, [{ phrase: 'Dark reddish brown', type: 'sensory' }, { phrase: 'a little', type: 'vague_quantity' }], T, { strict: true, ruleCues: rules });
  assert.deepEqual(out.map((c) => c.phrase), ['a little']);
});

test('groundCues drops model cues whose words do not fit the type', () => {
  const T = ['vague_quantity', 'sensory', 'hedge', 'just_know', 'condition'];
  const a = 'Wet your hands and press down until the clay feels even.';
  const out = groundCues(a, [{ phrase: 'Wet your hands', type: 'sensory' }, { phrase: 'feels even', type: 'sensory' }, { phrase: 'press down', type: 'just_know' }], T);
  assert.deepEqual(out.map((c) => c.phrase), ['feels even']);
});

test('rules: precise "enough" ignored, sensory phrases keep their describing words', () => {
  assert.deepEqual(keywordCues('In summer 8 hours is enough.').filter((c) => c.type === 'vague_quantity'), []);
  assert.ok(keywordCues('Add water till it is enough.').some((c) => c.phrase === 'enough'));
  assert.ok(keywordCues('When it smells slightly sour and has doubled.').some((c) => c.phrase === 'smells slightly sour'));
});

test('mergeCues prefers the fuller rule phrase', () => {
  const m = mergeCues([{ phrase: 'smells', type: 'sensory' }], [{ phrase: 'smells slightly sour', type: 'sensory', by: 'rules' }]);
  assert.deepEqual(m.map((c) => c.phrase), ['smells slightly sour']);
});

test('rules: fluffy and little by little are noticed', () => {
  const c = keywordCues('Grind the dal till it is fluffy, add water little by little.');
  assert.ok(c.some((x) => x.phrase === 'fluffy'));
  assert.ok(c.some((x) => x.phrase === 'little by little'));
});

test('rules: "you get a feel for it" is tacit knowledge', () => {
  assert.ok(keywordCues('You get a feel for it.').some((c) => c.type === 'just_know'));
});
