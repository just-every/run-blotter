/** Conservative outbound masking; ambiguous long identifiers are withheld too. */
export function maskAiText(value: string): string {
  const labeled = value.normalize('NFKC')
    // Account identifiers may include letters as well as grouped digits.
    .replace(/\b[A-Z]{2}\d{2}(?:[ -]?[A-Z0-9]{4}){2,7}(?:[ -]?[A-Z0-9]{1,3})?\b/gi, '[REDACTED IBAN]')
    .replace(/\b((?:bank[ \t]+)?account|acct|iban|routing|bsb|sort[ \t]+code|ssn|ein|itin|tin|tfn|abn|acn|tax[ \t]+(?:id|identification|file)[ \t]*(?:number)?)\b([ \t]*(?:(?:number|no\.?|id|is)[ \t]*)?[:#=]?[ \t]*)([A-Z]{0,4}[ -]?[\p{Nd}](?:[ \t().\/-]*[\p{Nd}]){2,33}[A-Z]{0,4}|[A-Z0-9]{0,30}\p{Nd}[A-Z0-9]{2,30})/giu,
      (_match, label: string) => `${label}: [REDACTED IDENTIFIER]`);
  // Preserve real calendar dates only after labeled identifiers are withheld.
  return labeled.split(/(\b\d{4}-\d{2}-\d{2}\b)/g).map(part => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(part) && Number.isFinite(Date.parse(part)) &&
        new Date(part).toISOString().slice(0, 10) === part) return part;
    // Includes SSNs, EINs, ITINs, tax identifiers and unlabeled accounts.
    return part.replace(/\p{Nd}(?:[ \t().\/-]*\p{Nd}){7,}/gu, '[REDACTED NUMBER]');
  }).join('');
}
