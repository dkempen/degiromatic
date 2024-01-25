export interface Config {
  minCashInvest: number;
  maxCashInvest: number;
  cashCurrency: string;
  allowOpenOrders: boolean;
  useMargin: boolean;
  divideEqually: boolean;
  desiredPortfolio: Etf[];
  demo: boolean;
}

export interface Etf {
  symbol: string;
  isin: string;
  ratio: number;
  exchangeId: number;
  degiroCore: boolean;
}
