import DeGiro from "degiro-api";
import {
  DeGiroActions,
  DeGiroMarketOrderTypes,
  DeGiroProducTypes as DeGiroProductTypes,
  DeGiroTimeTypes,
  PORTFOLIO_POSITIONS_TYPE_ENUM,
} from "degiro-api/dist/enums";
import { OrderType, SearchProductResultType } from "degiro-api/dist/types";
import fs from "fs";
import { authenticator } from "otplib";
import { Logger } from "winston";
import { SESSION_FILE } from "./constants";

export class DegiroClient {
  private degiro!: DeGiro;
  private session: string | undefined;

  constructor(
    private logger: Logger,
    private username: string,
    private password: string,
    private otpSecret?: string
  ) {}

  public async login() {
    if (this.degiro?.isLogin()) {
      return;
    }

    this.getSession();

    this.degiro = new DeGiro({
      username: this.username,
      pwd: this.password,
      oneTimePassword: this.getOTP(),
      jsessionId: this.session,
    });

    this.logger.info("Logging in");
    try {
      await this.degiro.login();
    } catch (e) {
      // Session ID is invalid or expired, login with username and password
      this.degiro = new DeGiro({
        username: this.username,
        pwd: this.password,
        oneTimePassword: this.otpSecret
          ? authenticator.generate(this.otpSecret)
          : undefined,
      });
      try {
        await this.degiro.login();
      } catch (error) {
        switch (error) {
          case "totpNeeded":
            throw new Error(
              "No OTP seed provided. Please add it to the environment variables."
            );
          case "badCredentials":
            throw new Error(
              "Invalid credentials. Please check if the environment variables are correct."
            );
          default:
            throw new Error(`Error logging in: ${error}`);
        }
      }
    }

    if (!this.degiro.isLogin()) {
      throw new Error("Error logging in");
    }

    this.saveSession();
    this.logger.info("Successfully logged in");
  }

  public async getCashFunds(currency: string): Promise<number> {
    const cash = (await this.degiro.getCashFunds()).filter(
      (type) => type.currencyCode === currency
    )[0].value;
    return cash;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async getPortfolio(): Promise<any[]> {
    return await this.degiro.getPortfolio({
      type: PORTFOLIO_POSITIONS_TYPE_ENUM.ALL,
      getProductDetails: true,
    });
  }

  public async hasOpenOrders(): Promise<boolean> {
    return (await this.degiro.getOrders({ active: true })).orders.length > 0;
  }

  public async searchProduct(
    isin: string,
    exchangeId: number
  ): Promise<SearchProductResultType | undefined> {
    const matchingProducts = (
      await this.degiro.searchProduct({
        type: DeGiroProductTypes.etfs,
        text: isin,
      })
    ).filter((product) => {
      return (
        isin.toLowerCase() === product.isin.toLowerCase() &&
        product.exchangeId === exchangeId.toString()
      );
    });

    return matchingProducts.length > 0 ? matchingProducts[0] : undefined;
  }

  public async isInCoreSelection(productId: string): Promise<boolean> {
    // Create order to check transaction fees
    const orderType: OrderType = {
      buySell: DeGiroActions.BUY,
      productId: productId,
      orderType: DeGiroMarketOrderTypes.LIMITED,
      size: 1, // Doesn't matter, just checking transaction fees
      price: 0.01,
      timeType: DeGiroTimeTypes.DAY,
    };
    const order = await this.degiro.createOrder(orderType);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isInCoreSelection = (order as any).messages.includes(
      "trader.orderConfirmation.freeETFCommissionNotice"
    );
    return isInCoreSelection;
  }

  public async placeOrder(
    productId: string,
    amount: number,
    dryRun = true
  ): Promise<string> {
    if (dryRun) {
      return "Dry run. Not placing an actual order.";
    }

    this.logger.info(`Buying ${amount} of ${productId}`);
    const orderType: OrderType = {
      buySell: DeGiroActions.BUY,
      productId: productId,
      orderType: DeGiroMarketOrderTypes.MARKET,
      timeType: DeGiroTimeTypes.DAY,
      size: amount,
    };
    const order = await this.degiro.createOrder(orderType);
    const confirmation = await this.degiro.executeOrder(
      orderType,
      order.confirmationId
    );
    return confirmation.toString();
  }

  private getSession() {
    if (this.session) {
      return;
    }

    try {
      this.session = fs.readFileSync(SESSION_FILE, "utf8");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      if (e.code !== "ENOENT") {
        this.logger.error(`Error while reading session file: ${e}`);
      }
    }
  }

  private saveSession() {
    const jsession = this.degiro.getJSESSIONID();
    if (jsession && jsession !== this.session) {
      try {
        fs.writeFileSync(SESSION_FILE, jsession, "utf8");
      } catch (e) {
        this.logger.error(`Error while writing session file: ${e}`);
      }
    }
  }

  private getOTP(): string | undefined {
    return this.otpSecret ? authenticator.generate(this.otpSecret) : undefined;
  }
}
