import { PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';

// Read actual PDF objects and their declared stream lengths. A regex around
// `endstream` can mistake a compressed payload's final CR byte for a delimiter.
export async function pdfText(bytes) {
  const document = await PDFDocument.load(bytes);
  let text = '';
  for (const [, object] of document.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFRawStream) || object.dict.get(PDFName.of('Subtype'))?.toString() === '/Image') continue;
    const content = Buffer.from(decodePDFRawStream(object).decode()).toString('latin1');
    for (const match of content.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) text += Buffer.from(match[1], 'hex').toString('latin1');
  }
  return text;
}
