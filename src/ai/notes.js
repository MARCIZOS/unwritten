// Pure: turns finished sessions into per-expert distilled notes, the only interview
// material the cloud models ever see.

export function buildNotes(experts, sessions, gaps) {
  const sessionExpert = Object.fromEntries((sessions || []).map((s) => [s.id, s.expertId]));
  return (experts || [])
    .map((ex) => {
      const done = (sessions || [])
        .filter((s) => s.expertId === ex.id && s.status === 'done' && s.distilled)
        .sort((a, b) => (a.startedAtMs || 0) - (b.startedAtMs || 0));
      const answeredGaps = (gaps || [])
        .filter((g) => g.status === 'resolved' && g.answer && sessionExpert[g.resolvedInSession] === ex.id)
        .map((g) => ({ q: g.questionForExpert || g.text, a: g.answer }));
      return {
        expertId: ex.id,
        expertName: ex.name,
        relation: ex.relation || '',
        summary: done.map((s) => s.distilled.summary).filter(Boolean).join(' '),
        steps: done.flatMap((s) => s.distilled.steps || []).slice(0, 30),
        unresolved: [...new Set(done.flatMap((s) => s.distilled.unresolved || []))].slice(0, 15),
        answeredGaps: answeredGaps.slice(0, 20),
        sessionIds: done.map((s) => s.id),
      };
    })
    .filter((n) => n.steps.length || n.answeredGaps.length);
}
