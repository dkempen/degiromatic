export interface Config {
  minCashInvest: number;
  maxCashInvest: number;
  cashCurrency: string;
  allowOpenOrders: boolean;
  useMargin: boolean;
  divideEqually: boolean;
  desiredPortfolio: DesiredPortfolio[];
  demo: boolean;
}

export interface DesiredPortfolio {
  symbol: string;
  isin: string;
  ratio: number;
  ratioDifference?: number;
  exchangeId: number;
  degiroCore: boolean;
}
