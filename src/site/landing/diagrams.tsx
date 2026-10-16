import type { ReactNode } from 'react'
import { LineIcon, type IconName } from './icons'

type PillKind = 'done' | 'progress' | 'new'
function Pill({ children, kind = 'done' }: { children: ReactNode; kind?: PillKind }) {
  return <span className={`drawing-pill drawing-pill-${kind}`}>{children}</span>
}

function DrawingRow({ icon, children, status, kind }: { icon?: IconName; children: ReactNode; status?: string; kind?: PillKind }) {
  return <div className="drawing-row">{icon && <LineIcon name={icon} />}<span className="drawing-row-label">{children}</span>{status && <Pill kind={kind}>{status}</Pill>}</div>
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return <div className="drawing-card workflow-step"><div className="drawing-step-title"><span className="drawing-number" aria-hidden="true">{number}</span><span>{title}</span></div><div className="drawing-rows">{children}</div></div>
}

export function WorkflowDrawing() {
  return <figure className="landing-drawing landing-workflow blotter" role="img" aria-label="Blotter: a client uploads bank statements, the reviewer signs off the Jul–Sep BAS, and the Oct–Dec job is ready.">
    <Step number={1} title="Client uploads"><DrawingRow icon="document" status="Received" kind="progress">Bank statements for the quarter</DrawingRow><DrawingRow icon="file" status="Accept">bank-jul-sep.csv</DrawingRow></Step>
    <Step number={2} title="Reviewer signs off"><DrawingRow icon="document" status="Signed off">Quarterly BAS · Jul–Sep 2026</DrawingRow><DrawingRow icon="person">Riley Tan</DrawingRow></Step>
    <Step number={3} title="Next quarter ready"><DrawingRow icon="document" status="Open" kind="new">Quarterly BAS · Oct–Dec 2026</DrawingRow></Step>
  </figure>
}

export function LicenceDrawing() {
  return <figure className="landing-drawing landing-licence-drawing blotter" role="img" aria-label="MIT License"><div className="drawing-card licence-card"><strong>MIT License</strong><div className="licence-lines" aria-hidden="true">{[0, 1, 2, 3, 4].map(line => <span key={line} />)}</div></div></figure>
}

export function UploadDrawing() {
  return <figure className="landing-drawing landing-upload-drawing blotter" role="img" aria-label="Client upload page: Morgan & Co Bookkeeping requests documents for Quarterly BAS; bank statements are accepted, sales invoices are received and purchase receipts are requested."><div className="drawing-card upload-card">
    <div className="drawing-practice"><img src="/brand/mark.svg" alt="" width="24" height="18" /><strong>Morgan &amp; Co Bookkeeping</strong></div>
    <h3>Documents for Quarterly BAS</h3>
    <DrawingRow status="Accepted">Bank statements for the quarter</DrawingRow>
    <DrawingRow status="Received" kind="progress">Sales invoices and receipts</DrawingRow>
    <DrawingRow status="Requested" kind="new">Purchase receipts and bills</DrawingRow>
    <span className="drawing-upload-button">Choose a file to upload</span>
  </div></figure>
}

export function ReviewDrawing() {
  return <figure className="landing-drawing landing-review-drawing blotter" role="img" aria-label="Review: decision Sign off; review note Bank reconciled; GST coding checked.; Record decision."><div className="drawing-card review-card">
    <h3>Review</h3><span className="drawing-field-label">Decision</span><div className="drawing-select">Sign off<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg></div>
    <span className="drawing-field-label">Review note</span><div className="drawing-textarea">Bank reconciled; GST coding checked.</div><span className="drawing-action">Record decision</span>
  </div></figure>
}

export function BillingDrawing() {
  return <figure className="landing-drawing landing-billing-drawing blotter" role="img" aria-label="Billing 2026-10 · $617.50. Approved. Download CSV."><div className="drawing-card billing-card"><span className="drawing-billing-title">Billing 2026-10 · $617.50</span><div className="drawing-billing-actions"><Pill>Approved</Pill><span className="drawing-action">Download CSV</span></div></div></figure>
}
