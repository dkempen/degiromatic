import { SearchProductResultType } from 'degiro-api/dist/types';
import { Logger } from 'winston';
import { Configuration, Product } from './config';
import { Degiro, OwnedProduct } from './degiro';
import { delay, exitProcess } from './util';

export class Buyer {
  constructor(private logger: Logger, private configuration: Configuration, private degiro: Degiro) {}

  public async buy() {
    this.logger.info(`Started DEGIRO Autobuy at ${new Date().toLocaleString()}`);

    // Calculate ratio's for desired portfolio
    const totalRatio = this.configuration.portfolio.reduce((sum, x) => sum + x.ratio, 0);
    this.configuration.portfolio.forEach((product) => (product.ratio = product.ratio / totalRatio));

    this.logger.info(
      `Desired portfolio: ${this.configuration.portfolio
        .map((product) => `${product.symbol} (${(product.ratio * 100).toFixed(2)}%)`)
        .join(', ')}`
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
        `Cash in account (${cash} ${this.configuration.cashCurrency}) ` +
          `is less than minimum cash funds (${this.configuration.minCashInvest} ${this.configuration.cashCurrency}).`
      );
      return;
    }

    // Limit investment to cash funds and maximum investment amount
    const investableCash = Math.min(this.configuration.maxCashInvest, cash);

    this.logger.info(
      `Cash in account: ${cash} ${this.configuration.cashCurrency}, ` +
        `limiting investment to ${investableCash} ${this.configuration.cashCurrency}`
    );

    // Check order history for open order if open orders are not allowed
    if (!this.configuration.allowOpenOrders) {
      const hasOpenOrders = await this.degiro.hasOpenOrders();
      if (hasOpenOrders) {
        this.logger.info(`There are currently open orders, doing nothing.`);
        return;
      }
    }

    // Get owned products
    const ownedProducts = await this.getOwnedProducts();

    // Prepare order list
    const orderList = await this.prepareOrderList(ownedProducts);

    // Calculate optimal order quantities
    await this.calculateOptimalOrderList(orderList, investableCash);

    // Place orders
    await this.placeOrders(orderList);

    // Log current ratios
    this.logOwnedPortfolio(await this.getOwnedProducts());

    // Finished!
    this.logger.info(`Finished DEGIRO Autobuy at ${new Date().toLocaleString()}\n`);
  }

  private async getOwnedProducts(): Promise<OwnedProduct[]> {
    // Get portfolio
    const portfolio = await this.degiro.getPortfolio();

    // Filter owned portfolio products from desired portfolio in configuration
    const ownedProducts = portfolio.filter((ownedProduct) =>
      this.configuration.portfolio.some(
        (wantedProduct) =>
          wantedProduct.isin === ownedProduct.productData.isin &&
          wantedProduct.exchange.toString() === ownedProduct.productData.exchangeId
      )
    );

    return ownedProducts;
  }

  private async prepareOrderList(ownedProducts: OwnedProduct[]): Promise<Order[]> {
    // Get a list of wanted products with fees
    const orders: Order[] = [];
    for (const product of ownedProducts) {
      const searchedProduct = await this.degiro.searchProduct(product.productData.isin, product.productData.exchangeId);
      if (!searchedProduct) {
        this.logger.error(
          `Did not find matching for product ${product.productData.symbol} (${product.productData.isin})`
        );
        continue;
      }
      const transactionFee = await this.degiro.getTransactionFee(searchedProduct.id);
      const price = await this.degiro.getPrice(searchedProduct.vwdId);

      if (!price) {
        this.logger.error(
          `Could not find price for product ${product.productData.symbol} (${product.productData.isin})`
        );
        continue;
      }

      const order: Order = {
        product: searchedProduct,
        owned: product,
        configuration: this.configuration.portfolio.find(
          (x) => x.isin === searchedProduct.isin && x.exchange.toString() === searchedProduct.exchangeId
        )!,
        price: price + 0.02, // Add 2 cents to allow for price fluctuations
        fee: transactionFee,
        quantity: 0,
        ratio: 0,
        ratioError: 0,
        feePercentage: 0,
      };

      orders.push(order);
    }

    // Calculate current ratios and log it
    this.logOwnedPortfolio(orders.map((x) => x.owned));

    return orders;
  }

  private logOwnedPortfolio(ownedProducts: OwnedProduct[]) {
    const ownedTotalValue = ownedProducts.reduce((sum, x) => sum + x.value, 0);
    this.logger.info(
      `Owned portfolio: ${ownedProducts
        .map((product) => `${product.productData.symbol} (${((product.value / ownedTotalValue) * 100).toFixed(2)}%)`)
        .join(', ')}`
    );
  }

  private async calculateOptimalOrderList(orders: Order[], investableCash: number): Promise<Order[]> {
    // Get current owned value of all owned products
    const ownedTotalValue = orders.reduce((sum, x) => sum + x.owned.value, 0);
    const totalValue = ownedTotalValue + investableCash;

    // Loop and products to order list approaching by not exceeding the ratio and update the ratio
    for (const order of orders) {
      order.quantity = this.calculateMaxQuantity(order.owned.value, totalValue, order.configuration.ratio, order.price);
      this.updateRatio(order, totalValue);
    }

    // Try incrementing the quantity of the order with the greatest ratio error
    while (true) {
      orders.sort((a, b) => b.ratioError - a.ratioError);
      const order = orders[0];
      order.quantity++;
      this.updateRatio(order, totalValue);
      const leftoverCash = this.calculateLeftoverCash(orders, investableCash);

      if (leftoverCash < 0) {
        order.quantity--;
        this.updateRatio(order, totalValue);
        break;
      }
    }

    // Try adding 1 to each other order until all cash is spent
    let added = true;
    while (added) {
      added = false;
      orders.sort((a, b) => b.ratioError - a.ratioError);
      for (const order of orders) {
        order.quantity++;
        this.updateRatio(order, totalValue);
        const leftoverCash = this.calculateLeftoverCash(orders, investableCash);

        if (leftoverCash < 0) {
          order.quantity--;
          this.updateRatio(order, totalValue);
        } else {
          added = true;
        }
      }
    }

    // If maximum fee is not configured, the orders are ready to be placed.
    if (!this.configuration.maxFeePercentage) {
      return orders;
    }

    // If there are orders above the maximum fee percentage, blacklist the order with the highest fee percentage and start from scratch.
    orders.sort((a, b) => b.feePercentage - a.feePercentage);
    const order = orders[0];
    if (order.feePercentage > this.configuration.maxFeePercentage) {
      this.logger.info(
        `Product ${order.product.symbol} (${order.product.isin}) removed from order list ` +
          `because the fee of ${order.fee.toFixed(2)} ${order.product.currency} ` +
          `(${order.feePercentage.toFixed(2)}% of order) is above the maximum ` +
          `of ${this.configuration.maxFeePercentage.toFixed(2)}%`
      );
      orders.splice(0, 1);

      // If there are no orders left, return.
      if (orders.length === 0) {
        return orders;
      }

      // Recalculate with filtered orders
      return this.calculateOptimalOrderList(orders, investableCash);
    }

    // If there are no orders above the maximum fee, the orders are ready to be placed.
    return orders;
  }

  private calculateMaxQuantity(ownedValue: number, totalValue: number, wantedRatio: number, price: number): number {
    const wantedValue = wantedRatio * totalValue;
    const missingValue = wantedValue - ownedValue;
    // Already at or above target
    if (missingValue <= 0) {
      return 0;
    }
    return Math.floor(missingValue / price);
  }

  private updateRatio(order: Order, totalValue: number) {
    order.ratio = (order.owned.value + order.quantity * order.price) / totalValue;
    order.ratioError = order.configuration.ratio = order.ratio;
    order.feePercentage = (order.fee / (order.quantity * order.price)) * 100;
  }

  private calculateLeftoverCash(orders: Order[], investableCash: number): number {
    const totalCost = orders.reduce((sum, order) => sum + order.price * order.quantity + order.fee, 0);
    return investableCash - totalCost;
  }

  private async placeOrders(orders: Order[]) {
    for (const order of orders) {
      const confirmation = await this.degiro.placeOrder(
        order.product.id,
        order.quantity,
        this.configuration.useLimitOrder ? order.price : undefined,
        this.configuration.dryRun
      );
      this.logger.info(
        `${this.configuration.dryRun ? 'Placed simulated' : 'Successfully placed'} ` +
          `${this.configuration.useLimitOrder ? 'limit' : 'market'} order ` +
          `for ${order.quantity} x ${order.product.symbol} (${order.product.isin}) ` +
          `at ${order.product.closePrice.toFixed(2)} ${order.product.currency} for a total of ` +
          `${(order.product.closePrice * order.quantity).toFixed(2)} ${order.product.currency} (${confirmation})`
      );
      await delay(1000);
    }
  }
}

interface Order {
  product: SearchProductResultType;
  owned: OwnedProduct;
  configuration: Product;
  fee: number;
  price: number;
  quantity: number;
  ratio: number;
  ratioError: number;
  feePercentage: number;
}
