import fs from "fs";
import { BuyInfo } from "./buy-info";
import { Config } from "./config";
import {
  CONFIG_FILE,
  DEGIRO_OTP_SEED,
  DEGIRO_PASSWORD,
  DEGIRO_USERNAME,
} from "./constants";
import { DegiroClient } from "./degiro-client";
import { delay, exitProcess, getSumOfProperty } from "./util";

export class AutoBuyer {
  private degiroClient: DegiroClient;

  constructor() {
    const username = process.env[DEGIRO_USERNAME];
    const password = process.env[DEGIRO_PASSWORD];
    const otpSecret = process.env[DEGIRO_OTP_SEED];

    if (!username) {
      throw new Error(
        "No username provided. Please add it to the environment variables."
      );
    }
    if (!password) {
      throw new Error(
        "No username provided. Please add it to the environment variables."
      );
    }

    this.degiroClient = new DegiroClient(username, password, otpSecret);
  }

  async buy() {
    console.log(`\nStarted DEGIRO Autobuy at ${new Date().toLocaleString()}`);

    let config: Config;

    // Read config file
    try {
      const raw = fs.readFileSync(CONFIG_FILE, "utf8");
      config = JSON.parse(raw);
    } catch (e) {
      console.log(`Error while reading config file: ${e}`);
      return;
    }
    // TODO: Validate required properties

    // Process some things from config: Calculate ratios for desired portfolio
    const totalRatio = getSumOfProperty(
      config.desiredPortfolio,
      (x) => x.ratio
    );
    config.desiredPortfolio.forEach((x) => (x.ratio = x.ratio / totalRatio));

    console.log(
      `Desired portfolio: ${config.desiredPortfolio
        .map((etf) => `${etf.symbol} (${(etf.ratio * 100).toFixed(2)}%)`)
        .join(", ")}`
    );

    // Login
    try {
      await this.degiroClient.login();
    } catch (error) {
      exitProcess(error);
    }

    // Get cash funds
    const cash = await this.degiroClient.getCashFunds(config.cashCurrency);

    // If cash funds is high enough -> continue
    if (cash < config.minCashInvest && !config.useMargin) {
      console.log(
        `Cash in account (${cash} ${config.cashCurrency}) is less than minimum cash funds (${config.minCashInvest} ${config.cashCurrency}).`
      );
      return;
    }

    const maxInvestableCash = Math.min(config.maxCashInvest, cash);

    const investableCash = config.useMargin
      ? Math.max(config.minCashInvest, maxInvestableCash)
      : maxInvestableCash;

    console.log(
      `Cash in account: ${cash} ${config.cashCurrency}, limiting investment to ${investableCash} ${config.cashCurrency}`
    );

    // Get portfolio
    const portfolio = await this.degiroClient.getPortfolio();

    // Filter existing portfolio ETFs from desired portfolio in config
    const ownedEtfs = portfolio.filter(
      (etf) =>
        etf.positionType === "PRODUCT" &&
        etf.productData &&
        config.desiredPortfolio.some(
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
    if (!config.allowOpenOrders) {
      const hasOpenOrders = await this.degiroClient.hasOpenOrders();
      if (hasOpenOrders) {
        console.log(`There are currently open orders, doing nothing.`);
        return;
      }
    }

    // Loop over wanted ETFs, see if ratio is below wanted ratio
    for (const etf of config.desiredPortfolio) {
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
        console.log(
          `Symbol ${etf.symbol} (${
            etf.isin
          }): actual ratio ${ownedEtfValueRatio.toFixed(
            2
          )} > ${etf.ratio.toFixed(2)} wanted ratio, ignoring.`
        );
        continue;
      }

      console.log(
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
        console.error(
          `Did not find matching product for symbol ${etf.symbol} (${etf.isin}) on exchange ${etf.exchangeId}`
        );
        continue;
      }

      if (
        etf.degiroCore &&
        !(await this.degiroClient.isInCoreSelection(product.id))
      ) {
        console.log(
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

    console.log();
    console.log(
      `Core ETFs eligible for buying: ${coreEtfs
        .map((x) => x.product.symbol)
        .join(", ")}`
    );
    console.log(
      `Paid ETFs eligible for buying: ${paidEtfs
        .map((x) => x.product.symbol)
        .join(", ")}`
    );
    console.log();

    // Either select all eligible core ETFs for buying, or the first paid one
    if (coreEtfs.length > 0) {
      // Place orders for all core ETFs

      console.log(
        `Choosing to buy core ETFs (DEGIRO Core selection), dividing available cash ${
          config.divideEqually ? "equally" : "by wanted ratio"
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
            config.divideEqually
              ? cashPerEtf / etf.product.closePrice
              : (ratio * investableCash) / etf.product.closePrice
          );

          if (amount > 0) {
            etf.amountToBuy = amount;
          } else {
            ready = false;
            console.log(
              `Cancel order for ${amount} * ${etf.product.symbol}, amount is 0`
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
          config.dryRun
        );
        console.log(
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
        console.log(`Choosing to buy a single paid ETF: ${etf.product.symbol}`);

        // Calculate amount
        const amount = Math.floor(investableCash / etf.product.closePrice);

        await delay(2000);
        const confirmation = await this.degiroClient.placeOrder(
          etf.product.id,
          amount,
          config.dryRun
        );
        console.log(
          `Successfully placed market order for ${amount} x ${etf.product.symbol} (${confirmation})`
        );
      } else {
        console.log(`No Paid ETF to buy either`);
      }
    }

    console.log(`Finished DEGIRO Autobuy at ${new Date().toLocaleString()}\n`);
  }
}
