import { useEffect, useRef, useState } from 'react';
import { api, Field, type Row, type Run } from './common';

export function AiSettings({ run, tick }: { run: Run; tick: number }) {
  const [settings, setSettings] = useState<Row>(), [reference, setReference] = useState(''), [busy, setBusy] = useState(false);
  const dirty = useRef(false), saving = useRef(false);
  useEffect(() => {
    let active = true;
    api('/ai/settings').then(value => {
      if (!active || saving.current) return;
      setSettings(value);
      if (!dirty.current) setReference(value.attestationRef);
    }).catch(error => run(async () => { throw error; }));
    return () => { active = false; };
  }, [tick]);
  const save = async (enabled: boolean) => {
    if (saving.current || !settings) return;
    saving.current = true; setBusy(true);
    await run(async () => {
      const attestationRef = reference.trim();
      await api('/ai/settings', { enabled, attestationRef });
      setSettings({ ...settings, enabled, attestationRef });
      setReference(attestationRef); dirty.current = false;
    }, 'Saved');
    saving.current = false; setBusy(false);
  };
  if (!settings) return null;
  return <section className="panel wide">
    <h2>AI assistance</h2>
    <details><summary>Enable source review assistance</summary>
      <p>AI assistance is off by default. Record the reference to your firm's completed attestation before enabling it.</p>
      <p className="muted">Provider: {settings.provider} · model: {settings.model}. Staff choose a source and explicitly confirm each request. AI prepares proposals for human review.</p>
      <Field label="Recorded attestation reference" name="aiAttestationRef" hint="Saves when you leave this field.">
        <input name="aiAttestationRef" value={reference} disabled={busy} onChange={event => { dirty.current = true; setReference(event.target.value); }} onBlur={() => {
          if (reference.trim() === settings.attestationRef) { dirty.current = false; setReference(reference.trim()); setSettings({ ...settings }); }
          else if (reference.trim()) save(settings.enabled);
        }} />
      </Field>
      <label className="check"><input type="checkbox" checked={settings.enabled} disabled={busy || !settings.attestationRef || dirty.current} onChange={event => save(event.target.checked)} /> Enable AI assistance for this firm</label>
      {!settings.attestationRef && <p className="muted">Record an attestation reference to enable assistance.</p>}
    </details>
  </section>;
}
