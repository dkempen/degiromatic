import DeGiro from "degiro-api";
import {
  DeGiroActions,
  DeGiroMarketOrderTypes,
  DeGiroProducTypes as DeGiroProductTypes,
  DeGiroTimeTypes,
  PORTFOLIO_POSITIONS_TYPE_ENUM,
} from "degiro-api/dist/enums";
import { OrderType } from "degiro-api/dist/types";
import fs from "fs";
import { authenticator } from "otplib";
import { Config } from "./config";
import { delay, getSumOfProperty } from "./util";

export class AutoBuyer {
  async buy() {
    console.log(`Started DEGIRO Autobuy at ${new Date().toLocaleString()}`);

    let config: Config;

    // Read config file
    try {
      const raw = fs.readFileSync("config.json", "utf8");
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
    config.desiredPortfolio.forEach((el) => (el.ratio = el.ratio / totalRatio));

    console.log(
      `Desired portfolio: ${config.desiredPortfolio
        .map((etf) => `${etf.symbol} (${(etf.ratio * 100).toFixed(2)}%)`)
        .join(", ")}`
    );

    // Read session file
    let session;
    try {
      session = fs.readFileSync("session", "utf8");
    } catch (e: any) {
      if (e.code !== "ENOENT") {
        console.log(`Error while reading session file: ${e}`);
      }
    }

    // New Degiro
    const secret = process.env["DEGIRO_OTP_SECRET"];
    let degiro = new DeGiro({
      oneTimePassword: secret ? authenticator.generate(secret) : undefined,
      jsessionId: session,
    });

    // Login
    console.log("Logging in ...");
    try {
      await degiro.login();
    } catch (e) {
      // Session ID is invalid, login with username and password
      degiro = new DeGiro({
        oneTimePassword: secret ? authenticator.generate(secret) : undefined,
      });
      await degiro.login();
    }

    if (!degiro.isLogin()) {
      console.error("Invalid credentials");
      return;
    }

    const jsession = degiro.getJSESSIONID();
    if (jsession && jsession !== session) {
      try {
        fs.writeFileSync("session", jsession, "utf8");
      } catch (e) {
        console.log(`Error while writing session file: ${e}`);
      }
    }

    // Get cash funds
    const cash = (await degiro.getCashFunds()).filter(
      (type) => type.currencyCode === config.cashCurrency
    )[0].value;

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
    const portfolio = await degiro.getPortfolio({
      type: PORTFOLIO_POSITIONS_TYPE_ENUM.ALL,
      getProductDetails: true,
    });

    // Filter existing portfolio ETF's from desired portfolio in config
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

    // Get total value of all ETF's in portfolio
    const totalETFValue = getSumOfProperty(ownedEtfs, (x) => x.value);

    let coreEtfs: any[] = [];
    let paidEtfs: any[] = [];

    // Check order history for open order if open orders are not allowed
    if (!config.allowOpenOrders) {
      const openOrders = (await degiro.getOrders({ active: true })).orders;
      if (openOrders.length) {
        console.log(`There are currently open orders, doing nothing.`);
        return;
      }
    }

    // Loop over wanted ETF's, see if ratio is below wanted ratio
    for (let etf of config.desiredPortfolio) {
      // Find current ETF in owned ETF's
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
      etf.ratioDifference = etf.ratio - ownedEtfValue;

      // Search product
      const matchingProducts = (
        await degiro.searchProduct({
          type: DeGiroProductTypes.etfs,
          text: etf.isin,
        })
      ).filter((product) => {
        return (
          etf.isin.toLowerCase() === product.isin.toLowerCase() &&
          product.exchangeId === etf.exchangeId.toString()
        );
      });
      const product = matchingProducts[0];
      if (!product) {
        console.error(
          `Did not find matching product for symbol ${etf.symbol} (${etf.isin}) on exchange ${etf.exchangeId}`
        );
        continue;
      }

      // Create order to check transaction fees
      const orderType: OrderType = {
        buySell: DeGiroActions.BUY,
        productId: product.id,
        orderType: DeGiroMarketOrderTypes.LIMITED,
        size: 1, // Doesn't matter, just checking transaction fees
        price: 0.01,
        timeType: DeGiroTimeTypes.DAY,
      };
      const order = await degiro.createOrder(orderType);

      if (
        etf.degiroCore &&
        !(order as any).messages.includes(
          "trader.orderConfirmation.freeETFCommissionNotice"
        )
      ) {
        console.log(
          `Symbol ${etf.symbol} (${etf.isin}) on exchange ${product.exchangeId} is in DeGiro core selection, but does not have core selection transaction fees, ignoring.`
        );
        continue;
      }

      let result = { ...etf, ...order, ...product };

      if (etf.degiroCore) {
        coreEtfs.push(result);
      } else {
        paidEtfs.push(result);
      }
    }

    console.log();
    console.log(
      `Core ETF's eligible for buying: ${coreEtfs
        .map((el) => el.symbol)
        .join(", ")}`
    );
    console.log(
      `Paid ETF's eligible for buying: ${paidEtfs
        .map((el) => el.symbol)
        .join(", ")}`
    );
    console.log();

    // Either select all eligible core ETF's for buying, or the first paid one
    if (coreEtfs.length > 0) {
      // Place orders for all core ETF's

      console.log(
        `Choosing to buy core ETF's (DeGiro Core selection), dividing available cash ${
          config.divideEqually ? "equally" : "by wanted ratio"
        }`
      );

      // Determine amounts
      while (true) {
        const cashPerEtf = investableCash / coreEtfs.length;
        const coreEtfsTotalNeededRatio = getSumOfProperty(
          coreEtfs,
          (x) => x.ratioDifference
        );
        let ready = true;

        for (let etf of coreEtfs) {
          const ratio = etf.ratioDifference / coreEtfsTotalNeededRatio;
          const amount = Math.floor(
            config.divideEqually
              ? cashPerEtf / etf.closePrice
              : (ratio * investableCash) / etf.closePrice
          );

          if (amount > 0) {
            etf.amountToBuy = amount;
          } else {
            ready = false;
            console.log(
              `Cancel order for ${amount} * ${etf.symbol}, amount is 0`
            );
            coreEtfs.splice(coreEtfs.indexOf(etf), 1);
            break;
          }
        }
        if (ready) break;
      }

      for (let etf of coreEtfs) {
        // Calculate amount
        if (etf.amountToBuy < 1) {
          continue;
        }

        await delay(1000);

        let confirmation = await placeOrder({
          buySell: DeGiroActions.BUY,
          productId: etf.id,
          orderType: DeGiroMarketOrderTypes.MARKET,
          size: etf.amountToBuy,
          timeType: DeGiroTimeTypes.PERMANENT,
        });
        console.log(
          `Succesfully placed market order for ${etf.amountToBuy} * ${
            etf.symbol
          } for ${(etf.closePrice * etf.amountToBuy).toFixed(2)} ${
            etf.currency
          } (${confirmation})`
        );
      }
    } else {
      // Place order for paid ETF if exists
      const etf = paidEtfs[0];

      if (etf) {
        console.log(`Choosing to buy a single paid ETF: ${etf.symbol}`);

        // Calculate amount
        const amount = Math.floor(investableCash / etf.closePrice);

        await delay(2000);
        let confirmation = await placeOrder({
          buySell: DeGiroActions.BUY,
          productId: etf.id,
          orderType: DeGiroMarketOrderTypes.MARKET,
          size: amount,
        });
        console.log(
          `Succesfully placed market order for ${amount} * ${etf.symbol} (${confirmation})`
        );
      } else {
        console.log(`No Paid ETF to buy either`);
      }
    }

    async function placeOrder(orderType: any) {
      if (config.demo === true) return "demo";

      // const order = await degiro.createOrder(orderType);
      // const confirmation = await degiro.executeOrder(
      //   orderType,
      //   order.confirmationId
      // );
      // return confirmation;
    }
  }
}
