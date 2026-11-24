// The objects on the desk: the animated example sentence, a chai-cup ring and a pencil.

/** A chai-cup ring left on the page. */
export function ChaiStain() {
  return (
    <svg className="stain" viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <filter id="stain-rough"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" seed="4" /><feDisplacementMap in="SourceGraphic" scale="9" /></filter>
      </defs>
      <g filter="url(#stain-rough)" fill="none" stroke="#9a5b1e">
        <circle cx="100" cy="100" r="70" strokeWidth="7" opacity="0.45" />
        <circle cx="100" cy="100" r="64" strokeWidth="2" opacity="0.3" />
        <path d="M30 120 C 40 160, 90 178, 130 168" strokeWidth="10" opacity="0.2" />
      </g>
    </svg>
  );
}

/** A school pencil lying across the desk. */
export function Pencil() {
  return (
    <svg className="pencil" viewBox="0 0 300 44" aria-hidden="true">
      <polygon points="8,22 42,8 42,36" fill="#e8c9a0" />
      <polygon points="8,22 20,17 20,27" fill="#2b2f37" />
      <rect x="42" y="8" width="210" height="28" fill="#c4302b" />
      <rect x="42" y="8" width="210" height="9" fill="#d94c44" />
      <rect x="42" y="27" width="210" height="9" fill="#a3241f" />
      <rect x="252" y="7" width="20" height="30" fill="#b9bcc4" />
      <rect x="256" y="7" width="3" height="30" fill="#8d919c" /><rect x="264" y="7" width="3" height="30" fill="#8d919c" />
      <rect x="272" y="8" width="22" height="28" rx="5" fill="#f19aa6" />
    </svg>
  );
}

/** The one orchestrated moment: an expert's sentence appears in ink, the red pen circles the gap,
 * and the apprentice sticks a note on the page. */
export function HeroDemo() {
  const before = 'Add the tea leaves'.split(' ');
  const after = 'and let it boil till the colour looks right.'.split(' ');
  let i = 0;
  const word = (w) => <span key={`${w}-${i}`} className="demo-word" style={{ animationDelay: `${(i += 1) * 0.11}s` }}>{w} </span>;
  return (
    <div aria-label="Example: the expert says 'Add the tea leaves andaz se and let it boil till the colour looks right.' The apprentice circles 'andaz se' and asks how much.">
      <p className="demo-label">What Mummy said:</p>
      <p className="demo-line" aria-hidden="true">
        {before.map(word)}
        <span className="demo-circle">
          <span className="demo-word" style={{ animationDelay: `${(i += 1) * 0.11}s` }}>andaz se</span>
          <svg viewBox="0 0 120 40" preserveAspectRatio="none">
            <path filter="url(#ink)" d="M8 22 C 6 8, 60 2, 108 10 C 122 14, 116 34, 62 36 C 20 38, 2 30, 14 14" />
          </svg>
        </span>{' '}
        {after.map(word)}
      </p>
      <div className="demo-sticky" aria-hidden="true">
        <span className="note demo-note">how much? a spoon? a pinch?<small>the apprentice</small></span>
      </div>
    </div>
  );
}
