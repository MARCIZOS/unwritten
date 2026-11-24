import { lazy, Suspense, useState } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { configMissing, saveWithGoogle, signOut, authErrorMessage } from './firebase';
import { useAuth } from './hooks/useAuth';
import { useDevice } from './hooks/DeviceContext';
import { OfflineDot, DevicePill } from './components/StatusBar';
import { Spinner } from './components/Common';
import Home from './pages/Home';
import SignIn from './pages/SignIn';
import Landing from './pages/Landing';
import SetupHelp from './pages/SetupHelp';

// The first screen (landing, sign-in, home) ships in the main bundle; every other page,
// and the AI code they pull in, loads when it's first opened.
const SkillNew = lazy(() => import('./pages/SkillNew'));
const Skill = lazy(() => import('./pages/Skill'));
const Interview = lazy(() => import('./pages/Interview'));
const Guide = lazy(() => import('./pages/Guide'));
const ApprenticeTest = lazy(() => import('./pages/ApprenticeTest'));
const Score = lazy(() => import('./pages/Score'));
const Join = lazy(() => import('./pages/Join'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Session = lazy(() => import('./pages/Session'));

/** Rough-ink filters: red-pen circles and rubber stamps get a hand-made edge instead of a vector-perfect one. */
function InkDefs() {
  return (
    <svg className="ink-defs" aria-hidden="true" focusable="false">
      <filter id="ink" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.8" />
      </filter>
      <filter id="stamp" x="-10%" y="-20%" width="120%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="8" result="grain" />
        <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.6" result="mask" />
        <feComposite in="SourceGraphic" in2="mask" operator="in" result="worn" />
        <feDisplacementMap in="worn" in2="grain" scale="1.2" />
      </filter>
    </svg>
  );
}

function AccountButton() {
  const { user } = useAuth();
  const [note, setNote] = useState('');
  if (!user) return null;
  if (user.isAnonymous) {
    const save = async () => {
      try {
        const { switched } = await saveWithGoogle();
        setNote(switched ? 'Signed in to your existing Google account. Skills made as a guest stay with the guest account.' : '');
      } catch (err) {
        setNote(authErrorMessage(err));
      }
    };
    const leave = () => {
      // A guest who signs out can't get back to their skills, so make that explicit.
      if (window.confirm('Sign out of the guest account? Skills you made as a guest will no longer be reachable unless you save with Google first.')) signOut();
    };
    return (
      <span className="account">
        <span className="small muted">Guest</span>
        <button type="button" className="btn btn-small" onClick={save}>Save with Google</button>
        <button type="button" className="btn btn-small btn-ghost" onClick={leave}>Sign out</button>
        {note && <span className="account-note">{note}</span>}
      </span>
    );
  }
  return (
    <span className="account">
      {user.photoURL && <img className="avatar" src={user.photoURL} alt="" width="26" height="26" referrerPolicy="no-referrer" />}
      <span className="small">{user.displayName || user.email}</span>
      <button type="button" className="btn btn-small btn-ghost" onClick={signOut}>Sign out</button>
    </span>
  );
}

export default function App() {
  const { ready, user } = useAuth();
  const device = useDevice();

  return (
    <div className="shell">
      <InkDefs />
      <header className="topbar">
        <Link to="/" className="wordmark" aria-label="Unwritten, home">
          <span className="wm-insert" aria-hidden="true">un</span>
          <svg className="wm-caret" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 17 L10 5 L17 17" fill="none" stroke="#c8352e" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span className="wm-word">written</span>
        </Link>
        <div className="topbar-right">
          <DevicePill status={device.status} />
          <OfflineDot />
          {!configMissing && <AccountButton />}
        </div>
      </header>
      <main className="page">
        {configMissing ? <SetupHelp /> : !ready ? <Spinner label="Opening your notebook…" /> : !user ? (
          <Routes>
            {/* Visitors land on the hero; any other link (an invite, a skill) asks them to sign in first,
                then shows that same page once they have. */}
            <Route path="/" element={<Landing />} />
            <Route path="*" element={<SignIn />} />
          </Routes>
        ) : (
          <Suspense fallback={<Spinner label="Turning the page…" />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/skills/new" element={<SkillNew />} />
            <Route path="/s/:skillId" element={<Skill />} />
            <Route path="/s/:skillId/interview/:expertId" element={<Interview />} />
            <Route path="/s/:skillId/guide" element={<Guide />} />
            <Route path="/s/:skillId/test" element={<ApprenticeTest />} />
            <Route path="/s/:skillId/score" element={<Score />} />
            <Route path="/s/:skillId/session/:sessionId" element={<Session />} />
            <Route path="/join/:skillId/:code" element={<Join />} />
            <Route path="/signin" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        )}
      </main>
      <footer className="footer">
        Unwritten asks what nobody thought to ask. Interviews run on this device with Gemini Nano; guides are written in the cloud with Firebase AI Logic.
      </footer>
    </div>
  );
}
