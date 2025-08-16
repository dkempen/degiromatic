import { Logger } from 'pino';

export const delay = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const logError = (logger: Logger, error: unknown) =>
  logger.error(error instanceof Error ? error.message : `Unknown Error: "${error}"`);

export const exit = (logger: Logger, error: unknown) => {
  logError(logger, error);
  process.exit(1);
};
