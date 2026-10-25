import { useEffect, useRef, useState } from 'react';
import { api, Field, type Row, type Run } from './common';

export function AiSettings({ run, tick }: { run: Run; tick: number }) {
  const [settings, setSettings] = useState<Row>(), [reference, setReference] = useState(''), [limit,setLimit]=useState('3'), [busy, setBusy] = useState(false);
  const dirty = useRef(false), saving = useRef(false);
  useEffect(() => {
    let active = true;
    api('/ai/settings').then(value => {
      if (!active || saving.current) return;
      setSettings(value);
      setLimit(String(value.requestLimit));
      if (!dirty.current) setReference(value.attestationRef);
    }).catch(error => run(async () => { throw error; }));
    return () => { active = false; };
  }, [tick]);
  const save = async (enabled: boolean) => {
    if (saving.current || !settings) return;
    saving.current = true; setBusy(true);
    await run(async () => {
      const attestationRef = reference.trim();
      const saved=await api('/ai/settings', { enabled, attestationRef, requestLimit:Number(limit) });
      setSettings(saved);
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
      <p>{settings.used} of {settings.requestLimit} approved requests used. Failed provider attempts consume a request. Each request is limited to 24,000 source characters and 1,200 output tokens.</p>
      <Field label="Maximum requests under this approval" name="aiRequestLimit"><input type="number" min="1" max="1000" value={limit} disabled={busy} onChange={event=>{dirty.current=true;setLimit(event.target.value);}} onBlur={()=>{if(reference.trim() && Number(limit)!==settings.requestLimit)save(settings.enabled);else {dirty.current=false;setSettings({...settings});}}} /></Field>
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
