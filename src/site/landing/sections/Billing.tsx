import { IconTile } from '../../parts/icons'
import { Section } from '../../parts/Section'
import { Arrow, Check, Eyebrow, Marked } from '../../parts/type'

/** 11 · Billed on the 1st. Paid by the 14th.: one invoice, the month's run, and one scope amendment. */
export function Billing() {
  return <Section id="billing" layout="split" eyebrow="Billing · October · Thu Oct 1 – Thu Oct 15"
    title={<>Billed on the 1st. <Marked>Paid by the 14th.</Marked></>}
    body="Recurring fees bill themselves and collect by ACH or card. The agent spotted payroll setup outside a new client's signed scope.">
    <div className="billing-grid">
      <article className="card invoice">
        <IconTile name="document" />
        <h3 className="display">Invoice 5047</h3>
        <p className="invoice-parties">Cardinal Tax & Books <Arrow /> Harbor Taco Co.</p>
        <p className="invoice-dates">issued Thu Oct 1 · due Thu Oct 15</p>
        <table><tbody>
          <tr><th scope="row">Monthly bookkeeping · October</th><td>$650.00</td></tr>
          <tr><th scope="row">Payroll · October</th><td>$175.00</td></tr>
        </tbody><tfoot><tr><th scope="row">Total</th><td>$825.00</td></tr></tfoot></table>
        <span className="pay-button" aria-hidden="true">Pay by ACH or card</span>
        <p className="paid-note"><span className="check-dot"><Check tone="mint" /></span><span>paid by ACH in the portal Fri Oct 9 · pending <Arrow /> settled Wed Oct 14 <Check tone="ink" /> · Stripe fee $5.00 shown apart · synced to the firm{'’'}s QuickBooks Online <Check tone="ink" /></span></p>
      </article>
      <div className="billing-side">
        <article className="card run">
          <Eyebrow>October run</Eyebrow>
          <p className="run-title">Thu Oct 1 · 58 recurring invoices (5021–5078) · $31,640.00</p>
          <p className="run-bar" role="img" aria-label="44 of 58 on auto-pay, 14 paid in the portal"><span style={{ flexGrow: 44 }} /><span style={{ flexGrow: 14 }} /></p>
          <p className="run-legend"><span><i className="dot-marigold" />44 on auto-pay (38 ACH + 6 card)</span><span><i className="dot-lilac" />14 paid in the portal</span></p>
          <p className="done-chip"><span className="check-dot"><Check tone="mint" /></span><span>58 of 58 paid by Wed Oct 14 <Check tone="ink" /></span></p>
          <p className="run-returns"><IconTile name="file" tone="mint" /><span>Extended 1040s · 184 invoiced with the 8879 · 184 paid <Check tone="ink" /></span></p>
        </article>
        <article className="card amendment">
          <h3><IconTile name="sparkle" /><span className="display">Oak & Iron Fitness · Andre Wallace, owner</span></h3>
          <ol>
            <li className="is-done">Engagement letter signed Tue Oct 6 · bookkeeping $450.00 + payroll $175.00 a month · first invoice 5084 $625.00 · ACH auto-pay · settled Tue Oct 13 <Check tone="ink" /></li>
            <li className="is-agent">Wed Oct 14, 9:40 am · agent: Aisha Grant logged 2.5 h of Gusto payroll setup, Thu Oct 8 – Fri Oct 9 · not in the signed scope · draft amendment: payroll setup 2.5 h × $150.00 = $375.00</li>
            <li className="is-done">10:20 am · Dana Kim approved and sent it <Check tone="ink" /></li>
            <li className="is-done">Thu Oct 15, 9:05 am · Andre accepted in the portal · invoice 5147 $375.00 paid by card <Check tone="ink" /></li>
          </ol>
        </article>
      </div>
    </div>
  </Section>
}
