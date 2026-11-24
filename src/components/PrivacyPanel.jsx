import { useEffect, useState } from 'react';
import { readLedger } from '../ai/ledger';
import HybridBadge from './HybridBadge';

const TASK_NAMES = {
  nextTurn: 'Interview follow-up',
  distill: 'Session notes',
  buildGuide: 'Guide builder',
  compareVoices: 'Two Voices',
  gapsFromTest: 'Apprentice gaps',
};

export default function PrivacyPanel({ skillId, sessions }) {
  const [ledger, setLedger] = useState(() => readLedger(skillId));
  const [open, setOpen] = useState(null);

  useEffect(() => {
    const onChange = (e) => { if (e.detail === skillId) setLedger(readLedger(skillId)); };
    window.addEventListener('unwritten-ledger', onChange);
    return () => window.removeEventListener('unwritten-ledger', onChange);
  }, [skillId]);

  const turns = (sessions || []).flatMap((s) => s.turns || []);
  const count = (src) => turns.filter((t) => t.source === src).length;

  return (
    <section className="plain privacy">
      <h2>What left this device</h2>
      <p className="lead-small">
        Raw interview words are read by the on-device model. Cloud AI sees only distilled notes, unless you chose cloud mode.
        Your data is stored in this app&apos;s Firebase project.
      </p>
      <div className="stat-row">
        <div className="stat"><span className="stat-num">{count('on_device')}</span><span className="stat-label">turns on-device</span></div>
        <div className="stat"><span className="stat-num">{count('in_cloud')}</span><span className="stat-label">turns in the cloud</span></div>
        <div className="stat"><span className="stat-num">{count('rules')}</span><span className="stat-label">turns by rules only</span></div>
      </div>
      <h3>AI calls from this browser</h3>
      {ledger.length === 0 && <p className="muted">No AI calls recorded in this browser yet.</p>}
      <ul className="ledger">
        {ledger.slice(0, 30).map((e, i) => (
          <li key={`${e.at}-${i}`}>
            <div className="row between">
              <span>{TASK_NAMES[e.task] || e.task} · {new Date(e.at).toLocaleString()}</span>
              <HybridBadge source={e.source} small />
            </div>
            {e.sent && (
              <>
                <button type="button" className="link-btn" onClick={() => setOpen(open === i ? null : i)}>
                  {open === i ? 'Hide' : 'Show'} what was sent ({e.sentChars} characters)
                </button>
                {open === i && <pre className="sent">{e.sent}{e.sentChars > e.sent.length ? '\n…' : ''}</pre>}
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
