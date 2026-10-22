// What a signature document is, read from its own text as well as its labels.
import { documentText } from './pdf-text';

/** IRS e-file authorization forms (8879 family, 8878) need SIGN-001's KBA and login evidence, not general signing. */
const eFileLabel = /\b(?:8879(?:-(?:S|PE|C|F))?|8878)\b/i, eFileText = /\bForm\s*(?:8879(?:\s*-\s*(?:S|PE|C|F))?|8878)\b/i;
/** Forms 2848 and 8821 are signed remotely only after a staff member attests how the signer was authenticated. */
const authorityLabel = /\b(?:2848|8821)\b/, authorityText = /\bForm\s*(?:2848|8821)\b/i;

export async function classifyForm(labels: string[], bytes: Uint8Array) {
  const words = (await documentText('application/pdf', 'document.pdf', bytes)).replace(/\s+/g, ' '), joined = labels.join(' ');
  return { eFile: eFileLabel.test(joined) || eFileText.test(words), attestation: authorityLabel.test(joined) || authorityText.test(words) };
}
