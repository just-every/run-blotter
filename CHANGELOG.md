# Changelog

## 0.1.0 — 2026-11-26

The first release. Blotter is practice management for a small bookkeeping and accounting firm, and it runs in your own Cloudflare account.

Prepare Blotter for hosted installation with a digest-bound setup manifest, explicit deployment and recovery policy, and Managed or direct-provider mail configuration. Existing practice workflows and migration history are preserved.

### What a practice gets

- **Recurring client jobs.** Jobs roll forward from a template with due dates entered by people, each with its source.
- **Document requests.** Clients answer through a private upload link; reviewers sign off.
- **Staff capacity and time.** See who has room, and export time for your own billing.
- **Your data stays yours.** It lives in your own D1 database, with owner-authenticated backup and restore and erasure on request.
- **Mail optional.** A Business can run Blotter with mail off, or set Managed or direct-provider mail.

### Not in this release

Blotter does not file returns, calculate tax, keep client books or give advice. New amounts are recorded in US dollars; records from earlier builds keep their Australian dollars.

### Upgrading

This is the first tagged release; every migration under `migrations/core` counts as added. Use the committed deployment specification and setup manifest. Retain the vault key and latest erasure journal when moving an existing practice.
