// Text a search can match inside an uploaded document (SEARCH-002). Plain text
// and CSV files are read as UTF-8. A PDF's content streams (uncompressed or
// FlateDecode) are read for the strings its text operators show: literal
// strings with their escapes, and hex strings as single bytes; a line move or
// a wide TJ kerning gap reads as a space. Scanned images,
// other filters and custom font encodings yield no text; nothing is guessed.
const latin = (bytes: Uint8Array) => Array.from(bytes, b => String.fromCharCode(b)).join('');

async function inflate(bytes: Uint8Array) {
  try {
    const stream = new Blob([bytes.slice()]).stream().pipeThrough(new DecompressionStream('deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch { return null; }
}

function literal(source: string, at: number): [string, number] {
  let out = '', depth = 1, i = at + 1;
  const escapes: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' };
  for (; i < source.length && depth > 0; i++) {
    const c = source[i];
    if (c === '\\') {
      const next = source[++i];
      if (next in escapes) out += escapes[next];
      else if (/[0-7]/.test(next)) { const oct = source.slice(i, i + 3).match(/^[0-7]{1,3}/)![0]; out += String.fromCharCode(parseInt(oct, 8)); i += oct.length - 1; }
    } else if (c === '(') { depth++; out += c; } else if (c === ')') { if (--depth) out += c; } else out += c;
  }
  return [out, i];
}

/** The strings shown by Tj, TJ, ' and " inside one content stream's text objects. */
function shown(content: string) {
  const parts: string[] = [];
  for (const block of content.match(/BT[\s\S]*?ET/g) ?? []) {
    for (let i = 0; i < block.length; i++) {
      if (block[i] === '(') { const [text, end] = literal(block, i); parts.push(text); i = end - 1; }
      else if (block[i] === '<' && block[i + 1] !== '<') { const end = block.indexOf('>', i); const hex = block.slice(i + 1, end).replace(/\s/g, ''); parts.push(hex.match(/../g)?.map(h => String.fromCharCode(parseInt(h, 16))).join('') ?? ''); i = end; }
      else if (block[i] === 'T' && (block[i + 1] === '*' || block[i + 1] === 'd' || block[i + 1] === 'D')) parts.push(' ');
      // Inside a TJ array, a kerning adjustment of more than 150 thousandths of a unit stands for a word space.
      else if (block[i] === '-' && /^-\d/.test(block.slice(i, i + 2))) { const n = block.slice(i).match(/^-\d+(\.\d+)?/)![0]; if (Number(n) < -150) parts.push(' '); i += n.length - 1; }
    }
    parts.push('\n');
  }
  return parts.join('').replace(/[ \t]+/g, ' ');
}

export async function documentText(mime: string, name: string, bytes: Uint8Array) {
  if (/^text\//.test(mime) || /\.(txt|csv)$/i.test(name)) return new TextDecoder().decode(bytes);
  if (mime !== 'application/pdf' && !/\.pdf$/i.test(name)) return '';
  const source = latin(bytes), texts: string[] = [];
  for (const match of source.matchAll(/<<([\s\S]*?)>>\s*stream\r?\n/g)) {
    const start = match.index! + match[0].length, end = source.indexOf('endstream', start);
    if (end < 0) continue;
    const dict = match[1], length = dict.match(/\/Length\s+(\d+)(?!\d)(?!\s+\d+\s+R)/)?.[1];
    let stop = length ? Math.min(start + Number(length), end) : end;
    if (!length) while (stop > start && (bytes[stop - 1] === 10 || bytes[stop - 1] === 13)) stop--;
    const raw = bytes.subarray(start, stop);
    const body = /\/Filter\s*\/FlateDecode/.test(dict) ? await inflate(raw) : /\/Filter/.test(dict) ? null : raw;
    if (body) texts.push(shown(latin(body)));
  }
  return texts.join('\n').trim();
}
