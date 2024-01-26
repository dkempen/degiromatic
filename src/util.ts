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

export function exitProcess(error: unknown): number {
  const message = error instanceof Error ? error.message : "Unknown Error";
  console.error(message);
  process.exit(1);
}
