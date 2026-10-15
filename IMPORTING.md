# Move in: client list CSV v1

Blotter's first move-in kit brings a practice's client list across from a
spreadsheet or a previous practice tool. It runs on Base's import-kit: a dry run
first, an exact reviewed commit, a durable journal with the original file, resume
for large files, and undo.

This is Blotter's own documented shape. It makes no claim to read any vendor's
export directly: most practice tools can export a client list to CSV, and you
rename the columns to match the table below before importing.

## The shape

UTF-8 CSV (RFC 4180: quoted fields may contain commas, quotes and new lines),
one header row, 1 to 2,000 client rows, at most 1 MB.

| Column | Required | Rules |
| --- | --- | --- |
| `client_name` | yes | 1–200 characters |
| `client_id` | no | Your previous system's identifier, up to 200 characters. Without it, a client's identity is its name and ABN. |
| `abn` | no | Empty, or 11 digits (spaces allowed). The checksum is not checked. |
| `contact_name` | no | Up to 200 characters |
| `contact_email` | no | Empty or one email address. Reminders go here. |

Any other column is kept in the stored original file and listed as a warning;
it is not imported. A row that repeats an identity, or breaks a rule, stops the
whole file: the dry run lists every problem with its row number.

[fixtures/client-list.csv](fixtures/client-list.csv) is a complete example with
an extra `practice_notes` column.

## Steps

1. **Move in → Client list file:** choose the CSV (or paste it).
2. **Preview (dry run):** nothing is written. Check the counts, errors and
   warnings, and the client list.
3. **Import these clients:** commits exactly the file you previewed. If the file
   changed since the preview, Blotter refuses and asks for a new preview.
   Importing the same file again returns the same import instead of duplicating it.
4. **View journal:** the job's state, the original file's name and SHA-256, and
   after an undo, what was removed and what was kept.
5. **Resume** finishes a large import that stopped part-way.
6. **Undo import** removes the imported clients, except any client that already
   has a job, or whose details changed since the import; the journal says which
   were kept and why.

Only the principal can import. Imported clients behave like any other client.
