ALTER TABLE "CreditHold" ADD COLUMN "creditRateVersionId" UUID, ADD COLUMN "markupPolicyVersionId" UUID;

CREATE SCHEMA IF NOT EXISTS gateway;
CREATE TABLE gateway.commit_outbox (
    request_key TEXT PRIMARY KEY,
    fingerprint TEXT NOT NULL,
    hold_id UUID NOT NULL,
    state TEXT NOT NULL DEFAULT 'running',
    payload JSONB,
    response JSONB,
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX commit_outbox_pending ON gateway.commit_outbox (state, next_attempt_at);
