import { collection, doc, setDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { fire, randomCode } from './util';

// A ready-made notebook so a first-time visitor (or a judge without Gemini Nano) can see every
// stage of the loop in one click. Everything is stamped "example": no model produced it.

const SRC = 'example';
const cue = (phrase, type, why) => ({ phrase, type, why, source: SRC });

const RAVI_TURNS = [
  {
    q: 'Let\'s start at the very beginning. What is the first thing you do for "Handling the payment-queue alert"?',
    a: 'First I open the queue dashboard. If the graph looks off, I bump the workers a bit.',
    cues: [cue('looks off', 'sensory', 'Off in what way?'), cue('bump the workers a bit', 'vague_quantity', 'How many workers?')],
    step: 'Reading the dashboard',
  },
  {
    q: 'When you bump the workers a bit, from how many to how many?',
    a: 'Normally we run 4 consumers. I go to 8, never more than 12, because the database connection pool is 50.',
    cues: [],
    step: 'Scaling the workers',
  },
  {
    q: 'How would a beginner recognise that the graph "looks off"?',
    a: 'Queue depth climbing for more than 5 minutes while the processed-per-second line stays flat. Unless it is month-end, then it is normal till about 2 a.m.',
    cues: [cue('Unless it is month-end', 'condition', 'A hidden exception.')],
    step: 'Spotting a real backlog',
  },
  {
    q: 'What do you do if scaling up does not drain the queue?',
    a: 'Then I restart the stuck consumer. You get a feel for which one is stuck.',
    cues: [cue('You get a feel for which one', 'just_know', 'How do you pick it?')],
    step: 'Restarting a consumer',
  },
  {
    q: 'What is it like when a consumer is stuck?',
    a: 'Honestly, I can\'t put it into words. Shadow me on the next incident.',
    cues: [],
    step: 'Restarting a consumer',
  },
].map((t, i) => ({ ...t, source: SRC, at: 1700000000000 + i * 60000 }));

const RAVI_NOTES = {
  summary: 'Check the queue dashboard, scale consumers from 4 to 8 (max 12), then restart a stuck consumer if the backlog stays.',
  steps: [
    { action: 'Open the payments queue dashboard', condition: '', signal: 'depth climbing 5+ minutes while processed/sec stays flat' },
    { action: 'Scale consumers from 4 to 8, never above 12', condition: 'unless it is month-end before 2 a.m.', signal: 'depth starts falling within 3 minutes' },
    { action: 'Restart the stuck consumer', condition: 'if scaling does not drain the queue', signal: '' },
  ],
  unresolved: ['which consumer is stuck'],
};

const GUIDE = {
  title: 'Handling the payment-queue alert',
  source: SRC,
  steps: [
    {
      title: 'Confirm it is a real backlog',
      what: 'Open the payments queue dashboard and compare queue depth with processed per second.',
      howYouKnow: 'Depth has climbed for more than 5 minutes while processed per second stays flat.',
      why: 'Short spikes clear on their own; a flat processing line means consumers are not keeping up.',
      pitfalls: 'At month-end the queue is high until about 2 a.m. That is normal: do not scale.',
      sourceExperts: ['Ravi', 'Priya'],
    },
    {
      title: 'Scale the consumers',
      what: 'Raise consumers from 4 to 8. Never go above 12.',
      howYouKnow: 'Queue depth starts falling within about 3 minutes.',
      why: 'The database connection pool is 50; more than 12 consumers starves the API.',
      pitfalls: 'Scaling to 20 "to be safe" takes the checkout API down with it.',
      sourceExperts: ['Ravi'],
    },
    {
      title: 'Restart a stuck consumer',
      what: 'If depth is still climbing after scaling, restart the stuck consumer.',
      howYouKnow: 'Learn by watching: shadow Ravi on the next incident to see how he spots the stuck one.',
      why: '',
      pitfalls: '',
      sourceExperts: ['Ravi'],
    },
  ],
  openGaps: [],
  checks: [
    'What would you do if the queue is high at 11 p.m. on the last day of the month?',
    'What would you do if depth is still rising 10 minutes after scaling to 8?',
  ],
  voices: {
    aName: 'Ravi',
    bName: 'Priya',
    source: SRC,
    items: [
      { topic: 'How far to scale', status: 'conflict', accountA: 'Up to 8, never above 12.', accountB: 'Straight to 12 if it is a weekday peak.', contextNote: '' },
      { topic: 'Month-end backlog', status: 'agreed', accountA: 'Normal until about 2 a.m.', accountB: 'Normal, leave it alone.', contextNote: '' },
      { topic: 'Restart or wait', status: 'context', accountA: 'Restart the stuck consumer.', accountB: 'Wait 10 minutes first.', contextNote: 'Priya waits during deploys, when consumers restart themselves.' },
    ],
  },
};

const GAPS = [
  { text: 'Unclear: processed per second stays flat', questionForExpert: 'Flat compared with what? What number is normal at night?', origin: 'apprentice', round: 1, status: 'resolved', answer: 'Around 300 a second at night. Below 50 for five minutes is "flat".' },
  { text: 'Unclear: scale the consumers', questionForExpert: 'Where exactly do you change the consumer count?', origin: 'apprentice', round: 1, status: 'resolved', answer: 'In the deploy console, payments-worker, replicas field.' },
  { text: 'Still vague: which consumer is stuck', questionForExpert: 'Show the apprentice how you spot the stuck consumer.', origin: 'interview', round: 1, status: 'needs-hands-on' },
  { text: 'Unclear: month-end', questionForExpert: 'Does month-end mean the last calendar day or the last working day?', origin: 'apprentice', round: 2, status: 'open' },
];

/** Creates the example skill for this user and returns its id. Writes go in order: skill first. */
export function createExampleSkill(uid) {
  const skill = doc(collection(db, 'skills'));
  const now = Date.now();
  const sub = (name) => doc(collection(db, 'skills', skill.id, name));
  const ravi = sub('experts');
  const priya = sub('experts');
  const session = sub('sessions');

  const writes = [
    fire(setDoc(skill, {
      title: 'Handling the payment-queue alert (example)',
      description: 'An example notebook with sample answers, so you can see every step. Capture a new skill to interview your own expert.',
      ownerUid: uid,
      inviteCode: randomCode(),
      currentRound: 2,
      example: true,
      createdAt: serverTimestamp(),
      createdAtMs: now,
    }), 'create example skill'),
    fire(setDoc(ravi, { name: 'Ravi', relation: 'senior SRE', context: 'on call for payments for six years', createdAt: serverTimestamp(), createdAtMs: now }), 'add expert'),
    fire(setDoc(priya, { name: 'Priya', relation: 'platform lead', context: '', createdAt: serverTimestamp(), createdAtMs: now + 1 }), 'add expert'),
    fire(setDoc(session, {
      expertId: ravi.id, round: 1, status: 'done', turns: RAVI_TURNS, summary: RAVI_NOTES.summary,
      distilled: RAVI_NOTES, distillSource: SRC, startedAt: serverTimestamp(), startedAtMs: now, finishedAtMs: now,
    }), 'add example session'),
    fire(setDoc(sub('guides'), { ...GUIDE, builtFrom: [session.id], createdAt: serverTimestamp(), createdAtMs: now }), 'add example guide'),
  ];
  const batch = writeBatch(db);
  GAPS.forEach((g, i) => batch.set(sub('gaps'), { stepTitle: '', ...g, ...(g.origin === 'interview' ? { expertId: ravi.id } : {}), createdAtMs: now + i }));
  writes.push(fire(batch.commit(), 'add example gaps'));
  return { id: skill.id, saved: Promise.all(writes) };
}
