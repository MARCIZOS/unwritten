import { useState } from 'react';
import { CUE_LABELS } from '../ai/cues';

// What the apprentice scribbles in the margin next to each kind of unwritten knowledge.
export const MARGIN_WORDS = {
  vague_quantity: 'how much?',
  sensory: 'what exactly?',
  condition: 'when?',
  hedge: 'always?',
  skipped_step: 'what before?',
  just_know: 'how do you know?',
};

/** A red-pen note in the margin. Tap it to see why the phrase was flagged. */
export default function CueChip({ cue }) {
  const [open, setOpen] = useState(false);
  return (
    <button type="button" className="note cue-chip" onClick={() => setOpen((o) => !o)} aria-expanded={open}
      aria-label={`${CUE_LABELS[cue.type] || cue.type}: ${cue.phrase}`}>
      {MARGIN_WORDS[cue.type] || 'say more?'}
      <small>{cue.phrase}</small>
      {open && <span className="note-why">{CUE_LABELS[cue.type]}: {cue.why || 'a beginner could not copy this yet'}</span>}
    </button>
  );
}

/** The expert's words, with each cue circled in red pen. */
export function Highlighted({ segments }) {
  return (
    <>
      {segments.map((seg, i) => (seg.cue
        ? (
          <mark key={i} className={`cue-mark ${seg.text.split(/\s+/).length > 3 ? 'is-long' : ''}`} title={CUE_LABELS[seg.cue.type]}>
            {seg.text}
          </mark>
        )
        : <span key={i}>{seg.text}</span>))}
    </>
  );
}
