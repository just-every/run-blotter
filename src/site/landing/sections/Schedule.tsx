import type { ReactNode } from 'react'
import { Icon, IconTile, type IconName } from '../../parts/icons'
import { Section } from '../../parts/Section'
import { Arrow, Check, Marked } from '../../parts/type'

function Rule({ icon, title, muted = false, chips, children }: { icon: IconName; title: ReactNode; muted?: boolean; chips?: ReactNode; children?: ReactNode }) {
  return <div className={`rule card${muted ? ' is-muted' : ''}`}>
    <IconTile name={icon} tone={muted ? 'grey' : 'lilac'} />
    <div><p className="rule-title">{title}</p>{chips}{children}</div>
  </div>
}

function Stack({ tone, back, children }: { tone: string; back: [string, string]; children: ReactNode }) {
  return <div className={`tape-stack tone-${tone}`}><span className={`tape back tone-${back[0]}`} /><span className={`tape mid tone-${back[1]}`} /><p className="tape top">{children}</p></div>
}

/** 02 · Every deadline, worked out: five rules, each wired to the client work it created. */
export function Schedule() {
  return <Section id="schedule" eyebrow="Schedule · Cardinal Tax & Books · 418 clients · October 2026"
    title={<>Every deadline, <Marked>worked out.</Marked></>}
    body={<>Federal and North Carolina rules set each client{'’'}s due dates, weekends and extensions included. Each period{'’'}s work is created ahead, already assigned.</>}>
    <div className="rules">
      <Rule icon="document" title="Form 1040 · extension (Form 4868)" chips={<ul className="date-chips"><li><small>original</small>Wed Apr 15</li><li><small>extended</small>Thu Oct 15</li><li><small>firm target</small>Fri Oct 9</li></ul>} />
      <span className="wire" />
      <Stack tone="mint" back={['marigold', 'lilac']}>184 extended 1040s · due Thu Oct 15</Stack>

      <Rule icon="calendar" title={<>Form 941 · quarterly · last day of the month after the quarter · weekend <Arrow /> next business day</>} />
      <span className="wire"><span className="wire-chip">Sat Oct 31 <Arrow /> Mon Nov 2</span></span>
      <Stack tone="marigold" back={['mint', 'mint']}>Q3 Form 941 · 37 payroll clients · due Mon Nov 2</Stack>

      <Rule icon="file" title="North Carolina sales and use tax (E-500) · monthly · due the 20th" />
      <span className="wire" />
      <Stack tone="lilac" back={['marigold', 'mint']}>23 clients · Harbor Taco Co. on top · September due Tue Oct 20</Stack>

      <Rule icon="chart" title="Monthly close · firm rule: 12 days after month end" chips={<ul className="date-chips"><li>firm-defined</li></ul>} />
      <span className="wire" />
      <div className="stack-with-note"><Stack tone="mint" back={['marigold', 'lilac']}>41 September closes · due Mon Oct 12</Stack>
        <p className="roll-note">Creates work 3 months ahead · January 2027 closes · 41 jobs created Thu Oct 1 <Check /> · preparer and reviewer assigned</p></div>

      <Rule icon="file" muted title="Forms 1120-S and 1065 · calendar 2025 · extended Tue Sep 15" />
      <span className="wire" />
      <Stack tone="mint" back={['marigold', 'mint']}>26 1120-S + 14 1065 · accepted <Check /></Stack>
    </div>
    <p className="source-chip"><Icon name="checkCircle" />Federal rules from irs.gov · NC rules from ncdor.gov · each with its source link and effective date · approved by Dana Kim</p>
  </Section>
}
