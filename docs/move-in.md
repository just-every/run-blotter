# Move in

Bring your client list from a spreadsheet or another practice tool, with a preview before anything is imported.

Only the principal can import. Blotter accepts its documented CSV shape; rename your previous tool's columns to match it before importing. It does not read a vendor-specific export directly.

## Prepare your CSV

Use UTF-8 CSV with one header row, 1–2,000 client rows and a maximum file size of 1 MB. Quoted fields may contain commas, quotes and new lines.

| Column | Required | Rules |
| --- | --- | --- |
| `client_name` | Yes | 1–200 characters. |
| `client_id` | No | Previous system's identifier, up to 200 characters. Without it, identity is the client's name and ABN. |
| `abn` | No | The client's Australian Business Number: empty or 11 digits; spaces allowed. The checksum is not checked. |
| `contact_name` | No | Up to 200 characters. |
| `contact_email` | No | Empty or one email address. Reminders go here. |
| `tags` | No | Up to 20 tags separated by semicolons. |
| `field:<key>` | When the field is required | One column per [client field](/docs/getting-started), named by its key, such as `field:service_tier`. Values follow the field's type and choices. A column for an unknown key stops the file. |

Additional columns stay in the stored original file and produce a warning; they are not imported. Duplicate identities or invalid rows stop the whole file, with row numbers in the preview.

The repository includes an [example client list](https://github.com/just-every/run-blotter/blob/main/fixtures/client-list.csv), including an extra column to demonstrate the warning.

## Preview and import

1. Open **Move in → Client list file** and choose your CSV, or paste it into **CSV contents**.
2. Press **Preview (dry run)**. Check the client list, counts, warnings and errors. No records are written by the preview.
3. Resolve any errors, preview again and press **Import these clients**. This imports exactly the file you reviewed. A changed file needs a new preview. Importing the same file again returns the same import instead of duplicating it.
4. Under **Import journal**, choose **View journal** to inspect progress, the original file's name and its SHA-256 hash. If a large import stops part-way, use **Resume**.

## Undo an import

Choose **Undo import** in the journal. Blotter removes imported clients unless they already have jobs or their details changed after import. The journal reports which clients were kept and why.

Imported clients work like any other client. Continue in [Clients & templates](/docs/jobs) when the list is ready.
