# SEARCH-001 capability rules

The following source rules are retained from the contract at `ca2596bae4c081a2df169d327b23c0030428b918`. Current acceptance and company-policy classes are defined by CONTRACT.md.

**Semantics (SEARCH-001):** one query (1 to 200 characters) covers the clients, contacts (each client's contact), jobs (work items), job tasks, client portal messages and to-dos (PORTAL-003), discussion notes (COLLAB-001 thread messages) and uploaded documents (by file name and by extracted text) the searcher may read: the principal and reviewers read the whole firm; anyone else reads the jobs they may read (ACCESS-001, WORK-009), the clients of those jobs, and the discussions the preparer of that work may read.

**Inherited before they ship:** emails and their subjects (MAIL-001), private threads never appearing (MAIL-002), invoices and invoice numbers (BILL-002), individual SSNs (CRM-001, matched and masked like the EIN), and client and document grants narrowing results (ACCESS-002) each join this search under the same access rule before they ship. SEARCH-001 is done for every capability that exists today.

**SEARCH-001 — Firm wide search.** One search covers clients, contacts, work items, tasks, emails, portal messages, notes, documents (by name and extracted text) and invoices.

**SEARCH-001 — Firm wide search.** Status: **done**. Search for a client's last name, an invoice number, a phrase inside an uploaded PDF and an email subject, and open each result. A preparer without access to a client gets no result from that client, and a private thread never appears. Searching the last four digits of an SSN works only for an authorized role and shows the number masked. Until the clauses that add them ship, invoice numbers are BILL-002's, email subjects MAIL-001's, private threads MAIL-002's and SSNs CRM-001's (each inherits the search and its access rule); today the client's EIN is searched by digits only by the principal or a reviewer and is always shown masked (see CONTRACT.md SEARCH-001).
