import { Logger } from "winston";

export async function delay(ms: number) {
  new Promise((resolve) => setTimeout(resolve, ms));
}

export function exitProcess(logger: Logger, error: unknown): number {
  const message = error instanceof Error ? error.message : "Unknown Error";
  logger.error(message);
  process.exit(1);
}
