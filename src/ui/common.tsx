import { cloneElement, isValidElement, useId, type FormEvent, type ReactElement, type ReactNode } from 'react';

export type Row = Record<string, any>;
export type Run = (job: () => Promise<any>, message?: string) => Promise<void>;

export async function api(path: string, body?: unknown) {
  const response = await fetch('/api/blotter' + path, { credentials: 'same-origin', ...(body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) });
  const result: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error ?? 'The request could not be completed');
  return result;
}
export const aud = (cents: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(Number(cents) / 100);
const pad = (n: number) => String(n).padStart(2, '0');
/** Dates and times in the viewer's own timezone (stored values stay UTC). */
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const when = (iso?: string) => { if (!iso) return ''; const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };

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
  return <span className={`status status-${value}`}>{value.replace('_', ' ')}</span>;
}
