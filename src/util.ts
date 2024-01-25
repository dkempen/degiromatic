export async function delay(ms: number) {
  new Promise((resolve) => setTimeout(resolve, ms));
}

export function getSumOfProperty<T>(
  products: T[],
  property: (product: T) => any
): number {
  let sum = 0;
  products.forEach((p) => (sum += property(p)));
  return sum;
}
