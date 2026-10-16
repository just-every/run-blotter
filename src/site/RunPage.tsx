import { SiteFrame } from './landing'
import run from './run.json'
import './docs/run.css'

// Run-page copy and commands belong to run.json, separate from layout.
export function RunPage() {
  const page = run.page
  return <SiteFrame>
    <main id="main" className="site-container run-main">
      <header className="run-intro">
        <h1>{page.heading}</h1>
        <p>{page.intro}</p>
      </header>
      <ol className="run-steps">
        {page.steps.map((step, index) => <li className="run-step" key={step.title}>
          <span className="run-number" aria-hidden="true">{index + 1}</span>
          <div>
            <h2>{step.title}</h2>
            <pre aria-label={step.title}><code>{step.commands.join('\n')}</code></pre>
            {'note' in step && <p>{step.note}</p>}
          </div>
        </li>)}
      </ol>
      <div className="run-after">
        <p>{page.next}</p>
        <p><a href={page.guideHref}>{page.guideLabel}</a></p>
        <p>{page.stopLabel} <code>{page.stopCommand}</code></p>
        <p className="run-requirements">{run.requirements}<br />{page.licenceLabel}</p>
      </div>
    </main>
  </SiteFrame>
}
