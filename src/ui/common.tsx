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
/** "USD 1,234.50" as plain text, for labels and options. */
export const moneyText = (cents: number, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency, currencyDisplay: 'code' }).format(Number(cents) / 100);
/** An amount on one line with tabular figures. */
export const money = (cents: number, currency = 'USD') => <span className="money">{moneyText(cents, currency)}</span>;
export const taxId = (value: string) => value ? `${value.length === 11 ? 'Legacy ABN' : 'EIN'} •••••${value.slice(-4)}` : '';
const sums = (rows: Row[], key: string) => Object.entries(rows.reduce((totals: Record<string, number>, r: Row) => { totals[r.currency] = (totals[r.currency] ?? 0) + Number(r[key]); return totals; }, {}));
/** Per-currency totals ("USD 120.00 · AUD 40.00"), never converted; null when there are none. */
export const moneyTotals = (rows: Row[], key: string) => { const list = sums(rows, key); return list.length ? <>{list.map(([currency, cents], n) => <Fragment key={currency}>{n > 0 && ' · '}{money(cents, currency)}</Fragment>)}</> : null; };
export const moneyTotalsText = (rows: Row[], key: string) => sums(rows, key).map(([currency, cents]) => moneyText(cents, currency)).join(' · ');
/** A person by name where the app knows it; the email otherwise. */
export const who = (people: Row[] | undefined, email?: string) => !email ? '' : people?.find(p => p.email === email)?.name || email;
let displayZone = 'America/New_York';
/** Firm-local dates and instants, US style; date-only deadlines keep their recorded calendar day. Stored values stay UTC. */
const dateOnly = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const zoned = (value: string) => dateOnly(value) ? { at: new Date(value + 'T12:00:00Z'), timeZone: 'UTC' } : { at: new Date(value), timeZone: displayZone };
const parts = (d: Date) => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: displayZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' }).formatToParts(d).map(p => [p.type, p.value]));
/** The firm's calendar day as a native date input value ("2026-10-19"). */
export const today = () => { const p = parts(new Date()); return `${p.year}-${p.month}-${p.day}`; };
/** "Tue Oct 13", with the year when it is not this year ("Wed Dec 23, 2025"). */
export const day = (value?: string) => {
  if (!value) return '';
  const { at, timeZone } = zoned(value), year = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric' }).format(at) === today().slice(0, 4) ? {} : { year: 'numeric' as const };
  return at.toLocaleDateString('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric', ...year }).replace(/^(\w{3}),/, '$1');
};
/** "8:10 am". */
export const clock = (value?: string) => value ? new Date(value).toLocaleTimeString('en-US', { timeZone: displayZone, hour: 'numeric', minute: '2-digit' }).replace(/\s?([AP])M/, (_, m: string) => ` ${m.toLowerCase()}m`) : '';
/** "Tue Oct 13 · 8:10 am EDT" in the firm's zone; a date-only value prints its day. */
export const when = (iso?: string) => !iso ? '' : dateOnly(iso) ? day(iso) : `${day(iso)} · ${clock(iso)} ${parts(new Date(iso)).timeZoneName}`;
/** Server-written text (summaries, reasons, history details) with its ISO dates and instants printed US style. */
export const prose = (text?: string) => String(text ?? '').replace(/\b20\d\d-\d\d-\d\d(T[\d:.]+Z)?\b/g, (iso, time) => time ? when(iso) : day(iso));
/** "Tue Oct 13" to "Mon Oct 19" for a run of calendar days. */
export const days = (from?: string, to?: string) => from === to ? day(from) : `${day(from)} to ${day(to)}`;
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
/** Message paragraphs wrap normally while preserving the sender's line breaks. */
export function MessageText({ children }: { children: string }) {
  return <div className="message">{children.split('\n\n').map((paragraph, n) => <p key={n}>{paragraph.split('\n').map((line, i) => <Fragment key={i}>{i > 0 && <br />}{line}</Fragment>)}</p>)}</div>;
}
