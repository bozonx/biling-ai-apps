import { Pool } from "pg";
import { BillingClient } from "@billing/client";

export type Delivery = {
  holdId: string;
  action: "commit" | "release";
  usage?: Parameters<BillingClient["commitMetered"]>[2];
};
export class CommitOutbox {
  constructor(
    readonly pool: Pool,
    readonly billing: BillingClient,
    readonly apiKey: string,
  ) {}
  async initialize() {
    await this.pool.query("SELECT 1 FROM gateway.commit_outbox LIMIT 0");
  }

  async begin(key: string, fingerprint: string, holdId: string) {
    const inserted = await this.pool.query(
      `INSERT INTO gateway.commit_outbox(request_key,fingerprint,hold_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING request_key`,
      [key, fingerprint, holdId],
    );
    const row = (
      await this.pool.query(
        `SELECT * FROM gateway.commit_outbox WHERE request_key=$1`,
        [key],
      )
    ).rows[0] as { fingerprint: string; response: unknown };
    if (row.fingerprint !== fingerprint)
      throw new Error("IDEMPOTENCY_CONFLICT");
    return { created: inserted.rowCount === 1, response: row.response };
  }
  async enqueue(key: string, delivery: Delivery, response: unknown) {
    await this.pool.query(
      `UPDATE gateway.commit_outbox SET payload=$2::jsonb,response=$3::jsonb,state='pending' WHERE request_key=$1`,
      [key, JSON.stringify(delivery), JSON.stringify(response)],
    );
  }
  async flush() {
    const stalled = await this.pool.query(
      `SELECT hold_id,state FROM gateway.commit_outbox WHERE (state IN ('running','unknown') AND created_at < now()-interval '5 minutes') OR (state='pending' AND attempts>=10) LIMIT 20`,
    );
    for (const row of stalled.rows as { hold_id: string; state: string }[])
      await this.billing
        .reportDiscrepancy(
          row.hold_id,
          this.apiKey,
          row.state !== "pending"
            ? "provider_outcome_unknown"
            : "delivery_delayed",
        )
        .catch(() => undefined);
    await this.pool.query(
      `UPDATE gateway.commit_outbox SET state='unknown',response=COALESCE(response, '{"error":{"code":"PROVIDER_FAILED"}}'::jsonb) WHERE state='running' AND created_at < now()-interval '5 minutes'`,
    );
    const connection = await this.pool.connect();
    try {
      await connection.query("BEGIN");
      const rows = await connection.query(
        `SELECT request_key,payload FROM gateway.commit_outbox WHERE state='pending' AND next_attempt_at<=now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 20`,
      );
      for (const row of rows.rows as {
        request_key: string;
        payload: Delivery;
      }[]) {
        try {
          if (row.payload.action === "release")
            await this.billing.release(row.payload.holdId, this.apiKey);
          else
            await this.billing.commitMetered(
              row.payload.holdId,
              this.apiKey,
              row.payload.usage!,
            );
          await connection.query(
            `UPDATE gateway.commit_outbox SET state='delivered',last_error=NULL WHERE request_key=$1`,
            [row.request_key],
          );
        } catch {
          await connection.query(
            `UPDATE gateway.commit_outbox SET attempts=attempts+1,last_error='Billing delivery failed',next_attempt_at=now()+interval '10 seconds' WHERE request_key=$1`,
            [row.request_key],
          );
        }
      }
      await connection.query("COMMIT");
    } catch (error) {
      await connection.query("ROLLBACK");
      throw error;
    } finally {
      connection.release();
    }
  }
}
