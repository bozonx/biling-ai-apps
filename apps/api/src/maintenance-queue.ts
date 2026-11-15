import { Queue, Worker, type ConnectionOptions } from "bullmq";

export async function startMaintenanceQueue(
  connection: ConnectionOptions,
  process: () => Promise<void>,
  onError: (error: Error) => void,
) {
  const queue = new Queue("billing-maintenance", { connection });
  const worker = new Worker("billing-maintenance", process, {
    connection,
    concurrency: 1,
  });
  worker.on("error", onError);
  worker.on("failed", (_job, error) => onError(error));
  queue.on("error", onError);
  try {
    await queue.upsertJobScheduler(
      "hold-expiry",
      { every: 5000 },
      {
        name: "hold-expiry",
        opts: {
          attempts: 3,
          backoff: { type: "exponential", delay: 1000 },
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      },
    );
  } catch (error) {
    await worker.close();
    await queue.close();
    throw error;
  }
  return async () => {
    await worker.close();
    await queue.close();
  };
}
