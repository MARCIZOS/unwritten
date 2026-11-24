// One plain JSON Schema per task. The same object is passed to the on-device model
// (promptOptions.responseConstraint) and to the cloud model (responseJsonSchema).

const str = { type: 'string' };
const strList = { type: 'array', items: str };

export function nextTurnSchema(cueTypes) {
  return {
    type: 'object',
    properties: {
      cues: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            phrase: str,
            type: { type: 'string', enum: cueTypes },
            why: str,
          },
          required: ['phrase', 'type'],
        },
      },
      nextQuestion: str,
      stepLabel: str,
    },
    required: ['cues', 'nextQuestion', 'stepLabel'],
  };
}

export const DISTILL_SCHEMA = {
  type: 'object',
  properties: {
    summary: str,
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: { action: str, condition: str, signal: str },
        required: ['action'],
      },
    },
    unresolved: strList,
  },
  required: ['summary', 'steps', 'unresolved'],
};

export const GUIDE_SCHEMA = {
  type: 'object',
  properties: {
    title: str,
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: str,
          what: str,
          howYouKnow: str,
          why: str,
          pitfalls: str,
          sourceExperts: strList,
        },
        required: ['title', 'what', 'howYouKnow'],
      },
    },
    openGaps: {
      type: 'array',
      items: {
        type: 'object',
        properties: { text: str, stepTitle: str, questionForExpert: str },
        required: ['text', 'questionForExpert'],
      },
    },
    checks: strList,
  },
  required: ['steps', 'openGaps', 'checks'],
};

export const VOICES_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          topic: str,
          status: { type: 'string', enum: ['agreed', 'context', 'conflict'] },
          accountA: str,
          accountB: str,
          contextNote: str,
        },
        required: ['topic', 'status', 'accountA', 'accountB'],
      },
    },
  },
  required: ['items'],
};

export const GAPS_SCHEMA = {
  type: 'object',
  properties: {
    gaps: {
      type: 'array',
      items: {
        type: 'object',
        properties: { text: str, stepTitle: str, questionForExpert: str },
        required: ['text', 'questionForExpert'],
      },
    },
  },
  required: ['gaps'],
};
