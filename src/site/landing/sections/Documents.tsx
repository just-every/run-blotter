import { IconTile } from '../../parts/icons'
import { Card, Section } from '../../parts/Section'
import { Arrow, Check, Marked } from '../../parts/type'

/** 03 · Asked once, chased until it's in: one list per client, reminders that stop on arrival. */
export function Documents() {
  return <Section id="documents" tone="wash" layout="split" eyebrow="Documents · 212 requests · Thu Oct 1 – Wed Oct 14"
    title={<>Asked once, chased <Marked>until it{'’'}s in.</Marked></>}
    body="Each client sees one list of what's still missing. Reminders go by email, portal and text, and each one stops when the file arrives.">
    <ol className="count-strip">
      <li className="card">Sent since Thu Oct 1 · <b>212 requests</b> (148 for September closes + 64 for extended returns)</li>
      <li className="card">Wed Oct 7 · 196 received · 16 being chased</li>
      <li className="card is-done">Wed Oct 14 · 212 of 212 in <Check /></li>
    </ol>
    <div className="documents-grid">
      <div className="request">
        <Card className="request-card">
          <h3><span className="display">Bright Smile Dental</span> · September close · contact Kayla Moore, office manager</h3>
          <ul>
            <li><p><b>Checking ••4417</b> · September statement · received Fri Oct 9, 8:12 am <small>(scanned on her phone)</small></p><Check /></li>
            <li><p><b>Payroll register</b> · September · received Fri Oct 2</p><Check /></li>
            <li><p><b>Credit card statement</b> · September · received Tue Oct 6</p><Check /></li>
          </ul>
        </Card>
        <ol className="rail">
          <li>Thu Oct 1 · request email</li>
          <li>Mon Oct 5 · reminder email · lists the 2 items still out</li>
          <li>Thu Oct 8 · text (opted in) · only the statement left · link to the portal</li>
          <li className="is-struck"><s>Mon Oct 12 · escalate to Sofia Mendes</s> <span>not needed</span></li>
        </ol>
      </div>
      <div className="client-cards">
        <Card className="mini-card">
          <IconTile name="file" />
          <div><h3><span className="display">Rivera Landscaping LLC</span> · Hector Rivera · September fuel card statement</h3>
            <ul>
              <li><svg className="flag" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 15V2h9l-2 3.2L12 8.5H3" fill="currentColor" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>uploaded Sat Oct 3 · statement dated Aug 1–31 <Arrow /> flagged: wrong month</li>
              <li>returned Mon Oct 5, 8:50 am by Sofia Mendes: {'‘'}This one is August. Could you send September{'’'}s?{'’'}</li>
              <li>September statement in Mon Oct 5, 2:15 pm <Check /></li>
            </ul></div>
        </Card>
        <Card className="mini-card">
          <IconTile name="home" tone="mint" />
          <div><h3><span className="display">Ramirez household</span> · 2025 organizer · Maria Ramirez · español</h3>
            <ul>
              <li>3 answers carried from last year · confirmed <Check /></li>
              <li>Rental at 412 Elm St · kept <Check /></li>
              <li>Form 1098 from Truist · uploaded Tue Oct 6 <Check /></li>
            </ul></div>
        </Card>
        <Card className="mini-card portal-card">
          <IconTile name="file" />
          <div><h3 className="display portal-firm">Cardinal Tax & Books</h3>
            <p>Garcia 1040 · 1 item left: 2025 Form 1098</p>
            <span className="upload-button" aria-hidden="true">Upload</span>
            <p className="done-chip"><span>in Tue Oct 13, 6:40 pm <Check /></span></p></div>
        </Card>
      </div>
    </div>
  </Section>
}
