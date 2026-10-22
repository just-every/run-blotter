// Official IRS January 2021 templates; provenance and instructions are in SOURCES.md.
import { PDFDocument, PDFTextField, StandardFonts } from 'pdf-lib';
import form2848 from './forms/f2848.pdf?inline';
import form8821 from './forms/f8821.pdf?inline';
import { insist, optional, text, type Data } from './model';
import { base64, unbase64 } from './signatures-pdf';

/** Fill the actual IRS widgets, remove XFA and freeze the prepared values before SIGN-002 overlays signatures. */
export async function authorizationPdf(a: Data, body: Data, signerName: string) {
  const source = a.kind === '2848' ? form2848 : form8821;
  const pdf = await PDFDocument.load(unbase64(source.slice(source.indexOf(',') + 1))), form = pdf.getForm();
  form.deleteXFA();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const set = (leaf: string, value: string) => {
    const field = form.getFields().find(f => f.getName().endsWith(`.${leaf}[0]`));
    insist(field instanceof PDFTextField, `Official IRS field ${leaf} is unavailable`);
    insist(/^[\x20-\x7e\xa0-\xff\r\n]*$/.test(value), 'Use Latin characters supported by the IRS form');
    const rect = field.acroField.getWidgets()[0].getRectangle();
    const lines = value.split(/\r?\n/), size = Math.min(9, ...lines.map(line => (rect.width - 4) / Math.max(font.widthOfTextAtSize(line, 1), 1)), (rect.height - 2) / lines.length);
    insist(size >= 5, `${leaf}: the value does not fit the IRS form; shorten it or use fewer address lines`);
    field.setText(value); field.setFontSize(size);
  };
  const name = text(body.taxpayerName, 'Taxpayer legal name', 100), address = text(body.taxpayerAddress, 'Taxpayer mailing address', 200);
  const tin = text(body.taxpayerTin, 'Taxpayer identification number', 20).replace(/\D/g, '');
  insist(['ein', 'ssn', 'itin'].includes(body.tinType) && /^\d{9}$/.test(tin), 'Choose the TIN type and enter its nine digits');
  const formattedTin = body.tinType === 'ein' ? `${tin.slice(0, 2)}-${tin.slice(2)}` : `${tin.slice(0, 3)}-${tin.slice(3, 5)}-${tin.slice(5)}`;
  const repAddress = text(body.representativeAddress, 'Representative mailing address', 200), repPhone = text(body.representativePhone, 'Representative telephone', 30);
  const phone = optional(body.taxpayerPhone, 'Taxpayer telephone', 30), ptin = optional(body.ptin, 'PTIN', 20), title = optional(body.taxpayerTitle, 'Signer title or capacity', 60);
  const list: Data[] = JSON.parse(a.matters);
  const rows = list.length <= 3 ? list : [{ matter: 'See attached tax matters', form: 'See attachment', from: '', to: '' }];
  if (a.kind === '2848') {
    set('TaxpayerName', name); set('TaxpayerAddress', address);
    set({ ein: 'TaxpayerIDEIN', ssn: 'TaxpayerIDSSN', itin: 'TaxpayerIDITIN' }[body.tinType as 'ein' | 'ssn' | 'itin'], formattedTin);
    set('TaxpayerTelephone', phone); set('RepresentativesName1', a.representative); set('RepresentativesAddress1', repAddress);
    set('CAFNumber1', a.caf_number || 'None'); set('PTIN1', ptin); set('TelephoneNo1', repPhone);
    const designation = text(body.designation, 'Representative designation', 1);
    insist(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'k', 'r'].includes(designation), 'Choose the representative designation printed on Form 2848');
    set('Designation1', designation); set('Jurisdiction1', text(body.jurisdiction, 'Licensing jurisdiction or other authority', 60));
    set('Bar1', optional(body.licenseNumber, 'License, bar or enrollment number', 40));
    set('PrintName', signerName); set('Title', title); set('PrintNameTaxpayer', name === signerName ? '' : name);
    rows.forEach((m, i) => { set(`Description${i + 1}`, m.matter); set(`TaxForm${i + 1}`, m.form); set(`Years${i + 1}`, m.from ? `${m.from}-${m.to}` : 'See attachment'); });
  } else {
    set('f1_6', `${name}\n${address}`); set('f1_7', formattedTin); set('f1_8', phone);
    set('f1_10', `${a.representative}\n${repAddress}`); set('f1_11', a.caf_number || 'None'); set('f1_12', ptin); set('f1_13', repPhone);
    rows.forEach((m, i) => { set(`f1_${20 + i * 4}`, m.matter); set(`f1_${21 + i * 4}`, m.form); set(`f1_${22 + i * 4}`, m.from ? `${m.from}-${m.to}` : 'See attachment'); });
    set('f1_32', signerName); set('f1_33', title);
  }
  form.updateFieldAppearances(font); form.flatten();
  if (list.length > 3) {
    const page = pdf.addPage([612, 792]); let y = 750;
    for (const line of [`Form ${a.kind} - Line 3 continuation`, name, `Taxpayer identification number: ${formattedTin}`, ...list.flatMap(m => [m.matter, `Form ${m.form}: ${m.from}-${m.to}`])]) {
      insist(font.widthOfTextAtSize(line, 9) < 540, 'A tax matter is too long for the continuation page');
      page.drawText(line, { x: 36, y, size: 9, font }); y -= 22;
    }
  }
  pdf.setTitle(`Form ${a.kind} - ${name}`); pdf.setSubject(`IRS Form ${a.kind}, January 2021; https://www.irs.gov/pub/irs-pdf/f${a.kind}.pdf; prepared for review, not submitted`);
  return base64(await pdf.save());
}

/** Geometry is in SIGN-002 top-left points. The official 2848 representative boxes are 12pt high; use a 16pt overlay above their baseline. */
export function authorizationFields(kind: string, contactId: string, representativeEmail: string) {
  const field = (type: string, signer: string, page: number, x: number, y: number, width: number, height: number, label: string) => ({ type, contactId: signer, page, x, y, width, height, label });
  return kind === '2848' ? [
    field('signature', contactId, 2, 36, 216, 223, 24, 'Taxpayer signature'), field('date', contactId, 2, 274, 216, 72, 24, 'Taxpayer date'),
    field('signature', `staff:${representativeEmail}`, 2, 296, 632, 221, 16, 'Representative signature'), field('date', `staff:${representativeEmail}`, 2, 518, 632, 58, 16, 'Representative date'),
  ] : [field('signature', contactId, 1, 58, 636, 374, 24, 'Taxpayer signature'), field('date', contactId, 1, 432, 636, 122, 24, 'Taxpayer date')];
}
