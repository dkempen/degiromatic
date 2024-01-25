import { SearchProductResultType } from "degiro-api/dist/types";

export interface BuyInfo {
  product: SearchProductResultType;
  amountToBuy?: number;
  ratioDifference?: number;
}
