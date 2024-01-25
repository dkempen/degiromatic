export async function delay(ms: number) {
  new Promise((resolve) => setTimeout(resolve, ms));
}

export function getTotalValue(products: any[], key: string) {
  let start = {};
  return 0;
  // start[key] = 0;
  // return products.reduce((a, b) => {
  //   let res = {};
  //   res[key] = a[key] + (b[key] ? b[key] : 0);
  //   return res;
  // }, start)[key];
}
