# Getting started

Run Blotter on your computer and set up the people who will prepare and review the first job.

## Run Blotter

You need macOS, Linux or Windows with WSL2, and Git. [Run Blotter](/run) has the same two steps. First install rer; it brings its own Node if you have none:

```sh
curl -fsSL https://runeditrun.com/install.sh | sh
```

If the installer ends with a line to run, run it. Then start Blotter:

```sh
rer dev just-every/run-blotter
```

Already have Node 22 or later? `npx -y @runeditrun/rer dev just-every/run-blotter` does both steps in one line. To start Blotter again later, run `cd run-blotter && rer dev`.

The first launch installs the locked dependencies, selects the project's pinned runtime, prepares a local database and starts the app on a free port. It can take several minutes. If interrupted, run `rer dev` again to resume.

rer gets Blotter, installs everything, makes you the owner and prints a link that opens Blotter signed in. Open that link on this computer. Keep it private: it signs you in as the principal.

Review your owner account on **Finish setup**, tick the confirmation and press **Finish setup**. The workspace opens at `/app`.

## Set up your team

In **Team & safety**, open **Add or change a person** to save a reviewer and a preparer. Set an hourly rate for yourself and each person under **Set an hourly rate**. Rates are integer cents, ex tax, from an effective date: `15000` means $150.00 per hour. Service and client rates override a person's rate; see [Time and billing](/docs/time-and-billing).

The principal manages people, approves billing exports, imports clients and handles archives. Reviewers can work across jobs. Preparers see only jobs assigned to them. Deactivating a person removes access immediately.

On a deployed installation, **Send an invitation** emails a saved person a sign-in link. Local mail is suppressed; use the local personas to try the other roles.

## When someone leaves

As the principal, open **Team & safety → Offboard a person**. Choose the departing person, a successor for their work (jobs they prepare, their named tasks, tax notices, open discussions and tasks named in templates) and, if different, a successor for their reviews (jobs they review or manage, and agent preparations waiting for them). **Preview transfer** lists everything that will move, their running timer (discarded, nothing recorded) and their time not yet approved (submitted on their behalf for approval). Press **Transfer and deactivate** to move it all and deactivate them in one step. Messages, reminders, decisions and recorded time keep their original author.

Deactivating a person, here or with **Add or change a person**, ends every session and revokes their agent keys at once. Reactivating them needs a new sign-in and new keys. If you had to deactivate someone urgently, offboard them afterwards to move their work.

## Require a second factor

Under **Team & safety → Sign-in security**, anyone can press **Add an authenticator app or passkey**. For an authenticator app, add the key shown to the app (or open the setup link on the same device), then enter its 6-digit code. For a passkey or security key, press **Use a passkey or security key** and follow your browser. After your first factor, Blotter shows ten one-time recovery codes; store them safely, because they are shown only once. From then on, every new sign-in asks for a code from the app or your passkey, or a recovery code if you lose both. **New recovery codes** replaces the old set.

As the principal, press **Require a second factor for every staff sign-in**. From then on, nobody sees client work until they have set up an authenticator, and every session, including ones that were already open, must confirm a code first. Agent keys stop working while the person who created them has no second factor. Five wrong codes in 15 minutes pause verification for 15 minutes.

Under **Session lifetime and idle timeout**, the principal can sign everyone out a set number of minutes after they sign in, and after a number of idle minutes. Leave either empty to keep the standard limit.

If someone loses their authenticator and recovery codes, open **Reset someone's lost second factor**, choose the person and record a reason. Their factors and recovery codes are removed and every session they have is signed out; the audit shows who reset it and why. They set up a new authenticator at their next sign-in. The principal recovers their own factor with a recovery code.

**Download enrollment report (CSV)** lists each person, whether they are enrolled and since when, when they last verified and how many recovery codes they have left, as evidence for your WISP and the FTC Safeguards Rule's multi-factor control. It records facts; it does not certify compliance.

## Try reviewer and preparer roles locally

Save `reviewer@dev.localhost` as a reviewer and `preparer@dev.localhost` as a preparer in **Team & safety**. Stop the app, then start as the role you want:

```sh
rer dev --stop
rer dev --as reviewer
```

Use `rer dev --as preparer` to try the preparer. Open the new sign-in link it prints each time. Starting `rer dev` without `--as` returns to the principal.

## Start the first client

Open **Clients & templates**, add a client and save a job template. [Jobs and templates](/docs/jobs) walks through the first recurring job.

## Client fields, tags and groups

Under **Client fields → Add a field**, the principal or a reviewer defines a field such as *Fiscal year end* (a date) or *Service tier* (a choice). Tick the required box and every client added or changed afterwards, in the app, through the API or by CSV import, must have a value. Values are checked against the field's type and choices everywhere.

Add tags when adding a client, separated by commas. Under **Client groups → Group related clients**, name a group and mark each member as parent, subsidiary, household or member.

Under **Segments**, filter clients by group, tag or field value. The segment is preselected in **Schedule work in bulk**, so you can start its next period's work in one batch. **Change a field for this segment** previews each client's current and new value: an invalid value is rejected on its line, and applying the preview changes only the lines marked *change*. Clients outside the preview are never touched.

To stop local serving, run:

```sh
rer dev --stop
```

## Use your own installation

A production installation needs your own Cloudflare account and a verified sending address with Resend. Follow the repository's [deployment instructions](https://github.com/just-every/run-blotter#deploy-your-installation) and [operations guide](https://github.com/just-every/run-blotter/blob/main/OPERATIONS.md). Keep credentials in your private environment or secret manager.
