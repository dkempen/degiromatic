import { Logger } from 'pino';

export const delay = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const exit = (logger: Logger, error: unknown) => {
  logger.error(error instanceof Error ? error.message : 'Unknown Error');
  process.exit(1);
};
