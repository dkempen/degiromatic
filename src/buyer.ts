import { SearchProductResultType } from "degiro-api/dist/types";
import { Logger } from "winston";
import { Configuration } from "./config";
import { Degiro, OrderInfo } from "./degiro";
import { delay, exitProcess, getSumOfProperty } from "./util";

export class Buyer {
  constructor(private logger: Logger, private configuration: Configuration, private degiro: Degiro) {}

  public async buy() {
    this.logger.info(`Started DEGIRO Autobuy at ${new Date().toLocaleString()}`);

    // Process some things from config: Calculate ratios for desired portfolio
    const totalRatio = getSumOfProperty(this.configuration.portfolio, (x) => x.ratio);
    this.configuration.portfolio.forEach((x) => (x.ratio = x.ratio / totalRatio));

    this.logger.info(
      `Desired portfolio: ${this.configuration.portfolio
        .map((etf) => `${etf.symbol} (${(etf.ratio * 100).toFixed(2)}%)`)
        .join(", ")}`
    );

    // Login
    try {
      await this.degiro.login();
    } catch (error) {
      exitProcess(this.logger, error);
    }

    // Get cash funds
    const cash = await this.degiro.getCashFunds(this.configuration.cashCurrency);

    // If cash funds is not high enough, don't buy anything
    if (cash < this.configuration.minCashInvest) {
      this.logger.info(
        `Cash in account (${cash} ${this.configuration.cashCurrency}) is less than minimum cash funds (${this.configuration.minCashInvest} ${this.configuration.cashCurrency}).`
      );
      return;
    }

    const investableCash = Math.min(this.configuration.maxCashInvest, cash);

    this.logger.info(
      `Cash in account: ${cash} ${this.configuration.cashCurrency}, limiting investment to ${investableCash} ${this.configuration.cashCurrency}`
    );

    // Get portfolio
    const portfolio = await this.degiro.getPortfolio();

    // Filter existing portfolio ETFs from desired portfolio in config
    const ownedEtfs = portfolio.filter(
      (etf) =>
        etf.positionType === "PRODUCT" &&
        etf.productData &&
        this.configuration.portfolio.some(
          (desiredEtf) => desiredEtf.isin === etf.productData.isin && desiredEtf.symbol === etf.productData.symbol
        )
    );

    // Get total value of all ETFs in portfolio
    const totalETFValue = getSumOfProperty(ownedEtfs, (x) => x.value);

    const coreEtfs: BuyInfo[] = [];
    const paidEtfs: BuyInfo[] = [];

    // Check order history for open order if open orders are not allowed
    if (!this.configuration.allowOpenOrders) {
      const hasOpenOrders = await this.degiro.hasOpenOrders();
      if (hasOpenOrders) {
        this.logger.info(`There are currently open orders, doing nothing.`);
        return;
      }
    }

    // Loop over wanted products, see if ratio is below wanted ratio
    for (const etf of this.configuration.portfolio) {
      // Find current product in owned products
      const matchingOwnedEtfs = ownedEtfs.filter(
        (ownedEtf) =>
          ownedEtf.productData && ownedEtf.productData.isin === etf.isin && ownedEtf.productData.symbol === etf.symbol
      );

      // Calculate owned ratio in relation to total ETF value of portfolio
      const ownedEtfValue = getSumOfProperty(matchingOwnedEtfs, (x) => x.value);
      const ownedEtfValueRatio = ownedEtfValue / (totalETFValue + investableCash);

      if (ownedEtfValueRatio >= etf.ratio) {
        this.logger.info(
          `Symbol ${etf.symbol} (${etf.isin}): ` +
            `actual ratio ${ownedEtfValueRatio.toFixed(2)} > ` +
            `${etf.ratio.toFixed(2)} wanted ratio, ignoring.`
        );
        continue;
      }

      this.logger.info(
        `Symbol ${etf.symbol} (${etf.isin}): ` +
          `actual ratio ${ownedEtfValueRatio.toFixed(2)} < ` +
          `${etf.ratio.toFixed(2)} wanted ratio, adding to buy list.`
      );

      const ratioDifference = etf.ratio - ownedEtfValue;

      // Search product
      const product = await this.degiro.searchProduct(etf.isin, etf.exchange);
      if (!product) {
        this.logger.error(
          `Did not find matching product for symbol ${etf.symbol} (${etf.isin}) on exchange ${etf.exchange}`
        );
        continue;
      }

      const orderInfo = await this.degiro.getOrderInfo(product.id);
      if (etf.core && !orderInfo.isInCoreSelection) {
        this.logger.info(
          `Symbol ${etf.symbol} (${etf.isin}) on exchange ${product.exchangeId} is in DEGIRO core selection, ` +
            `but does not have core selection transaction fees, ignoring.`
        );
        continue;
      }
      const buyInfo = { product, orderInfo, ratioDifference } as BuyInfo;
      if (this.configuration.useLimitOrder) {
        buyInfo.limitOrder = (await this.degiro.getPrice(product.vwdId)) ?? undefined;

        if (!buyInfo.limitOrder) {
          this.logger.error(
            `Failed to get price data of product ${etf.symbol} (${etf.isin}) with id "${product.vwdId}`
          );
          continue;
        }

        // Add 2 cents to limit order amount to compensate for price fluctuations
        buyInfo.limitOrder += 0.02;
      }

      if (etf.core) {
        coreEtfs.push(buyInfo);
      } else {
        paidEtfs.push(buyInfo);
      }
    }

    this.logger.info(
      `Core ETFs eligible for buying: ${coreEtfs
        .map((x) => `${x.product.symbol} at ${x.limitOrder} ${x.product.currency}`)
        .join(", ")}`
    );
    this.logger.info(`Paid ETFs eligible for buying: ${paidEtfs.map((x) => x.product.symbol).join(", ")}`);

    // Either select all eligible core ETFs for buying, or the first paid one
    if (coreEtfs.length > 0) {
      // Place orders for all core ETFs

      this.logger.info("Choosing to buy core ETFs (DEGIRO Core selection), dividing available cash by wanted ratio");

      // Determine amounts
      let ready = false;

      while (!ready) {
        const coreEtfsTotalNeededRatio = getSumOfProperty(coreEtfs, (x) => x.ratioDifference);

        ready = true;

        for (const etf of coreEtfs) {
          const ratio = etf.ratioDifference / coreEtfsTotalNeededRatio;
          const amount = Math.floor(
            (ratio * investableCash - etf.orderInfo.transactionFee) /
              (etf.limitOrder ? etf.limitOrder : etf.product.closePrice)
          );

          if (amount > 0) {
            etf.amountToBuy = amount;
          } else {
            ready = false;
            this.logger.info(`Cancel order for ${amount} x ${etf.product.symbol}, amount is 0`);
            coreEtfs.splice(coreEtfs.indexOf(etf), 1);
            break;
          }
        }
      }

      for (const etf of coreEtfs) {
        // Calculate amount
        if (!etf.amountToBuy || etf.amountToBuy < 1) {
          continue;
        }

        await delay(1000);

        const confirmation = await this.degiro.placeOrder(
          etf.product.id,
          etf.amountToBuy,
          etf.limitOrder,
          this.configuration.dryRun
        );
        this.logger.info(
          `Successfully placed market order ` +
            `for ${etf.amountToBuy} x ${etf.product.symbol} ` +
            `for ${(etf.product.closePrice * etf.amountToBuy).toFixed(2)} ` +
            `${etf.product.currency} (${confirmation})`
        );
      }
    } else {
      // Place order for paid ETF if exists
      const etf = paidEtfs[0];

      if (etf) {
        this.logger.info(`Choosing to buy a single paid ETF: ${etf.product.symbol}`);

        // Calculate amount
        const amount = Math.floor(investableCash / etf.product.closePrice);

        await delay(2000);
        const confirmation = await this.degiro.placeOrder(
          etf.product.id,
          amount,
          etf.limitOrder,
          this.configuration.dryRun
        );
        this.logger.info(`Successfully placed market order for ${amount} x ${etf.product.symbol} (${confirmation})`);
      } else {
        this.logger.info(`No Paid ETF to buy either`);
      }
    }

    this.logger.info(`Finished DEGIRO Autobuy at ${new Date().toLocaleString()}\n`);
  }
}

interface BuyInfo {
  product: SearchProductResultType;
  orderInfo: OrderInfo;
  amountToBuy: number | undefined;
  limitOrder: number | undefined;
  ratioDifference: number;
}
