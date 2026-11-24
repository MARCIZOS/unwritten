import { Link, Navigate, useParams } from 'react-router-dom';
import { useSkill } from '../hooks/useSkill';
import { useLive } from '../hooks/useLive';
import { liveSessions, liveExperts } from '../data/watchers';
import { highlightSegments } from '../ai/cues';
import CueChip, { Highlighted } from '../components/CueChip';
import HybridBadge from '../components/HybridBadge';
import { Spinner, Empty } from '../components/Common';

/** Read back a past interview exactly as it was written, with the apprentice's notes. */
export default function Session() {
  const { skillId, sessionId } = useParams();
  const { skill, loading, role } = useSkill(skillId);
  const [sessions, sessionsLoading] = useLive(liveSessions, [skillId], []);
  const [experts] = useLive(liveExperts, [skillId], []);

  if (loading || sessionsLoading) return <Spinner />;
  if (!skill) return <Empty title="This skill isn't available" />;
  if (role !== 'owner') return <Navigate to={`/s/${skillId}/guide`} replace />;
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return <Empty title="This session isn't available">It may have been deleted. <Link to={`/s/${skillId}`}>Back to the skill</Link></Empty>;
  const expert = experts.find((e) => e.id === session.expertId);
  const turns = session.turns || [];
  const notes = session.distilled;

  return (
    <div className="interview">
      <header className="page-head">
        <div>
          <p className="crumb"><Link to={`/s/${skillId}`}>{skill.title}</Link>, round {session.round}, {new Date(session.startedAtMs).toLocaleString()}</p>
          <h1>{expert ? `${expert.name}'s interview` : 'Interview'}</h1>
          <p className="muted">{turns.length} answers{session.status === 'done' ? '' : ' (not finished)'}</p>
        </div>
        {expert && <Link to={`/s/${skillId}/interview/${expert.id}`} className="btn btn-primary">Interview {expert.name} again</Link>}
      </header>

      {turns.length === 0 ? <Empty title="No answers in this session" /> : (
        <div className="sheet">
          <ol className="transcript">
            {turns.map((t, i) => (
              <li key={t.at || i} className="turn sheet-row">
                <div className="margin-col">
                  {(t.cues || []).map((c) => <CueChip key={c.phrase} cue={c} />)}
                  <HybridBadge source={t.source} small />
                </div>
                <div>
                  <p className="turn-q"><span className="turn-num">{i + 1}.</span>{t.q}</p>
                  <p className="turn-a"><Highlighted segments={highlightSegments(t.a, t.cues)} /></p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {notes && (
        <section className="plain">
          <div className="section-title"><h2>Notes from this session</h2><HybridBadge source={session.distillSource} small /></div>
          {notes.summary && <p>{notes.summary}</p>}
          {notes.steps?.length > 0 && <ol className="start-list">{notes.steps.map((s, i) => <li key={i}>{s.action}{s.signal ? ` (you know by: ${s.signal})` : ''}</li>)}</ol>}
          {notes.unresolved?.length > 0 && <p className="small muted">Still vague: {notes.unresolved.join(', ')}</p>}
        </section>
      )}
    </div>
  );
}
