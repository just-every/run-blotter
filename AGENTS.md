# Agent instructions

## Launch for review

When asked to launch, run or review this app, run this from the checkout root
and nothing else:

```sh
rer dev
```

- It installs and sets up a fresh checkout by itself and prints progress; a
  first launch can take several minutes. Give the shell tool at least 10
  minutes. If the tool times out, run the same `rer dev` again: it resumes.
- Never run install, setup, reset or deploy for this, and never ask for an
  email, port, password or answers file.
- Give the owner the `RER_READY` address and the `RER_OPEN` link, and ask
  nothing. `RER_OPEN` is a credential: share it only with the owner, in this
  chat.
- Stop the app with `rer dev --stop`. If a start is refused, the message names
  the cause and the next command: run that command.

Without `rer` on PATH, install it once with the installer script, which brings its own Node when there is none:
`curl -fsSL https://runeditrun.com/install.sh | sh`. With Node 22 or later already installed, `npx -y @runeditrun/rer cli install` does the same.
For the current shell, run `export PATH="$HOME/.local/bin:$PATH"` after installing.

## Run it locally

To install for a real owner instead of a review launch, run the verbs yourself
from the checkout root. `rer` runs each verb with the `@runeditrun/rer` version
pinned in `package.json`.

```sh
rer install
rer setup --owner-email you@example.com
rer dev
```

Commands that run project work select the exact Node version declared by the
project. They use an exact matching installed runtime or a checksum-verified
copy cached at `~/.rer/node/node-vVERSION-PLATFORM-ARCH/`; when needed on
supported platforms, the runner retrieves the official Node release and checks
its SHA-256 against `SHASUMS256.txt`. It does not change global Node installations.
Set `RER_NODE_AUTO=0` to disable automatic selection. If selection is disabled
or acquisition fails, the command reports a repair invocation in this form:
`npm exec --yes --package=node@VERSION -- node SCRIPT VERB --cwd PROJECT`.
Help, check, describe, doctor and stop do not select or acquire Node.

After `RER_READY`, `dev` prints `RER_SIGNED_IN EMAIL` and `RER_OPEN URL`.
Open that URL on this computer: the app opens signed in as the owner and
finishes first-run setup at `/setup`. Treat the line as a credential.
`dev --as PERSONA` starts as a persona or signed out. Legacy `dev --login`
uses the same automatic sign-in. Until first-run completion is stored durably, app routes send the signed-in owner to `/setup`;
signed-out visitors sign in and return there. Once complete, `/setup` opens the
app or settings. Development and demo mail is silently suppressed.

The saved local port is used; a first setup saves the first free port from 8787. Explicit ports are decimal
integers from 1 through 65535 and must be free; a busy requested port fails
instead of silently moving. Only `127.0.0.1`, `localhost` and `::1` are allowed.
Dev applies the selected host and port to both the listener and runtime bindings;
readiness is bounded and failure stops the owned processes.

Missing non-interactive setup answers exit 3 and name the manifest fields.
Read `rer-setup.json` and pass a private, mode-0600 JSON object keyed by those
names using `rer setup --answers PATH --non-interactive`,
for example `{"OWNER_EMAIL":"owner@example.com"}`. Secret values stay in
private inputs and never go in command arguments. A setup rerun with the saved
owner and origin preserves existing owner/data and exact private settings.
Conflicting saved identity or origin reports an actionable recovery path.
Review reset's exact removal inventory before confirmation; export domain data
first if it should be restored, and import only into an empty destination.

Queue waits report their reason and live position while the command waits. Package mode has no queue status command.

Use the setup prompt instead of `--owner-email` when entering the real owner
mailbox. Open the `RER_OPEN` URL printed by `dev` on this computer; the app opens
signed in as the owner, including with legacy `dev --login`. No external
email is sent in development or demo mode. Stop `dev` with
`rer dev --stop` or Ctrl-C, and stop `preview` with
`rer preview --stop` before build or verification.

```sh
rer verify
rer reset --yes
rer export --output exports/installation.rer
rer import --input exports/installation.rer --yes
rer deploy
rer describe
```

Reset removes declared local data and settings. Import requires an empty
destination and explicit confirmation. Read `RUN-LOCALLY.md` for supported
flags, private state, deployment inputs and remote limitations.

`pnpm typecheck` and `rer verify` use checkout-local, gitignored
`.cache/typecheck.tsbuildinfo`; deleting it forces a full check, while
`rer build` builds the real Worker and assets.

## Work on Blotter

Blotter is the practice workflow for small US bookkeeping and
accounting firms; ACCEPTANCE.md is the first release. Product source is in
`src/blotter/` (server: one module per job, `api.ts` lists every HTTP door) and
`src/ui/` (screens); the schema is `migrations/core/0016_blotter.sql`.

- Enforce the role in every server handler (`need`, `human`, `job()` for
  visibility) and write through `atomic()`, which re-checks the actor's role in
  the same D1 batch. Route guards alone are insufficient.
- Agents prepare; people approve. Agent doors only read context or create
  proposals (`src/blotter/proposals.ts`).
- Money is integer cents with explicit USD/AUD currency; new inputs default USD and historical AUD is never relabelled. Due dates are recorded by people, set by an
  approved recurrence rule as the period's last day plus its days (WORK-002), or
  calculated from a client obligation on a firm-approved sourced deadline rule
  (`src/blotter/deadlines.ts`, DUE-001/DUE-003); filing is never inferred.
  No lodgement, tax or GST calculation, client bookkeeping or advice.
- Tests are integration flows through the built Worker's HTTP doors
  (`tests/blotter/`), faking only the mail provider. Keep them within
  `test-budget.json`.
- Copied Base modules are recorded in `base-copies.json` and stay byte for byte;
  adapted sibling source is listed in SOURCES.md.

`deploy --dry-run` validates and builds locally without provider requests. Real
owner-account deploy applies declared D1 migrations and checks health.

Pinned reference: https://github.com/runeditrun/base/blob/a06bd065124c2b45fa879e62736fb5e1987efdaa/TANSTACK-START-MIGRATION.md

## Lander-Regenerate

Lander-Regenerate: node scripts/contract-docs.mjs write

After changing a migrated CONTRACT.md status row, run
`node scripts/contract-docs.mjs write` and then
`node scripts/contract-docs.mjs check`. This incremental generator mirrors
SECURE-001, MOBILE-001, ENGAGE-001, INTEGRATE-008, RESOLVE-001, PAY-002 and SMS-001, SIGN-001, MAIL-001, READY-001 and RESCUE-001 into ACCEPTANCE.md and docs/CLAIMS.md and recomputes the Status
summary, preserving unmigrated legacy acceptance prose. Add other clauses to
its migration list when their mirrors are adopted. Regenerate the edition
source lock last with `node scripts/edition-authoring/cli.mjs lock`, then
`node scripts/edition-authoring/cli.mjs check`.
