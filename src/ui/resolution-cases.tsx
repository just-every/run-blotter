import { useEffect, useState } from 'react';
import { api, when, type Row, type Run } from './common';
import { OrganizerStaff } from './organizers';

/** A case keeps the existing organizer and document custody visible together. */
export function ResolutionCases({ jobId, actor, run, tick }: { jobId: string; actor: Row; run: Run; tick: number }) {
  const [view, setView] = useState<Row>(), [error, setError] = useState('');
  const load = async () => { setView(await api(`/jobs/${jobId}/resolution-case`)); setError(''); };
  useEffect(() => { load().catch(e => setError(e.message)); }, [jobId, tick]);
  const refresh: Run = (work, message) => run(async () => { const result = await work(); await load(); return result; }, message);
  if (error) return <p role="alert" className="error">{error}</p>;
  if (!view) return null;
  const record = view.case, candidate = view.candidate, organizer = view.organizer;
  return <>
    {(record || candidate) && <section className="panel" id="resolution-case" aria-label="Resolution case">
      <h2>Resolution case · 433-A collection</h2>
      <p className="muted">Transcript context unavailable. Collection answers are client supplied. The practitioner chooses the resolution path; this case makes no recommendation and takes no agency action.</p>
      {record ? <>
        <p>Case {record.id} · organizer version {record.definition_version}<br />Question set reviewed by {record.reviewed_by} · {when(record.reviewed_at)}</p>
        {view.erased ? <p>Client erased. Collection content is unavailable here; retained originals remain under the existing retention policy.</p> : <>
          {organizer?.erased_at ? <p>Organizer answers erased.</p> : <>
            <h3>Submitted current information</h3>
            <p>{organizer?.completeness.confirmed} of {organizer?.completeness.required} required current answers submitted and confirmed.</p>
            {!Object.keys(view.answers).length && <p>No confirmed submission yet. Saved drafts and unconfirmed carry do not choose a workflow branch.</p>}
            <dl>{Object.entries(view.answers).map(([key, a]: [string, any]) => <div key={key}><dt>{organizer.definition.questions.find((q: Row) => q.key === key)?.label}</dt><dd>{a.value}</dd></div>)}</dl>
          </>}
          <h3>Supporting originals</h3>
          {view.files.length ? <ul>{view.files.map((file: Row) => <li key={file.id}>{file.erased_at ? `${file.name} · erased` : <a href={`/api/blotter/files/${file.id}`}>{file.name}</a>} · {file.size} bytes</li>)}</ul> : <p>No supporting file uploaded yet.</p>}
          <a href={`#organizer-${record.organizer_id}`}>Inspect answers, corrections and staff review</a>
        </>}
      </> : <>
        <p>Review the job’s frozen question set before collecting financial information. This is a firm-authored organizer, not a prepared IRS form.</p>
        <h3>{candidate.definition.name} · version {candidate.definition.version}</h3>
        <ul>{candidate.definition.questions.map((q: Row) => <li key={q.key}>{q.label}{q.required ? ' · required' : ''}{q.when ? ' · conditional' : ''}{q.request ? ` · supporting file: ${q.request}` : ''}</li>)}</ul>
        {view.canCreate ? <form onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); refresh(() => api(`/jobs/${jobId}/resolution-case`, { organizerId: candidate.id, revision: candidate.revision, version: candidate.definition.version, reviewed: data.get('reviewed') === 'on' }), 'Resolution case created with reviewed questions'); }}>
          <label><input type="checkbox" name="reviewed" required /> I reviewed this version’s questions for 433-A collection on this job.</label><button>Create resolution case</button>
        </form> : <p>A principal or reviewer must review this organizer and create the case.</p>}
      </>}
    </section>}
    {!view.erased && <OrganizerStaff jobId={jobId} run={refresh} actorRole={actor.role} />}
  </>;
}
