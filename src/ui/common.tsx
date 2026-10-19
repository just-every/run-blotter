import { Fragment, cloneElement, isValidElement, useId, type FormEvent, type ReactElement, type ReactNode } from 'react';

export type Row = Record<string, any>;
export type Run = (job: () => Promise<any>, message?: string) => Promise<void>;

export async function api(path: string, body?: unknown) {
  const response = await fetch('/api/blotter' + path, { credentials: 'same-origin', ...(body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) });
  const result: any = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(result.error ?? 'The request could not be completed'), { mfa: result.mfa as string | undefined });
  if (path === '/state' && result.firm) displayZone = result.firm.timeZone;
  return result;
}
/** Where a time entry's rate came from (TIME-003 rate cards). */
export const SOURCE: Record<string, string> = { client_service: 'client and service', client: 'client', service: 'service', staff: 'staff member', role: 'role' };
export const money = (cents: number, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency, currencyDisplay: 'code' }).format(Number(cents) / 100);
export const taxId = (value: string) => value ? `${value.length === 11 ? 'Legacy ABN' : 'EIN'} •••••${value.slice(-4)}` : '';
export const moneyTotals = (rows: Row[], key: string) => Object.entries(rows.reduce((totals: Record<string, number>, r: Row) => { totals[r.currency] = (totals[r.currency] ?? 0) + Number(r[key]); return totals; }, {})).map(([currency, cents]) => money(cents as number, currency)).join(' · ');
let displayZone = 'America/New_York';
/** Firm-local dates and instants; date-only deadlines retain their recorded day. */
const parts = (d: Date) => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: displayZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' }).formatToParts(d).map(p => [p.type, p.value]));
export const today = () => { const p = parts(new Date()); return `${p.year}-${p.month}-${p.day}`; };
export const when = (iso?: string) => { if (!iso) return ''; if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso; const p = parts(new Date(iso)); return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute} ${p.timeZoneName}`; };

export async function readFile(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { name: file.name, mime: file.type || 'application/octet-stream', contentBase64: btoa(binary) };
}

export function Form({ children, submit, label = 'Save', danger = false, disabled = false }: { children: ReactNode; submit: (data: Row, form: HTMLFormElement) => Promise<void>; label?: string; danger?: boolean; disabled?: boolean }) {
  return <form onSubmit={async (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const form = e.currentTarget; await submit(Object.fromEntries(new FormData(form)), form); }}>
    {children}<button type="submit" disabled={disabled} className={danger ? 'danger' : undefined}>{label}</button>
  </form>;
}
export function Field({ label, name, type = 'text', required = true, value, hint, children }: { label: string; name: string; type?: string; required?: boolean; value?: string | number; hint?: string; children?: ReactNode }) {
  const id = useId();
  // A separate label keeps the control's accessible name to the label text alone.
  const control = isValidElement(children) ? cloneElement(children as ReactElement<{ id?: string }>, { id })
    : <input id={id} name={name} type={type} required={required} defaultValue={value} step={type === 'number' ? '1' : undefined} />;
  return <div className="field"><label htmlFor={id}>{label}</label>{control}{hint && <small className="hint">{hint}</small>}</div>;
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty"><p>{children}</p></div>;
}
export function Status({ value }: { value: string }) {
  const label = value.replaceAll('_', ' ');
  return <span className={`status status-${value}`}>{label.charAt(0).toUpperCase() + label.slice(1)}</span>;
}

/** The one working sheet on a screen; cards and controls remain real children. */
export function Blotter({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`blotter ${className}`}>{children}</div>;
}

/** Message paragraphs wrap normally while preserving the sender's line breaks. */
export function MessageText({ children }: { children: string }) {
  return <div className="message">{children.split('\n\n').map((paragraph, n) => <p key={n}>{paragraph.split('\n').map((line, i) => <Fragment key={i}>{i > 0 && <br />}{line}</Fragment>)}</p>)}</div>;
}
