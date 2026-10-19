import { cloneElement, isValidElement, useId, type FormEvent, type ReactElement, type ReactNode } from 'react';

export type Row = Record<string, any>;
export type Run = (job: () => Promise<any>, message?: string) => Promise<void>;

export async function api(path: string, body?: unknown) {
  const response = await fetch('/api/blotter' + path, { credentials: 'same-origin', ...(body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) });
  const result: any = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(result.error ?? 'The request could not be completed'), { mfa: result.mfa as string | undefined });
  return result;
}
/** Where a time entry's rate came from (TIME-003 rate cards). */
export const SOURCE: Record<string, string> = { client_service: 'client and service', client: 'client', service: 'service', staff: 'staff member', role: 'role' };
export const money = (cents: number, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency, currencyDisplay: 'code' }).format(Number(cents) / 100);
export const taxId = (value: string) => value ? `${value.length === 11 ? 'Legacy ABN' : 'EIN'} •••••${value.slice(-4)}` : '';
export const moneyTotals = (rows: Row[], key: string) => Object.entries(rows.reduce((totals: Record<string, number>, r: Row) => { totals[r.currency] = (totals[r.currency] ?? 0) + Number(r[key]); return totals; }, {})).map(([currency, cents]) => money(cents as number, currency)).join(' · ');
const pad = (n: number) => String(n).padStart(2, '0');
/** Dates and times in the viewer's own timezone, US style (stored values stay UTC; date-only values are calendar days). */
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const instant = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + 'T12:00:00') : new Date(value);
/** "Tue Oct 13", with the year when it is not this year. */
export const day = (value?: string) => {
  if (!value) return '';
  const d = instant(value), year = d.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' as const };
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', ...year }).replaceAll(',', '');
};
/** "8:10 am". */
export const clock = (value?: string) => value ? instant(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/\s?([AP])M/, (_, m: string) => ` ${m.toLowerCase()}m`) : '';
/** "Tue Oct 13 · 8:10 am". */
export const when = (iso?: string) => iso ? `${day(iso)} · ${clock(iso)}` : '';
export const initials = (name = '') => name.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('');

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

/** A tinted band holding a screen's main cards, as the wall's bands hold theirs. */
export function Blotter({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`blotter ${className}`}>{children}</div>;
}

/** The screen's head: tracked eyebrow, the heavy display heading (one word may carry the marigold marker), and a slot at the right. */
export function PageHead({ eyebrow, title, mark, children }: { eyebrow: ReactNode; title: string; mark?: string; children?: ReactNode }) {
  const at = mark ? title.indexOf(mark) : -1;
  return <header className="page-head">
    <div className="page-title">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{at < 0 ? title : <>{title.slice(0, at)}<span className="marked">{mark}</span>{title.slice(at + mark!.length)}</>}{mark && <Sparks />}</h1>
    </div>
    {children}
  </header>;
}
/** Two marigold marker ticks after a heading, as the mark's own sparks. */
export function Sparks() {
  return <svg className="sparks" viewBox="0 0 40 44" aria-hidden="true"><path d="M8 18 L20 4 M10 26 L32 22 M10 34 L24 42" /></svg>;
}
