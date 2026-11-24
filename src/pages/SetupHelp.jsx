export default function SetupHelp() {
  return (
    <section className="plain">
      <h1>Connect Firebase to start</h1>
      <p>This build has no Firebase config yet.</p>
      <ol className="steps-list">
        <li>Copy <code>.env.example</code> to <code>.env.local</code> in the project folder.</li>
        <li>Fill in the values from Firebase console → Project settings → Your apps → Web app.</li>
        <li>Add your reCAPTCHA Enterprise site key from App Check.</li>
        <li>Restart <code>npm run dev</code>.</li>
      </ol>
      <p className="muted">Full steps are in the README.</p>
    </section>
  );
}
