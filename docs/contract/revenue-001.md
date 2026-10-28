# REVENUE-001 capability rules


**REVENUE-001 — Close billing leakage and reconciliation exceptions.** An agent compares accepted scope/amendments, time/budgets/WIP, retainer schedules, invoices, credits and provider/accounting events to detect missed charges, duplicate invoices and unreconciled collections.

**Native REVENUE-001 implementation:** The principal invokes a deterministic revenue assistant using an explicitly selected, reviewed ONBOARD-001 mapping of readable principal-recorded or SIGN-002 signed scope.

Exact quotes and source integrity remain visible; a missing mapped work template is a review finding, never an independent legal interpretation.

Approved, unreserved time and fees, recorded budgets, retainer definitions and amendments, invoice snapshots, credits and authenticated Stripe observations remain the source authorities.

Suspected duplicates match work item, normalized title, currency and gross amount; the principal confirms whether they represent the same work.

Approval can void only the cited current draft, atomically retaining the decision and billing-source reservations to prevent rebilling.

An amendment approval records the reviewed draft only: the signed agreement, fee entitlements, delivery, collection and write-offs retain their separate explicit approvals.

Evidence changes refuse stale approval.

Returned and uncertain collections retain the invoice owner, due condition and no-automatic-retry next action; provider reconciliation reads current authenticated payment state, never charges or treats pending ACH as settlement.

No external model, agent-key exposure, scheduled debit or new invoice authority is activated.

Derived drafts obey native holds, erasure and inactive restoration; decisions and evidence are portable.

Retainer comparisons use the first scheduled month, recorded work months and accepted amendment effective months; each period compares its accepted gross fee with non-void generated invoices.

Future planned differences remain review findings.

Principal-recorded firm-accounting event observations compare gross, net receipts, applied credits and approved write-offs with the selected native invoice authority; a later immutable event reference supersedes the earlier comparison for that source and invoice.

These observations are source-reported evidence, never authenticated ledger-provider receipts, and cannot post to a ledger or change any financial authority.

Accounting observations retain billing-class amounts and attribution with their invoice; native holds, reference redaction, archives and stale-restore fencing apply.

Native semantics: The principal invokes a deterministic revenue assistant using an explicitly selected, reviewed ONBOARD-001 mapping of readable principal-recorded or SIGN-002 signed scope. Exact quotes and source integrity remain visible; a missing mapped work template is a review finding, never an independent legal interpretation. Approved, unreserved time and fees, recorded budgets, retainer definitions and amendments, invoice snapshots, credits and authenticated Stripe observations remain the source authorities. Suspected duplicates match work item, normalized title, currency and gross amount; the principal confirms whether they represent the same work. Approval can void only the cited current draft, atomically retaining the decision and billing-source reservations to prevent rebilling. An amendment approval records the reviewed draft only: the signed agreement, fee entitlements, delivery, collection and write-offs retain their separate explicit approvals. Evidence changes refuse stale approval. Returned and uncertain collections retain the invoice owner, due condition and no-automatic-retry next action; provider reconciliation reads current authenticated payment state, never charges or treats pending ACH as settlement. No external model, agent-key exposure, scheduled debit or new invoice authority is activated. Derived drafts obey native holds, erasure and inactive restoration; decisions and evidence are portable. Retainer comparisons use the first scheduled month, recorded work months and accepted amendment effective months; each period compares its accepted gross fee with non-void generated invoices. Future planned differences remain review findings. Principal-recorded firm-accounting event observations compare gross, net receipts, applied credits and approved write-offs with the selected native invoice authority; a later immutable event reference supersedes the earlier comparison for that source and invoice. These observations are source-reported evidence, never authenticated ledger-provider receipts, and cannot post to a ledger or change any financial authority. Accounting observations retain billing-class amounts and attribution with their invoice; native holds, reference redaction, archives and stale-restore fencing apply.
