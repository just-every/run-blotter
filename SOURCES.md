# Source provenance

Official IRS form templates (retrieved 22 October 2026):

- `src/blotter/forms/f2848.pdf`: IRS Form 2848, January 2021, from <https://www.irs.gov/pub/irs-pdf/f2848.pdf>;
  instructions <https://www.irs.gov/pub/irs-pdf/i2848.pdf> (September 2021).
- `src/blotter/forms/f8821.pdf`: IRS Form 8821, January 2021, from <https://www.irs.gov/pub/irs-pdf/f8821.pdf>;
  instructions <https://www.irs.gov/pub/irs-pdf/i8821.pdf> (September 2021).

Blotter fills the official widgets, removes XFA and flattens the prepared values
before adding SIGN-002 fields. Form 2848 has a taxpayer and a staff representative
signer; Form 8821 has a taxpayer signer. Staff review scope, signer authority,
representative eligibility and replacement of earlier authorizations before
preparation. A prepared PDF is a draft, never an IRS submission or acceptance.

Blotter was generated and assembled from the committed Base foundation at
`runeditrun/base@a06bd065124c2b45fa879e62736fb5e1987efdaa`
(`foundation/cli.mjs`, then `composition/cli.mjs`), and converted to package
mode with `@runeditrun/rer@0.2.22` pinned. `composition.lock.json` records the
composition. Blotter owns the product integration from there. The public
Satchel, Barrow and Lanyard mains were read as package-mode examples.

Base copies, byte for byte, recorded with hashes in `base-copies.json`:

- `src/modules/import-kit` (without its tests and proof folders) and
  `src/modules/d1-transport`, from Base `a06bd065`.
- `migrations/core/0015_import.sql` is generated from import-kit's exported D1
  schemas in `initializeD1ImportStorage` order at the same commit.

Adapted MIT application source (Copyright (c) 2026 Run Edit Run):

| Source | Commit | Blotter adaptation |
| --- | --- | --- |
| just-every/run-satchel | `db53e8067fca8a4378a62a0f5a96a19ee7e2f2ba` | `model.ts` (guarded atomic writes, approval records), `session.ts`, `team.ts`, `proposals.ts`, `archive.ts`, `imports.ts`, `imports/csv.ts`, `imports/target.ts`; billing reservations and immutable reviewed exports in `billing.ts`; the test harness |
| just-every/run-gauge | `5fe6d5ee07f4230c1dc838c9097690a52524be3e` | time entries snapshot the person's rate in `billing.ts` |

New in Blotter: recurring job templates and roll-forward (`jobs.ts`), document
requests with the client upload link and reminders (`documents.ts`), reviewer
sign-off, and the client list CSV v1 move-in kit (`imports/client-list.ts`).
The screens use Base's auth/setup/lobby frames and hydration unit, with
Blotter's shared theme, self-hosted Red Hat fonts (OFL), SVG artwork and product
components. The static run site compiles the repository's Markdown guides.
