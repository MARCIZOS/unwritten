import { Link } from 'react-router-dom';
import { HeroDemo, ChaiStain, Pencil } from '../components/Desk';

/** What a visitor sees before signing in: the open notebook and one way in. */
export default function Landing() {
  return (
    <section className="desk">
      <div className="spread">
        <div className="spread-page left">
          <h1 className="hero-title">Some knowledge was never written down.</h1>
          <p className="lead">
            Unwritten interviews an expert the way a curious apprentice would, catches what they know but never say,
            and checks that a beginner can really learn it.
          </p>
          <Link to="/signin" className="btn btn-primary btn-large">Get started</Link>
          <p className="landing-signin">Already have a notebook? <Link to="/signin">Sign in</Link></p>
        </div>
        <div className="spine" aria-hidden="true" />
        <div className="spread-page right">
          <HeroDemo />
        </div>
      </div>
      <ChaiStain />
      <Pencil />
    </section>
  );
}
