import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { type Data } from './model';

export const invoiceNumber = (number: number) => `INV-${String(number).padStart(6, '0')}`;
const usd = (cents: number) => `USD ${(cents / 100).toFixed(2)}`;
const wrap = (value: string, length = 88) => {
  const lines: string[] = [];
  for (const paragraph of value.split(/\r?\n/)) {
    let rest = paragraph;
    while (rest.length > length) {
      const split = rest.lastIndexOf(' ', length);
      const at = split > length / 2 ? split : length;
      lines.push(rest.slice(0, at)); rest = rest.slice(at).trimStart();
    }
    lines.push(rest);
  }
  return lines;
};

/** A numbered, paginated PDF containing the approved snapshot and every source reference. */
export async function invoicePdf(snapshot: Data, number: number) {
  const doc = await PDFDocument.create(), regular = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle(`${invoiceNumber(number)} - ${snapshot.title}`);
  doc.setAuthor(snapshot.firm.name); doc.setSubject('Approved USD invoice');
  const lines: { text: string; strong?: boolean }[] = [];
  const add = (value: string, strong = false) => lines.push(...wrap(value).map(text => ({ text, strong })));
  add(snapshot.firm.name, true);
  add([snapshot.firm.address, snapshot.firm.city, snapshot.firm.state, snapshot.firm.zip].filter(Boolean).join(', '));
  add(''); add(invoiceNumber(number), true); add(snapshot.title, true);
  add(`Issue date: ${snapshot.issueDate}    Due date: ${snapshot.dueDate}`);
  add(`Bill to: ${snapshot.client.name}`); add(`${snapshot.recipient.name} <${snapshot.recipient.email}>`);
  add(`Work: ${snapshot.job.title} - ${snapshot.job.period_label}`); add('');
  for (const [index, line] of (snapshot.lines as Data[]).entries()) {
    add(`${index + 1}. ${line.description} - ${usd(line.amount_cents)}`, true);
    if (line.minutes !== undefined && line.minutes !== null) add(`   ${line.minutes} minutes at ${usd(line.rate_cents)}/hour; ${line.date}`);
    add(`   Source: ${line.source_key}${line.reference ? `; ${line.reference}` : ''}`);
    if (line.authorization) add(`   Fee authority: ${line.authorization}`);
  }
  add(''); add(`Subtotal: ${usd(snapshot.subtotalCents)}`);
  add(`Supplied sales tax: ${usd(snapshot.taxCents)} - ${snapshot.taxTreatment}`);
  add(`Tax authorization: ${snapshot.taxAuthorization}`);
  for (const credit of snapshot.credits as Data[]) add(`${credit.kind === 'deposit' ? 'Deposit' : 'Credit'} ${credit.reference}: -${usd(credit.amountCents)}`);
  add(`Amount due at issue: ${usd(snapshot.totalCents)}`, true);
  add(''); add(`Terms: ${snapshot.terms}`);
  add(`Approved by: ${snapshot.approvedBy}`);
  let page = doc.addPage([612, 792]), y = 744, pageNumber = 1;
  const footer = () => page.drawText(`${invoiceNumber(number)} | Page ${pageNumber}`, { x: 42, y: 28, size: 9, font: regular, color: rgb(.35, .35, .35) });
  for (const line of lines) {
    if (y < 60) { footer(); page = doc.addPage([612, 792]); y = 744; pageNumber++; }
    // Standard PDF fonts cover western names. Preserve otherwise unencodable
    // characters visibly by their Unicode codepoint rather than dropping text.
    const printable = [...line.text].map(char => { try { regular.encodeText(char); return char; } catch { return `[U+${char.codePointAt(0)!.toString(16).toUpperCase()}]`; } }).join('');
    for (const text of wrap(printable)) {
      if (y < 60) { footer(); page = doc.addPage([612, 792]); y = 744; pageNumber++; }
      page.drawText(text, { x: 42, y, size: 10, font: line.strong ? bold : regular }); y -= 15;
    }
  }
  footer();
  return doc.save();
}

export const invoiceBase64 = (bytes: Uint8Array) => {
  let out = ''; for (let n = 0; n < bytes.length; n += 0x8000) out += String.fromCharCode(...bytes.subarray(n, n + 0x8000));
  return btoa(out);
};
export function invoicePdfResponse(invoice: Data) {
  const bytes = Uint8Array.from(atob(invoice.pdf_base64), c => c.charCodeAt(0));
  return new Response(bytes, { headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${invoiceNumber(invoice.number)}.pdf"`, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
}
