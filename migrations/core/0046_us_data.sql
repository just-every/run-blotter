-- Existing amounts retain AUD without rewriting immutable history. Writers explicitly store new currency.
ALTER TABLE b_rates ADD COLUMN currency TEXT NOT NULL DEFAULT 'AUD' CHECK(currency IN ('USD','AUD'));
ALTER TABLE b_rate_cards ADD COLUMN currency TEXT NOT NULL DEFAULT 'AUD' CHECK(currency IN ('USD','AUD'));
ALTER TABLE b_templates ADD COLUMN currency TEXT NOT NULL DEFAULT 'AUD' CHECK(currency IN ('USD','AUD'));
ALTER TABLE b_jobs ADD COLUMN currency TEXT NOT NULL DEFAULT 'AUD' CHECK(currency IN ('USD','AUD'));
ALTER TABLE b_time ADD COLUMN currency TEXT NOT NULL DEFAULT 'AUD' CHECK(currency IN ('USD','AUD'));
ALTER TABLE b_mileage_rates ADD COLUMN currency TEXT NOT NULL DEFAULT 'AUD' CHECK(currency IN ('USD','AUD'));
ALTER TABLE b_expenses ADD COLUMN currency TEXT NOT NULL DEFAULT 'AUD' CHECK(currency IN ('USD','AUD'));
CREATE TRIGGER b_jobs_currency BEFORE UPDATE OF currency ON b_jobs WHEN NEW.currency IS NOT OLD.currency BEGIN SELECT RAISE(ABORT,'recorded currency is immutable'); END;
CREATE TRIGGER b_expenses_currency BEFORE UPDATE OF currency ON b_expenses WHEN NEW.currency IS NOT OLD.currency BEGIN SELECT RAISE(ABORT,'recorded currency is immutable'); END;
CREATE TRIGGER b_templates_currency BEFORE UPDATE OF currency ON b_templates WHEN NEW.currency IS NOT OLD.currency BEGIN SELECT RAISE(ABORT,'recorded currency is immutable'); END;
CREATE TRIGGER b_rate_cards_currency BEFORE UPDATE OF currency ON b_rate_cards WHEN NEW.currency IS NOT OLD.currency BEGIN SELECT RAISE(ABORT,'recorded currency is immutable'); END;
CREATE TRIGGER b_time_currency BEFORE UPDATE OF currency ON b_time WHEN NEW.currency IS NOT OLD.currency BEGIN SELECT RAISE(ABORT,'recorded currency is immutable'); END;

ALTER TABLE b_prospects ADD COLUMN currency TEXT NOT NULL DEFAULT 'AUD' CHECK(currency IN ('USD','AUD'));
