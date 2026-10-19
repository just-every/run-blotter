// Read one bounded archive line at a time; never load a firm archive into one string.
export async function* archiveFile(file: File) {
  const reader = file.stream().pipeThrough(new TextDecoderStream()).getReader();
  let pending = '';
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      pending += next.value;
      let end;
      while ((end = pending.indexOf('\n')) >= 0) { const line = pending.slice(0, end); pending = pending.slice(end + 1); if (line.trim()) { if (line.length > 24_000_000) throw new Error('Archive line exceeds 24 million characters'); yield JSON.parse(line); } }
      if (pending.length > 24_000_000) throw new Error('Archive line exceeds 24 million characters');
    }
    if (pending.trim()) yield JSON.parse(pending);
  } finally { await reader.cancel(); reader.releaseLock(); }
}
