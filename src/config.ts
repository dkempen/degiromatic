export interface Config {
  minCashInvest: number;
  maxCashInvest: number;
  cashCurrency: string;
  allowOpenOrders: boolean;
  useMargin: boolean;
  divideEqually: boolean;
  desiredPortfolio: Product[];
  demo: boolean;
}

export interface Product {
  symbol: string;
  isin: string;
  ratio: number;
  ratioDifference?: number;
  exchangeId: number;
  degiroCore: boolean;
}
