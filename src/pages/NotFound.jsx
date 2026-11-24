import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section className="plain">
      <h1>Nothing written here</h1>
      <p><Link to="/">Back to your skills</Link></p>
    </section>
  );
}
