# Move in: reviewed client and contact CSV

Blotter's first move-in kit brings a practice's client list across from a
spreadsheet or a previous practice tool. It runs on Base's import-kit: a dry run
first, an exact reviewed commit, a durable journal with the original file, resume
for large files, and undo.

This is Blotter's own documented shape. It makes no claim to read any vendor's
export directly: most practice tools can export a client list to CSV, and you
map source columns to the fields below in Move in, without rewriting the original file. The authenticated API also retains the original v1 fixed-column door for existing imports.

## The shape

UTF-8 CSV (RFC 4180: quoted fields may contain commas, quotes and new lines),
one header row, 1 to 2,000 source rows, at most 1 MB. Repeated client IDs group contact rows into one entity when every mapped entity field agrees; conflicting entity or contact values block the whole preview.

| Column | Required | Rules |
| --- | --- | --- |
| `client_name` | yes | 1–200 characters |
| `client_id` | no | Your previous system's identifier, up to 200 characters. Without it, a client's identity is its name and tax ID (unchanged for legacy ABN rows). |
| `ein` | no | Empty, or 9 digits (spaces and hyphens allowed). Supply either EIN or legacy ABN, never both. |
| `abn` | no | Legacy Australian ABN only: empty, or 11 digits (spaces allowed); never relabelled as EIN. The checksum is not checked. |
| `contact_name` | no | Up to 200 characters |
| `contact_email` | no | Empty or one email address. Reminders go here. |
| `tags` | no | Up to 20 tags separated by semicolons, each up to 40 characters |
| `field:<key>` | when the field is required | One column per firm-defined client field, named by its key (for example `field:service_tier`). The value follows the field's type and choices; a required field must have a value. A column for an unknown key stops the file. |

The mapped format also accepts `entity_type` (individual, business or trust; default business), `contact_id` (stable within its entity, otherwise exact normalized email), `contact_phone`, `contact_roles` (primary;billing;tax;bookkeeping), `authorized`, `signer`, `portal`, `request_consent`, `email_consent` (literal true/false), and `consent_note`. These contact permission flags default false. A signer or portal contact requires explicit entity authority. Phone validation is the same as native contacts; a matching email on another entity never pools records or authority. Repeated contact identity with identical values is one relationship; differing values block preview. Up to thirty contacts belong to an imported entity. The single-contact v1 API retains its established entity collection authority for historical imports.

Possible duplicates (same normalized name or nonempty EIN/legacy tax id) require an explicit decision: keep a separate entity, or associate the source with a matching active entity of the same type. A match records source provenance only, never overwrites native fields or grants. Every supplied contact must exactly match that entity's existing contact values and permissions; conflicts need review in Clients or an explicit separate entity. CRM-004 remains the reviewed merge door. Source IDs and their associations survive later native merges and re-imports; changed source content or mapping is refused rather than overwriting the first import.

Any other column is kept in the stored original file and listed as a warning;
it is not imported. A conflicting identity or a row that breaks a rule stops the
whole file: the dry run lists every problem with its row number.

[fixtures/client-list.csv](fixtures/client-list.csv) is a complete example with
an extra `practice_notes` column.

## Steps

1. **Move in → Client list file:** choose the CSV (or paste it), then choose each source column in Map CSV columns.
2. **Preview (dry run):** nothing is written. Check the counts, errors and
   warnings, entity/contact permissions and possible duplicates. Choose every duplicate decision and preview again.
3. **Import these clients:** commits exactly the file, field mapping and duplicate decisions you previewed. If the file
   or mapping/decisions changed since the preview, Blotter refuses and asks for a new preview.
   Importing the same file again returns the same import instead of duplicating it.
4. **View journal:** the job's state, the original file's name and SHA-256, and
   after an undo, what was removed and what was kept.
5. **Resume** finishes a large import that stopped part-way.
6. **Undo import** removes the imported clients, except any client that already
   has native dependent work, another source association, or whose entity/contact details changed since the import; the journal says which
   were kept and why.

Only the principal can import. Imported clients behave like any other client.

The mapped import journal retains the original UTF-8 bytes, selected mapping, duplicate decisions and stable source identities. Only the principal can read it. Practice archives carry the journal, original and relationships; source matches never make private originals public. Resume uses the retained reviewed plan, including after archive restore. Undo removes untouched newly created contacts/entities and source-only matches, preserving every matched native entity and all conflicting/native work.
