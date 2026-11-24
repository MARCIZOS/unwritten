import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { signInWithGoogle, continueAsGuest, authErrorMessage } from '../firebase';

/** The closed notebook: a cloth-bound cover with a name label. Signing in opens it. */
export default function SignIn() {
  const { pathname } = useLocation();
  const invited = pathname.startsWith('/join/');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  const run = (which, fn) => async () => {
    setBusy(which);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(null);
    }
  };

  return (
    <section className="signin">
      <div className="cover">
        <div className="cover-label">
          <p className="cover-brand">Unwritten</p>
          <p className="cover-sub">the things we know but never wrote down</p>
          <div className="cover-line">Subject <b>{invited ? 'a skill someone is teaching you' : 'know-how worth keeping'}</b></div>
          <div className="cover-line">Name <b className="cover-blank">{busy === 'google' ? 'signing in…' : 'yours'}</b></div>

          <h1 className="signin-title">{invited ? "You've been invited to learn a skill" : 'Open your notebook'}</h1>
          <p className="signin-lead">
            {invited
              ? 'Sign in to read the guide and take the Apprentice Test. Whatever you find unclear goes back to the expert as a question.'
              : 'Sign in to keep every interview, guide and gap the apprentice finds.'}
          </p>
          <div className="signin-actions">
            <button type="button" className="btn btn-primary btn-large signin-google" onClick={run('google', signInWithGoogle)} disabled={!!busy}>
              <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
                <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
              </svg>
              {busy === 'google' ? 'Opening Google…' : 'Continue with Google'}
            </button>
            <button type="button" className="btn btn-large" onClick={run('guest', continueAsGuest)} disabled={!!busy}>
              {busy === 'guest' ? 'Opening…' : 'Continue as a guest'}
            </button>
          </div>
          <p className="small muted signin-note">As a guest, your work stays in this browser. You can link Google later without losing anything.</p>
          {error && <p className="error-note" role="alert">{error}</p>}
        </div>
      </div>
      <p className="signin-footnote">Some knowledge was never written down. Let&apos;s write it.</p>
    </section>
  );
}
