import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decideNext, detectSignal, cleanQuestion, rankCues, newStep, newHistory, SUGGEST_FINISH_AFTER, MAX_QUESTION_WORDS,
} from '../src/ai/interviewer.js';
import { keywordCues } from '../src/ai/cues.js';
import { CORPUS } from './corpus.js';

const cue = (phrase, type) => ({ phrase, type });

/** Runs a scripted interview; `model(answer, i)` fakes the nextTurn result. */
function simulate(answers, { model = (a) => ({ cues: keywordCues(a), nextQuestion: '', stepLabel: '' }), gaps = [] } = {}) {
  let step = newStep();
  let history = newHistory();
  let question = { text: 'What is the first thing you do?', kind: 'opener' };
  history.askedQuestions.push(question.text);
  const log = [];
  let queue = [...gaps];
  answers.forEach((a, i) => {
    const out = decideNext({ answer: a, question, result: model(a, i), step, history, gapQueue: queue, turnIndex: i });
    if (out.question.kind === 'gap') queue = queue.filter((g) => g.id !== out.question.gapId);
    log.push({ answer: a, ...out });
    ({ step, history, question } = out);
  });
  return log;
}

test('signals: frustration, cannot explain, done, short', () => {
  assert.equal(detectSignal('I already told you, add it by feel'), 'frustrated');
  assert.equal(detectSignal("Honestly it's hard to explain, you have to see it"), 'cant_explain');
  assert.equal(detectSignal('pata nahi, bas ho jata hai'), 'cant_explain');
  assert.equal(detectSignal('Honestly you just have to taste it, I cannot explain.'), 'cant_explain');
  assert.equal(detectSignal('It is difficult to describe'), 'cant_explain');
  assert.equal(detectSignal("That's it."), 'done');
  assert.equal(detectSignal('ok'), 'too_short');
  assert.equal(detectSignal('No.'), 'too_short');
  assert.equal(detectSignal('About 2 spoons'), null);
  assert.equal(detectSignal('Grind until it feels smooth'), null);
});

test('cleanQuestion keeps one short question', () => {
  assert.equal(cleanQuestion('Great answer! How much salt is "andaz se"?'), 'How much salt is "andaz se"?');
  assert.equal(cleanQuestion('What does it smell like? And how long?'), 'What does it smell like?');
  assert.equal(cleanQuestion('Tell me more about that.'), null);
  assert.equal(cleanQuestion(`Could you ${'please '.repeat(30)}explain?`), null);
  assert.equal(cleanQuestion(''), null);
  assert.equal(cleanQuestion('why?'), null);
});

test('rankCues drops echoes, repeats and weak hedges', () => {
  const r = rankCues([cue('usually', 'hedge'), cue('right amount', 'vague_quantity'), cue('smells', 'sensory')],
    { question: 'How do you know it is the right amount?', askedPhrases: ['smells'] });
  assert.deepEqual(r.map((c) => c.phrase), ['usually'], 'only the hedge survives; decideNext limits it further');
  const r2 = rankCues([cue('usually', 'hedge'), cue('by feel', 'just_know')]);
  assert.deepEqual(r2.map((c) => c.phrase), ['by feel']);
  assert.deepEqual(rankCues([cue('usually', 'hedge')]).map((c) => c.phrase), ['usually']);
});

test('never more than 2 follow-ups in a row, then moves on politely', () => {
  const answers = [
    'Add salt andaz se.',
    'A little, by feel.',
    'Until it smells right.',
    'Then it tastes a bit sour.',
  ];
  const log = simulate(answers);
  let run = 0; let maxRun = 0;
  for (const l of log) { run = l.question.kind === 'followup' ? run + 1 : 0; maxRun = Math.max(maxRun, run); }
  assert.ok(maxRun <= 2, `follow-up run was ${maxRun}`);
  assert.equal(log[2].question.kind, 'next-step');
  assert.ok(log[2].ack.length > 0, 'moving on is acknowledged');
});

test('no question is ever repeated in a long session, even if the model repeats itself', () => {
  const answers = Array.from({ length: 20 }, (_, i) => (i % 2 ? 'Add a little salt by feel.' : 'Then I stir it.'));
  const log = simulate(answers, { model: (a) => ({ cues: keywordCues(a), nextQuestion: 'How much is a little salt?', stepLabel: '' }) });
  const followups = log.filter((l) => l.question.kind === 'followup').map((l) => l.question.text.toLowerCase());
  assert.equal(new Set(followups).size, followups.length, `repeated follow-up: ${followups.join(' | ')}`);
  for (let i = 1; i < log.length; i += 1) assert.notEqual(log[i].question.text, log[i - 1].question.text);
  const phrases = log.filter((l) => l.question.cue).map((l) => l.question.cue.phrase.toLowerCase());
  assert.equal(new Set(phrases).size, phrases.length, 'same phrase asked about twice');
});

test('"I can\'t explain" after a follow-up becomes a learn-by-doing note', () => {
  const log = simulate(['Knead it until it feels right.', "I can't really explain, you have to feel it."]);
  assert.equal(log[0].question.kind, 'followup');
  assert.equal(log[1].handsOn, log[0].question.cue.phrase);
  assert.notEqual(log[1].question.kind, 'followup');
  assert.match(log[1].ack, /learn by watching/);
});

test('irritation stops probing with a short apology', () => {
  const log = simulate(['Add it andaz se.', 'I already told you, andaz se, by feel!']);
  assert.equal(log[1].question.kind, 'next-step');
  assert.match(log[1].ack, /Sorry/);
});

test('a one-word reply to a follow-up is accepted, not drilled', () => {
  const log = simulate(['Fry until golden and crisp.', 'Yes.']);
  assert.equal(log[0].question.kind, 'followup');
  assert.notEqual(log[1].question.kind, 'followup');
});

test('a lone hedge gets at most one question, never right after another follow-up', () => {
  const log = simulate(['I usually start in the morning.', 'Sometimes at night.']);
  assert.equal(log[0].question.kind, 'followup');
  assert.notEqual(log[1].question.kind, 'followup');
});

test('"that\'s it" asks one closing question, then stops asking about it', () => {
  const log = simulate(["That's it.", "That's all.", 'Nothing else.']);
  assert.equal(log[0].question.kind, 'closing');
  assert.equal(log[1].question.kind, 'last');
  assert.equal(log[2].question.kind, 'wrap');
});

test('apprentice questions are asked when moving on', () => {
  const gaps = [{ id: 'g1', questionForExpert: 'What does slightly sour smell like?', text: 'x' }];
  const log = simulate(['Soak rice for 6 hours.'], { gaps });
  assert.equal(log[0].question.kind, 'gap');
  assert.equal(log[0].question.gapId, 'g1');
});

test('suggests finishing after a long session', () => {
  const log = simulate(Array.from({ length: SUGGEST_FINISH_AFTER }, () => 'Then I stir for 2 minutes.'));
  assert.equal(log.at(-1).suggestFinish, true);
  assert.equal(log[3].suggestFinish, false);
});

test('a model question that is long, multi-part or off-topic is replaced', () => {
  const log = simulate(['Add sugar to taste.'], {
    model: () => ({ cues: [cue('to taste', 'vague_quantity')], nextQuestion: `Interesting! ${'Very '.repeat(30)}long question?`, stepLabel: 'Sweeten' }),
  });
  assert.equal(log[0].question.kind, 'followup');
  assert.ok(log[0].question.text.split(' ').length <= MAX_QUESTION_WORDS);
  assert.match(log[0].question.text, /to taste/);
});

test('every skill in the corpus produces short, single, non-repeating questions', () => {
  const bySkill = {};
  CORPUS.forEach((c) => { (bySkill[c.skill] ||= []).push(c.a); });
  for (const [skill, answers] of Object.entries(bySkill)) {
    const log = simulate(answers);
    const texts = log.map((l) => l.question.text);
    texts.forEach((t) => {
      assert.ok(t.endsWith('?'), `${skill}: not a question: ${t}`);
      assert.ok(t.split(/\s+/).length <= MAX_QUESTION_WORDS, `${skill}: too long: ${t}`);
      assert.equal((t.match(/\?/g) || []).length, 1, `${skill}: more than one question: ${t}`);
    });
    for (let i = 1; i < texts.length; i += 1) assert.notEqual(texts[i], texts[i - 1], `${skill}: repeated back to back`);
  }
});

test('a second cue from the same answer is asked before moving on', () => {
  const log = simulate(['Add tea leaves andaz se and boil until the colour looks right.', 'One spoon per cup.']);
  assert.equal(log[0].question.kind, 'followup');
  assert.equal(log[1].question.kind, 'followup', 'should ask about the colour next');
  assert.match(log[1].question.text, /colour/);
});

test('quoted phrases read naturally', async () => {
  const { templateFor } = await import('../src/ai/interviewer.js');
  const q = templateFor({ phrase: 'until the colour looks right', type: 'sensory' }, 1);
  assert.match(q, /"the colour looks right"/);
  assert.doesNotMatch(templateFor({ phrase: 'to taste', type: 'vague_quantity' }, 2), /more or less than/);
});

test('moving on never reuses the model\'s probing question', () => {
  const log = simulate(['Then I add milk.'], {
    model: () => ({ cues: [], nextQuestion: 'What does it smell like when it is brewing?', stepLabel: '' }),
  });
  assert.equal(log[0].question.kind, 'next-step');
  assert.doesNotMatch(log[0].question.text, /smell/);
});

test('closing question leads to wrap-up, not back into steps', () => {
  const log = simulate(["That's it.", 'They make it too strong.', 'No, nothing else.']);
  assert.equal(log[0].question.kind, 'closing');
  assert.equal(log[1].question.kind, 'last');
  assert.equal(log[1].suggestFinish, true);
  assert.equal(log[2].question.kind, 'wrap');
  assert.match(log[2].question.text, /Finish session/);
});

test('answering a follow-up with a new step can be followed up, but never more than 3 in a row', () => {
  const answers = [
    'Grind the dal till it is fluffy, add water little by little.',
    'Slowly. Then mix both, add salt andaz se and leave it overnight.',
    'A pinch. Then in summer keep it outside, in winter near the stove.',
    'Near the warm stove. Then when it smells slightly sour it is ready.',
  ];
  const labels = ['Grinding', 'Mixing', 'Fermenting', 'Checking'];
  const log = simulate(answers, { model: (a, i) => ({ cues: keywordCues(a), nextQuestion: '', stepLabel: labels[i] }) });
  let run = 0; let max = 0;
  for (const l of log) { run = l.question.kind === 'followup' ? run + 1 : 0; max = Math.max(max, run); }
  assert.ok(max <= 3, `run of ${max}`);
  assert.equal(log[1].question.kind, 'followup', 'new step inside a follow-up answer is noticed');
});

test('gap questions read as one clean question whatever the notes contain', async () => {
  const { gapQuestion } = await import('../src/ai/interviewer.js');
  assert.equal(gapQuestion("What constitutes an 'off' lag?"), "What constitutes an 'off' lag?");
  assert.equal(gapQuestion('a bit'), 'What exactly do you mean by "a bit"?');
  assert.equal(gapQuestion('Exact timeframe of business hours for the team'), 'Exact timeframe of business hours for the team?');
});
