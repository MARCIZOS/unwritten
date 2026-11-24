const LABELS = {
  on_device: { text: 'on this device', title: 'Ran on this device with Gemini Nano. No cloud model saw it.', cls: 'badge-device' },
  in_cloud: { text: 'cloud', title: 'Ran on Gemini in the cloud through Firebase AI Logic.', cls: 'badge-cloud' },
  rules: { text: 'rules', title: 'No model used: keyword rules and question templates.', cls: 'badge-rules' },
};

/** A small rubber stamp saying where an answer was worked out. */
export default function HybridBadge({ source, small = false }) {
  if (!source) return null;
  const l = LABELS[source] || LABELS.rules;
  return (
    <span className={`badge ${l.cls} ${small ? 'badge-small' : ''}`} title={l.title}>
      {l.text}
    </span>
  );
}
