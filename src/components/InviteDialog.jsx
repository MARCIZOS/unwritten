import { useEffect, useState } from 'react';
import { inviteLink, rotateInvite } from '../data/skills';

export default function InviteDialog({ skill, onClose }) {
  const link = inviteLink(skill);
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const [renewed, setRenewed] = useState(false);

  useEffect(() => {
    // The QR library only loads when someone opens this dialog.
    import('qrcode')
      .then((m) => (m.default || m).toDataURL(link, { margin: 1, width: 220, color: { dark: '#2f2a24', light: '#fffdf8' } }))
      .then(setQr)
      .catch(() => setQr(''));
  }, [link]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked: the link is selectable */ }
  };

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-label="Invite an apprentice" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Invite an apprentice</h2>
        <p className="muted">They open this on their phone, read the guide and take the Apprentice Test. No sign-up needed.</p>
        {qr && <img className="qr" src={qr} alt="QR code for the invite link" width="220" height="220" />}
        <input className="input mono" readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Invite link" />
        {renewed && <p className="small" role="status">New link made. The old link no longer works; apprentices who already joined stay.</p>}
        <div className="row gap">
          <button type="button" className="btn btn-primary" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
          <button type="button" className="btn" onClick={() => { rotateInvite(skill.id); setRenewed(true); setCopied(false); }} title="Old links stop working; existing apprentices stay">New link</button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
