import { Logger } from "winston";
import { CONFIG_DIRECTORY_DEFAULT, CONFIG_DIRECTORY_ENV } from "./constants";

export async function delay(ms: number) {
  new Promise((resolve) => setTimeout(resolve, ms));
}

export function getSumOfProperty<T>(
  products: T[],
  property: (product: T) => number
): number {
  let sum = 0;
  products.forEach((p) => (sum += property(p)));
  return sum;
}

export function exitProcess(logger: Logger, error: unknown): number {
  const message = error instanceof Error ? error.message : "Unknown Error";
  logger.error(message);
  process.exit(1);
}

export function getConfigDirectory() {
  return process.env[CONFIG_DIRECTORY_ENV] ?? CONFIG_DIRECTORY_DEFAULT;
}
