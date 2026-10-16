# Backup and restore

Download a whole-practice archive, and restore it into an empty installation when you need to move or recover the practice.

## Download an archive

As the principal, open **Team & safety → Backup and restore → Download practice archive**. Keep the `.rer` archive in a private backup location: it contains practice data and client documents.

The archive includes clients, templates, jobs, document requests and files, time, exports, imports and the audit log. Sign-in accounts, sessions, agent keys and client upload links are excluded. After a move, create fresh agent keys and send fresh client reminders.

You can also export from the checkout:

```sh
rer export --output exports/practice.rer
```

## Restore in the app

Prepare an empty installation. As its principal, open **Team & safety → Backup and restore → Restore into this empty installation**. Choose the archive, type `RESTORE` and press **Restore**.

Restore requires an empty destination. It is not a merge into an existing practice. The practice data, approved exports and history return; the destination retains its new sign-in identity.

## Restore from the command line

In a new, empty checkout, copy the archive into its `exports` folder. The input path must be inside that checkout.

```sh
rer import --input exports/practice.rer --yes
rer dev
```

The checkout gets a new local owner. Open the new `RER_OPEN` link and finish setup to use the restored practice.

## After erasing a file

**Team & safety → Erase a client file** permanently removes the selected file's bytes. You must type its filename and give a reason. Its name, hash and history remain.

Make a new archive after an erasure and retire older archives. An older archive cannot be restored without a newer archive carrying the erasure journal. In the app, supply that newer archive in the second Restore file field. From the command line:

```sh
rer import --input exports/older.rer --journal exports/newer.rer --yes
```

The journal keeps erased file bytes from coming back during restore. `rer reset --yes` deletes local data and settings; export the practice first if you need to keep it.
