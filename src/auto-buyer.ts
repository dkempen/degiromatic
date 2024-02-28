import { Logger } from "winston";
import { BuyInfo } from "./buy-info";
import { Config } from "./config";
import { ConfigLoader } from "./config-loader";
import {
  DEGIRO_OTP_SEED_ENV,
  DEGIRO_PASSWORD_ENV,
  DEGIRO_USERNAME_ENV,
} from "./constants";
import { DegiroClient } from "./degiro-client";
import { delay, exitProcess, getSumOfProperty } from "./util";

export class AutoBuyer {
  private config: Config;
  private degiroClient: DegiroClient;

  constructor(private logger: Logger, configLoader: ConfigLoader) {
    this.config = configLoader.config;

    const username = process.env[DEGIRO_USERNAME_ENV];
    const password = process.env[DEGIRO_PASSWORD_ENV];
    const otpSecret = process.env[DEGIRO_OTP_SEED_ENV];

    if (!username) {
      throw new Error(
        "No username provided. Please add it to the environment variables."
      );
    }
    if (!password) {
      throw new Error(
        "No password provided. Please add it to the environment variables."
      );
    }

    this.degiroClient = new DegiroClient(logger, username, password, otpSecret);
  }

  public async buy() {
    this.logger.info(
      `Started DEGIRO Autobuy at ${new Date().toLocaleString()}`
    );

    // Process some things from config: Calculate ratios for desired portfolio
    const totalRatio = getSumOfProperty(
      this.config.desiredPortfolio,
      (x) => x.ratio
    );
    this.config.desiredPortfolio.forEach(
      (x) => (x.ratio = x.ratio / totalRatio)
    );

    this.logger.info(
      `Desired portfolio: ${this.config.desiredPortfolio
        .map((etf) => `${etf.symbol} (${(etf.ratio * 100).toFixed(2)}%)`)
        .join(", ")}`
    );

    // Login
    try {
      await this.degiroClient.login();
    } catch (error) {
      exitProcess(this.logger, error);
    }

    // Get cash funds
    const cash = await this.degiroClient.getCashFunds(this.config.cashCurrency);

    // If cash funds is high enough -> continue
    if (cash < this.config.minCashInvest && !this.config.useMargin) {
      this.logger.info(
        `Cash in account (${cash} ${this.config.cashCurrency}) is less than minimum cash funds (${this.config.minCashInvest} ${this.config.cashCurrency}).`
      );
      return;
    }

    const maxInvestableCash = Math.min(this.config.maxCashInvest, cash);

    const investableCash = this.config.useMargin
      ? Math.max(this.config.minCashInvest, maxInvestableCash)
      : maxInvestableCash;

    this.logger.info(
      `Cash in account: ${cash} ${this.config.cashCurrency}, limiting investment to ${investableCash} ${this.config.cashCurrency}`
    );

    // Get portfolio
    const portfolio = await this.degiroClient.getPortfolio();

    // Filter existing portfolio ETFs from desired portfolio in config
    const ownedEtfs = portfolio.filter(
      (etf) =>
        etf.positionType === "PRODUCT" &&
        etf.productData &&
        this.config.desiredPortfolio.some(
          (desiredEtf) =>
            desiredEtf.isin === etf.productData.isin &&
            desiredEtf.symbol === etf.productData.symbol
        )
    );

    // Get total value of all ETFs in portfolio
    const totalETFValue = getSumOfProperty(ownedEtfs, (x) => x.value);

    const coreEtfs: BuyInfo[] = [];
    const paidEtfs: BuyInfo[] = [];

    // Check order history for open order if open orders are not allowed
    if (!this.config.allowOpenOrders) {
      const hasOpenOrders = await this.degiroClient.hasOpenOrders();
      if (hasOpenOrders) {
        this.logger.info(`There are currently open orders, doing nothing.`);
        return;
      }
    }

    // Loop over wanted ETFs, see if ratio is below wanted ratio
    for (const etf of this.config.desiredPortfolio) {
      // Find current ETF in owned ETFs
      const matchingOwnedEtfs = ownedEtfs.filter(
        (ownedEtf) =>
          ownedEtf.productData &&
          ownedEtf.productData.isin === etf.isin &&
          ownedEtf.productData.symbol === etf.symbol
      );

      // Calculate owned ratio in relation to total ETF value of portfolio
      const ownedEtfValue = getSumOfProperty(matchingOwnedEtfs, (x) => x.value);
      const ownedEtfValueRatio =
        ownedEtfValue / (totalETFValue + investableCash);

      if (ownedEtfValueRatio >= etf.ratio) {
        this.logger.info(
          `Symbol ${etf.symbol} (${
            etf.isin
          }): actual ratio ${ownedEtfValueRatio.toFixed(
            2
          )} > ${etf.ratio.toFixed(2)} wanted ratio, ignoring.`
        );
        continue;
      }

      this.logger.info(
        `Symbol ${etf.symbol} (${
          etf.isin
        }): actual ratio ${ownedEtfValueRatio.toFixed(2)} < ${etf.ratio.toFixed(
          2
        )} wanted ratio, adding to buy list.`
      );

      const ratioDifference = etf.ratio - ownedEtfValue;

      // Search product
      const product = await this.degiroClient.searchProduct(
        etf.isin,
        etf.exchangeId
      );
      if (!product) {
        this.logger.error(
          `Did not find matching product for symbol ${etf.symbol} (${etf.isin}) on exchange ${etf.exchangeId}`
        );
        continue;
      }

      if (
        etf.degiroCore &&
        !(await this.degiroClient.isInCoreSelection(product.id))
      ) {
        this.logger.info(
          `Symbol ${etf.symbol} (${etf.isin}) on exchange ${product.exchangeId} is in DEGIRO core selection, but does not have core selection transaction fees, ignoring.`
        );
        continue;
      }

      const buyInfo: BuyInfo = { product, ratioDifference };

      if (etf.degiroCore) {
        coreEtfs.push(buyInfo);
      } else {
        paidEtfs.push(buyInfo);
      }
    }

    this.logger.info(
      `Core ETFs eligible for buying: ${coreEtfs
        .map((x) => x.product.symbol)
        .join(", ")}`
    );
    this.logger.info(
      `Paid ETFs eligible for buying: ${paidEtfs
        .map((x) => x.product.symbol)
        .join(", ")}`
    );

    // Either select all eligible core ETFs for buying, or the first paid one
    if (coreEtfs.length > 0) {
      // Place orders for all core ETFs

      this.logger.info(
        `Choosing to buy core ETFs (DEGIRO Core selection), dividing available cash ${
          this.config.divideEqually ? "equally" : "by wanted ratio"
        }`
      );

      // Determine amounts
      let ready = false;

      while (!ready) {
        const cashPerEtf = investableCash / coreEtfs.length;
        const coreEtfsTotalNeededRatio = getSumOfProperty(
          coreEtfs,
          (x) => x.ratioDifference!
        );

        ready = true;

        for (const etf of coreEtfs) {
          const ratio = etf.ratioDifference! / coreEtfsTotalNeededRatio;
          const amount = Math.floor(
            this.config.divideEqually
              ? cashPerEtf / etf.product.closePrice
              : (ratio * investableCash) / etf.product.closePrice
          );

          if (amount > 0) {
            etf.amountToBuy = amount;
          } else {
            ready = false;
            this.logger.info(
              `Cancel order for ${amount} x ${etf.product.symbol}, amount is 0`
            );
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

        const confirmation = await this.degiroClient.placeOrder(
          etf.product.id,
          etf.amountToBuy,
          this.config.dryRun
        );
        this.logger.info(
          `Successfully placed market order for ${etf.amountToBuy} * ${
            etf.product.symbol
          } for ${(etf.product.closePrice * etf.amountToBuy).toFixed(2)} ${
            etf.product.currency
          } (${confirmation})`
        );
      }
    } else {
      // Place order for paid ETF if exists
      const etf = paidEtfs[0];

      if (etf) {
        this.logger.info(
          `Choosing to buy a single paid ETF: ${etf.product.symbol}`
        );

        // Calculate amount
        const amount = Math.floor(investableCash / etf.product.closePrice);

        await delay(2000);
        const confirmation = await this.degiroClient.placeOrder(
          etf.product.id,
          amount,
          this.config.dryRun
        );
        this.logger.info(
          `Successfully placed market order for ${amount} x ${etf.product.symbol} (${confirmation})`
        );
      } else {
        this.logger.info(`No Paid ETF to buy either`);
      }
    }

    this.logger.info(
      `Finished DEGIRO Autobuy at ${new Date().toLocaleString()}\n`
    );
  }
}
