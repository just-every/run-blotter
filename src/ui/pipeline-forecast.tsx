import { Empty, Field, type Row } from './common';

/** User-entered workload assumptions for the open pipeline forecast. */
export function PipelineForecastInputs({ state, prospects, from }: { state: Row; prospects: Row[]; from: string }) {
  const workTypes: Row[] = state.statusModel.workTypes;
  return <details>
    <summary>Pipeline workload assumptions</summary>
    <p className="muted">This unweighted scenario assumes every included open prospect wins. Choose a work type and its budget for each requested service, and a first work target. These assumptions do not create signed scope, convert fees to hours, or promise deadlines.</p>
    <p className="muted">Estimates use the selected work type’s budget, or its template task estimates. Work without a template occurs once; template work repeats on its cadence through the forecast window. Missing matches or budgets remain unestimated with low confidence; no hours are invented.</p>
    {!prospects.length ? <Empty>No open prospects.</Empty> : prospects.map(p => <div className="panel" key={p.id}>
      <h3>{p.name} · {p.stage}</h3>
      <div className="row">
        <Field key={from} label="First work target" name={`pipelineDue:${p.id}`} type="date" value={from} />
        {p.services.map((service: string, n: number) => {
          const match = workTypes.find(w => w.name.toLowerCase() === service.toLowerCase());
          const name = `pipelineWork:${p.id}:${n}`;
          return <Field key={n} label={service} name={name} required={false}>
            <select name={name} defaultValue={match?.id ?? ''}>
              <option value="">Choose a work type to estimate</option>
              {workTypes.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </Field>;
        })}
      </div>
    </div>)}
  </details>;
}
