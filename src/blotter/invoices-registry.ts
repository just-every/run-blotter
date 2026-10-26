// Pure schema declarations shared by retention without importing its engine.
export const INVOICE_BILLING_TABLES = ['b_invoice_entitlements', 'b_invoices', 'b_invoice_sources', 'b_invoice_retainers', 'b_invoice_amendments', 'b_invoice_credits', 'b_invoice_credit_uses', 'b_invoice_writeoffs', 'b_provider_payments', 'b_payment_observations'] as const;
export const INVOICE_LINK_TABLES = ['b_invoice_deliveries', 'b_invoice_reminders', 'b_invoice_reminder_clients', 'b_payment_gates', 'b_payment_overrides', 'b_payment_mandates', 'b_payment_events'] as const;
export const INVOICE_FIRM_TABLES = ['b_invoice_settings', 'b_invoice_reminder_policy', 'b_payment_policy'] as const;
export const INVOICE_BYTE_COLUMNS = { b_invoices: ['pdf_base64'] };
