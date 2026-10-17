# Blotter

Blotter is the job workflow for a small Australian bookkeeping or accounting
practice: recurring client jobs such as the quarterly BAS, document requests
that clients answer through a private upload link, reviewer sign-off, and time
exported for your own billing. It runs in your own Cloudflare account. MIT licensed.

Blotter does not lodge anything with the ATO, calculate tax, GST or due dates,
keep client books, or give advice. Due dates are recorded by people.

## Clone and run

You need macOS, Linux or Windows with WSL2, and Git.

```sh
npx -y @runeditrun/rer dev just-every/run-blotter
```

No Node? `curl -fsSL https://runeditrun.com/install.sh | sh -s -- dev just-every/run-blotter` brings its own Node and does the same.

That line clones Blotter and starts the app. To start it again later, run `cd run-blotter && rer dev`.

`rer dev` installs the locked dependencies, selects pinned Node 22.20.0 and
pnpm 10.12.4, prepares a local D1 database and starts the app on a free port.
The first launch takes several minutes; if it is interrupted, run it again.
It prints `RER_READY` with the address and `RER_OPEN` with a sign-in link.
Open the `RER_OPEN` link on this computer: you are signed in as the principal.
Confirm **Finish setup**, then open the workspace at `/app`.
The link is a local credential; keep it private.

If `rer dev` says the server limit is reached, stop a server you no longer need
with the command it prints, or start with `RER_SERVER_LIMIT=8 rer dev`.
Stop Blotter with `rer dev --stop`.

### Try the other roles locally

Local mail is suppressed, so team members sign in as local personas instead of
by email. In **Team & safety**, save `reviewer@dev.localhost` as a reviewer and
`preparer@dev.localhost` as a preparer. Then stop the app and restart as one of them:

```sh
rer dev --stop
rer dev --as reviewer      # or: rer dev --as preparer
```

Open the new `RER_OPEN` link. `rer dev` with no `--as` returns to the principal.

The run site is live at [https://run-blotter.com](https://run-blotter.com), and
its run page is [https://run-blotter.com/run](https://run-blotter.com/run). The
local run entrypoint is `/run` in the static site built by `rer build --site`.
The [documentation](docs/README.md) is maintained as repository Markdown and
ships as `/docs` and its guide pages in that same static build.

## Do the first jobs

1. **Team & safety:** set your own hourly rate (in cents, ex GST; `15000` is
   $150.00), add a reviewer and a preparer, and set their rates. On a deployed
   installation, **Send an invitation** emails them a sign-in link.
2. **Clients & templates:** add a client with a contact email, and save the
   prefilled **Quarterly BAS** template (checklist, document requests, fixed
   fee). Under **Start a job**, choose the client, template, period start
   (for example `2026-07-01`), the due date you have checked, where it comes
   from, the preparer and the reviewer.
3. **Jobs → open the job → Client documents:** **Send a reminder with an
   upload link.** Blotter mails the client the link (on a deployed
   installation) and shows it to you once. Open the link in a private window:
   that is the client's view. Upload a file for each request, then back in the
   job **Accept** each one or **Ask again**.
4. **Checklist:** tick every step and **Submit for review**. As the assigned
   reviewer (or the principal, for someone else's work), choose **Sign off**
   with a note. Signing off closes the upload link.
5. **Roll forward:** on the signed-off job, record the next period's due date
   under **Roll forward to the next period**. Blotter creates the next quarter's
   job with the same client, template and people. It refuses a second copy.
6. **Time & billing:** record time on a job (**Time** section; it uses your
   current rate). In **Time & billing**, choose items, **Prepare export**, then
   as the principal **Approve** it with a note and **Download CSV**. An approved
   export cannot change; each time entry or fixed fee can be exported once.
7. **Preparations:** create an agent key in **Team & safety** and give it to
   your agent with [API.md](API.md). Its roll-forwards, reminders and exports
   wait here until you **Approve** or **Decline**; decisions are recorded.
8. **Move in:** load [the documented fixture](fixtures/client-list.csv) or your
   own list, **Preview (dry run)**, then **Import these clients**. **View
   journal** shows the original file and progress; **Undo import** removes the
   imported clients except those that already have jobs. See
   [IMPORTING.md](IMPORTING.md) for the CSV shape.
9. **Team & safety:** **Download practice archive**, and **Erase a client file**
   by typing its name and a reason.

The exact first-release scope is in [ACCEPTANCE.md](ACCEPTANCE.md).

## Backup and restore

The archive holds clients, templates, jobs, document requests and files, time,
exports, imports and the audit log. Sign-in accounts, sessions, agent keys and
client upload links are not included: create new keys and send new reminders
after a move. Restore only into an empty installation, from **Team & safety** or
the command line:

```sh
rer export --output exports/practice.rer
# In a new, empty checkout: copy the archive into its exports/ folder first;
# --input must be a path inside the checkout.
rer import --input exports/practice.rer --yes
rer dev
```

The restored checkout gets a new local owner; your practice data, exports and
history come back unchanged.

After erasing a file, make a new archive and retire older ones. An older
archive is refused unless you also supply the newer archive that carries the
erasure journal (`--journal exports/newer.rer`, or the second file field in
**Restore**). `rer reset --yes` deletes local data; export first.

## Deploy your installation

You need a Cloudflare account with Workers and D1, a sending address verified
with Resend, and a Resend API key for email sign-in and reminders. Never put
credentials in Git, commands, screenshots or chat.

1. Stop local serving (`rer dev --stop`) and commit your changes. In
   `deploy.json`, set `MAIL_FROM` to your verified sending address. Keep the
   project, package, Worker and D1 names unchanged, and keep `AUTH_LOCAL`
   `false`.
2. In your shell's private environment, supply `CLOUDFLARE_ACCOUNT_ID` and
   `CLOUDFLARE_API_TOKEN`, and `OWNER_EMAIL`, `SESSION_SECRET`, `SETUP_TOKEN`
   and `MAIL_API_KEY`. Generate the session and setup values as independent
   random strings of at least 32 characters, with your secret manager.
3. Run `rer deploy --dry-run` to build and check the plan without provider
   calls (it already needs the variables from step 2), then `rer deploy`. It creates or reuses the D1 database, applies the
   migrations, deploys the Worker and its assets, checks health and prints the URL.
4. Open the printed address's `/signin`, request a link for the owner email and
   follow it. Confirm **Finish setup**, then open `/app`.

[RUN-LOCALLY.md](RUN-LOCALLY.md) and [SEED-COMMAND-CONTRACT.md](SEED-COMMAND-CONTRACT.md)
describe every `rer` command. [OPERATIONS.md](OPERATIONS.md) covers running it.

## Develop

`rer verify` builds the Worker, typechecks, runs the integration flows in
`tests/` against the built Worker (only the mail provider is faked) and checks
the hosted output. [SOURCES.md](SOURCES.md) records where the code came from.
