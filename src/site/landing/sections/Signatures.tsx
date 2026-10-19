import { IconTile, type IconName } from '../../parts/icons'
import { Section } from '../../parts/Section'
import { Check, Marked } from '../../parts/type'

type Step = { time: string; text: string; tone: 'done' | 'slip'; done?: boolean }
const maria: Step[] = [
  { time: '7:30 pm', text: 'opened', tone: 'done' },
  { time: '7:41 pm', text: 'identity check (KBA) passed', tone: 'done', done: true },
  { time: '7:42 pm', text: 'signed', tone: 'done', done: true },
  { time: '7:44 pm', text: 'paid invoice 5112, $1,700.00, by card', tone: 'done', done: true },
]
const luis: Step[] = [
  { time: '9:05 pm', text: 'KBA attempt 1 of 3 · one question missed', tone: 'slip' },
  { time: 'Tue Oct 13, 7:15 am', text: 'attempt 2 of 3 · passed', tone: 'done', done: true },
  { time: '7:18 am', text: 'signed', tone: 'done', done: true },
]
const record: [IconName, string][] = [['file', 'Signed PDF'], ['ribbon', 'Signing certificate'], ['list', 'Per signer: name, time, IP address, login ID, every KBA result'], ['hash', 'Document hash'], ['clock', 'Kept until Oct 13, 2029']]

function Signer({ name, steps }: { name: string; steps: Step[] }) {
  return <article className="card signer"><h3 className="display">{name}</h3>
    <ol>{steps.map(s => <li key={s.time} className={`is-${s.tone}`}><b>{s.time}</b><span>{s.text}{s.done && <> <Check /></>}</span></li>)}</ol>
  </article>
}

/** 08 · Both spouses signed by morning: one Form 8879, two signers, one KBA retry, one signed record. */
export function Signatures() {
  return <Section id="signatures" eyebrow="Signatures · Ramirez 1040 · MFJ · Mon Oct 12 – Tue Oct 13"
    title={<>Both spouses signed <Marked sparks>by morning.</Marked></>}
    body="Maria signed Monday night, in Spanish. Luis missed one identity question, passed on the retry, and the return was ready to file.">
    <p className="card form-head"><IconTile name="file" /><span><b>Form 8879</b> · 2025 Form 1040 · Luis and Maria Ramirez, married filing jointly · preparer Priya Shah · sent Mon Oct 12, 9:10 am with invoice 5112</span></p>
    <div className="signing">
      <div className="signers">
        <Signer name="Maria Ramirez · español" steps={maria} />
        <Signer name="Luis Ramirez" steps={luis} />
        <p className="converge"><span className="converge-lines" aria-hidden="true" />Tue Oct 13, 7:18 am · both signatures in · ready to file <Check /></p>
      </div>
      <article className="card record">
        <h3><IconTile name="shield" /><span className="display">Signed record</span></h3>
        <ul>{record.map(([icon, text]) => <li key={text}><IconTile name={icon} tone="mint" /><span>{text}</span></li>)}</ul>
      </article>
    </div>
    <div className="sign-chips">
      <p className="chip-done"><span className="check-dot"><Check tone="mint" /></span><span><b>Transmitted by Priya Shah</b> 9:30 am · accepted Tue Oct 13, 3:12 pm <Check /> (UltraTax CS)</span></p>
      <p className="chip-week"><span className="bars" aria-hidden="true"><i /><i /><i /></span><span><b>Week of Oct 12</b> · 47 Form 8879s signed · 1 KBA retry</span></p>
    </div>
  </Section>
}
