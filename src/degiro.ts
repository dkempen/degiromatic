import DeGiro from "degiro-api";
import {
  DeGiroActions,
  DeGiroMarketOrderTypes,
  DeGiroTimeTypes,
  PORTFOLIO_POSITIONS_TYPE_ENUM,
} from "degiro-api/dist/enums";
import { DeGiroSettupType as DeGiroSetupType, OrderType, SearchProductResultType } from "degiro-api/dist/types";
import fs from "fs";
import { TOTP } from "otpauth";
import { Logger } from "winston";
import { Configuration, Credentials } from "./config";
import { CONFIG_DIRECTORY, SESSION_FILE } from "./constants";

export class Degiro {
  private degiro!: DeGiro;
  private session: string | undefined;
  private accountId: number | undefined;
  private credentials: Credentials;
  private readonly sessionFilePath = CONFIG_DIRECTORY + SESSION_FILE;

  constructor(private logger: Logger, configuration: Configuration) {
    this.credentials = configuration.credentials;
  }

  public async login() {
    if (this.degiro?.isLogin()) {
      return;
    }

    this.getSession();

    this.degiro = new DeGiro({
      username: this.credentials.username,
      pwd: this.credentials.password,
      oneTimePassword: this.getOTP(),
      jsessionId: this.session,
    } as DeGiroSetupType);

    this.logger.info("Logging in");
    try {
      await this.degiro.login();
      const accountData = await this.degiro.getAccountData();
      this.accountId = accountData.data.id;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      // Session ID is invalid or expired, login with username and password
      this.degiro = new DeGiro({
        username: this.credentials.username,
        pwd: this.credentials.password,
        oneTimePassword: this.getOTP(),
      } as DeGiroSetupType);
      try {
        await this.degiro.login();
        const accountData = await this.degiro.getAccountData();
        this.accountId = accountData.data.id;
      } catch (error) {
        switch (error) {
          case "totpNeeded":
            throw new Error("No TOTP seed provided. Please add it to the environment variables.");
          case "badCredentials":
            throw new Error("Invalid credentials. Please check if the environment variables are correct.");
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
    return (await this.degiro.getCashFunds()).filter((type) => type.currencyCode === currency)[0]!.value;
  }

  public async getPortfolio(): Promise<OwnedProduct[]> {
    return (await this.degiro.getPortfolio({ type: PORTFOLIO_POSITIONS_TYPE_ENUM.OPEN, getProductDetails: true })).map(
      (x) => x
    );
  }

  public async hasOpenOrders(): Promise<boolean> {
    return (await this.degiro.getOrders({ active: true })).orders.length > 0;
  }

  public async searchProduct(isin: string, exchangeId: string): Promise<SearchProductResultType | undefined> {
    const matchingProducts = (await this.degiro.searchProduct({ text: isin })).filter((product) => {
      return isin.toLowerCase() === product.isin.toLowerCase() && product.exchangeId === exchangeId;
    });

    return matchingProducts.length > 0 ? matchingProducts[0] : undefined;
  }

  public async getTransactionFee(productId: string): Promise<number> {
    // Create order to check transaction fees
    const orderType: OrderType = {
      buySell: DeGiroActions.BUY,
      orderType: DeGiroMarketOrderTypes.LIMITED,
      timeType: DeGiroTimeTypes.DAY,
      productId,
      size: 1, // Doesn't matter, just checking transaction fees
      price: 0.01,
    };

    interface OrderDetails {
      transactionFee: number;
      messages: string[];
    }

    const order = (await this.degiro.createOrder(orderType)) as unknown as OrderDetails;
    // const isInCoreSelection = order.messages.includes("trader.orderConfirmation.freeETFCommissionNotice");
    return order.transactionFee;
  }

  public async placeOrder(productId: string, quantity: number, limitOrder?: number, dryRun = true): Promise<string> {
    if (dryRun) {
      return "Dry run. Not placing an actual order.";
    }

    this.logger.info(`Placing order for ${quantity} of ${productId}`);
    const orderType = {
      buySell: DeGiroActions.BUY,
      orderType: limitOrder ? DeGiroMarketOrderTypes.LIMITED : DeGiroMarketOrderTypes.MARKET,
      timeType: DeGiroTimeTypes.DAY,
      productId,
      size: quantity,
      price: limitOrder,
    } as OrderType;
    try {
      const order = await this.degiro.createOrder(orderType);
      const confirmation = await this.degiro.executeOrder(orderType, order.confirmationId);
      return confirmation.toString();
    } catch (error) {
      return `Error during ordering: ${JSON.stringify(error)}`;
    }
  }

  public async getPrice(vwdId: string): Promise<number | undefined> {
    const host = "https://charting.vwdservices.com/";
    const endpoint = "hchart/v1/deGiro/data.js";
    const params = new URLSearchParams({
      requestid: "1",
      resolution: "PT1M",
      period: "P1D",
      series: `issueid:${vwdId}`,
      format: "json",
      userToken: `${this.accountId}`,
    });
    const headers = { Origin: "https://trader.degiro.nl/" };
    const url = `${host}${endpoint}?${params}`;
    const response = await fetch(url, { headers });
    const result = await response.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (result as any).series[0].data.lastPrice as number | undefined;
  }

  private getSession() {
    if (this.session) {
      return;
    }

    try {
      this.session = fs.readFileSync(this.sessionFilePath, "utf8");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      if (e.code !== "ENOENT") {
        this.logger.error(`Error while reading session file: ${e}`);
      }
    }
  }

  private saveSession() {
    const session = this.degiro.getJSESSIONID();
    if (session && session !== this.session) {
      try {
        fs.writeFileSync(this.sessionFilePath, session, "utf8");
      } catch (e) {
        this.logger.error(`Error while writing session file: ${e}`);
      }
    }
  }

  private getOTP(): string | undefined {
    return this.credentials.totpSeed ? new TOTP({ secret: this.credentials.totpSeed }).generate() : undefined;
  }
}

export interface OwnedProduct {
  value: number;
  productData: {
    symbol: string;
    isin: string;
    exchangeId: string;
  };
}
