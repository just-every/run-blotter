# Getting started

Run Blotter on your computer and set up the people who will prepare and review the first job.

## Run Blotter

You need macOS, Linux or Windows with WSL2, and Git. Run the one line on [Run Blotter](/run), `npx -y @runeditrun/rer dev just-every/run-blotter`, which clones the source and starts the app. No Node? `curl -fsSL https://runeditrun.com/install.sh | sh -s -- dev just-every/run-blotter` brings its own and does the same. To start it again later, run `rer dev` from the checkout.

The first launch installs the locked dependencies, selects the project's pinned runtime, prepares a local database and starts the app on a free port. It can take several minutes. If interrupted, run `rer dev` again to resume.

The command prints `RER_READY` with the address and `RER_OPEN` with a sign-in link. Open the `RER_OPEN` link on this computer. Keep that link private: it signs you in as the principal.

Review your owner account on **Finish setup**, tick the confirmation and press **Finish setup**. The workspace opens at `/app`.

## Set up your team

In **Team & safety**, open **Add or change a person** to save a reviewer and a preparer. Set an hourly rate for yourself and each person under **Set an hourly rate**. Rates are integer AUD cents, ex GST: `15000` means $150.00 per hour. New time entries use the person's current rate.

The principal manages people, approves billing exports, imports clients and handles archives. Reviewers can work across jobs. Preparers see only jobs assigned to them. Deactivating a person removes access immediately.

On a deployed installation, **Send an invitation** emails a saved person a sign-in link. Local mail is suppressed; use the local personas to try the other roles.

## Try reviewer and preparer roles locally

Save `reviewer@dev.localhost` as a reviewer and `preparer@dev.localhost` as a preparer in **Team & safety**. Stop the app, then start as the role you want:

```sh
rer dev --stop
rer dev --as reviewer
```

Use `rer dev --as preparer` to try the preparer. Open the new `RER_OPEN` link each time. Starting `rer dev` without `--as` returns to the principal.

## Start the first client

Open **Clients & templates**, add a client and save a job template. [Jobs and templates](/docs/jobs) walks through the first recurring job.

To stop local serving, run:

```sh
rer dev --stop
```

## Use your own installation

A production installation needs your own Cloudflare account and a verified sending address with Resend. Follow the repository's [deployment instructions](https://github.com/just-every/run-blotter#deploy-your-installation) and [operations guide](https://github.com/just-every/run-blotter/blob/main/OPERATIONS.md). Keep credentials in your private environment or secret manager.
