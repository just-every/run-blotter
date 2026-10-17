// Small, real client documents for the sample practice: CSV registers and
// one-page PDFs that open when downloaded.

const encoder = new TextEncoder();
const base64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

/** A minimal valid one-page PDF holding a few lines of text. */
export function pdf(lines: string[]) {
  const escape = (line: string) => line.replace(/[\\()]/g, c => '\\' + c);
  const content = ['BT /F1 11 Tf 56 760 Td 15 TL', ...lines.map((line, n) => `${n ? 'T* ' : ''}(${escape(line)}) Tj`), 'ET'].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets = objects.map((object, n) => { const at = body.length; body += `${n + 1} 0 obj\n${object}\nendobj\n`; return at; });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(at => `${String(at).padStart(10, '0')} 00000 n \n`).join('')}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return encoder.encode(body);
}

export const csv = (rows: (string | number)[][]) => encoder.encode(rows.map(row => row.join(',')).join('\r\n') + '\r\n');
export { base64 };
