// A valid 24-page bank/receipts PDF with transaction tables and page scan images.
// The original is deliberately bigger than the historical 1 MiB attachment cap.
export function accountingPacket(corrected = false, pageCount = 24) {
  const objects = [], add = content => { objects.push(Buffer.isBuffer(content) ? content : Buffer.from(content)); return objects.length; };
  const catalog = add(''), pages = add(''), font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'), kids = [];
  for (let page = 1; page <= pageCount; page++) {
    const pixels = Buffer.alloc(240 * 320, 253);
    for (let y = 20; y < 300; y++) for (let x = 15; x < 225; x++) if ((y % 11 === 0 && x % 5 > 0) || x === 15 || x === 224) pixels[y * 240 + x] = 225;
    const image = add(Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width 240 /Height 320 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length ${pixels.length} >>\nstream\n`), pixels, Buffer.from('\nendstream')]));
    const title = `Chen Holdings - ${corrected ? 'Corrected' : 'Original'} quarterly bank and receipt packet`;
    const lines = [`BT /F1 12 Tf 45 740 Td (${title}) Tj 0 -20 Td (Statement page ${page} - account ending 1482 - period 2026 Q3) Tj`];
    for (let row = 0; row < 32; row++) lines.push(`0 -18 Td (Sep ${String(row % 30 + 1).padStart(2, '0')}   Receipt ${page}-${row}   Office supplier   Debit ${corrected && page === 7 && row === 12 ? '149.50' : '125.00'}   Reconciled) Tj`);
    lines.push('ET');
    const content = Buffer.from(`q 510 0 0 680 40 45 cm /Scan Do Q\n${lines.join('\n')}\n`), stream = add(Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`), content, Buffer.from('endstream')]));
    kids.push(add(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> /XObject << /Scan ${image} 0 R >> >> /Contents ${stream} 0 R >>`));
  }
  objects[catalog - 1] = Buffer.from(`<< /Type /Catalog /Pages ${pages} 0 R >>`);
  objects[pages - 1] = Buffer.from(`<< /Type /Pages /Count ${kids.length} /Kids [${kids.map(k => `${k} 0 R`).join(' ')}] >>`);
  const parts = [Buffer.from('%PDF-1.4\n')], offsets = [0]; let at = parts[0].length;
  objects.forEach((object, index) => { offsets.push(at); const part = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`), object, Buffer.from('\nendobj\n')]); parts.push(part); at += part.length; });
  parts.push(Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${at}\n%%EOF\n`));
  return Buffer.concat(parts);
}
