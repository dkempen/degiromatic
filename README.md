# DEGIRO autobuy script

This script will read your desired portfolio from a config file, and work up to those ratio's automatically.

Possible use cases:

- Set it to run daily and as soon as your account reaches a set amount of cash
- Set it to run monthly

When ran, the script will place orders to get as close to your desired portfolio as possible.

## Disclaimer

> [!CAUTION]
> This script buys financial products with **your** DEGIRO account, and handles **real money**!
> Always, but especially in this case, review this open source code and your configuration **carefully** before running!
>
> Use the **`DRY_RUN`** option that is enabled by default until you are certain that everything is in order, and that no unwanted trades will be executed.
>
> So use at your own risk. The software is provided as is without warranty of any kind under the [MIT licence](LICENCE).

## Installation

TODO...

## Configuration

The script is configured entirely via environment variables. This section describes all available configuration options and their meanings. Only required variables without a default value have to be manually defined.

### Environment variables

| Name                        | Type      | Required | Default      | Description                                                                              |
| --------------------------- | --------- | -------- | ------------ | ---------------------------------------------------------------------------------------- |
| **Credentials**             |           |          |              |                                                                                          |
| `DEGIRO_USERNAME`           | `string`  | ✓        |              | Username of your DEGIRO account.                                                         |
| `DEGIRO_PASSWORD`           | `string`  | ✓        |              | Password of your DEGIRO account (use .env or Docker Secrets!).                           |
| `DEGIRO_TOTP_SEED`          | `string`  | ✗        |              | The TOTP seed (optional) for two-factor authentication (use .env or Docker Secrets!).    |
| **Broker Settings**         |           |          |              |                                                                                          |
| `MIN_CASH_INVEST`           | `number`  | ✓        | `100`        | Minimum total order amount for a single execution.                                       |
| `MAX_CASH_INVEST`           | `number`  | ✓        | `2000`       | Maximum total order amount for a single execution.                                       |
| `MAX_FEE_PERCENTAGE`        | `number`  | ✗        |              | The maximum fee allowed in percent of order amount to prevent high fees on small orders. |
| `CASH_CURRENCY`             | `string`  | ✓        | `EUR`        | Currency of cash in your DEGIRO account (3-letter code seen next to the cash balance).   |
| `ALLOW_OPEN_ORDERS`         | `boolean` | ✓        | `false`      | If `false`, script will not place orders if there are open orders in your account.       |
| `USE_LIMIT_ORDER`           | `boolean` | ✓        | `true`       | Use limit orders instead of market orders.                                               |
| **Portfolio Products**      |           |          |              |                                                                                          |
| `PRODUCT_<SYMBOL>_ISIN`     | `string`  | ✓        |              | ISIN identifier for the product.                                                         |
| `PRODUCT_<SYMBOL>_RATIO`    | `number`  | ✓        |              | Desired relative ratio allocation in your portfolio.                                     |
| `PRODUCT_<SYMBOL>_EXCHANGE` | `number`  | ✓        |              | ID of the exchange to buy the product from (E.g. EAM is 200 & NSY is 676).               |
| **Run Settings**            |           |          |              |                                                                                          |
| `SCHEDULE`                  | `string`  | ✓        | `0 12 * * *` | [Cron schedule](https://crontab.guru/) for when to execute the script.                   |
| `BUY_ON_LAUNCH`             | `boolean` | ✓        | `false`      | Start autobuy immediately on launch. **Use with caution!**                               |
| `DRY_RUN`                   | `boolean` | ✓        | `true`       | If `true`, no actual orders are placed. Only set to false if you are done testing!       |
| `LOG_LEVEL`                 | `string`  | ✓        | `info`       | Application log level (E.g. `error`, `warn`, `info` or `debug`).                         |
| `TZ`                        | `string`  | ✗        |              | Time zone identifier used by the cron schedule.                                          |

### Persistence

The logs and login session data persist inside the `/data` directory. Which can optionally be mounted for outside access and persistence.

### Configure portfolio

TODO...

### How to find product information

So orders can be automatically placed for a product, a couple of pieces of information are needed. Here `VWRL` is used as an example for each one.

#### ISIN

This is the 12 character long [International Securities Identification Number](https://www.degiro.nl/leren-beleggen/begrippenlijst/isin) code that describes the exact financial product.
For example the code for `VWRL` is `IE00B3RBWM25`. It is listed on the details page and next to the product on the DEGIRO website.

#### Exchange ID

The exact same product can often be bought on different exchanges. So in order to specify which one, a couple of steps are needed.
The exchange ID is the same for all products on the same exchange, so you only need to look this up once per exchange.

1. On the DEGIRO website, open DevTools by pressing `F12` and navigate to the Network tab to see requests.
2. Now search the product by symbol (ticker) or ISIN in the search bar in the top left.
3. Look for a request like this `https://trader.degiro.nl/productsearch/secure/v1/lookup?searchText=IE00B3RBWM25`, and view the response data.
4. Click on the product on the exchange you want.
5. Confirm that the exchange the one you want on the details page of the product.
6. Take note of the product ID (in this case `4586985`) by looking at the URL on the details page `https://trader.degiro.nl/trader/#/products/4586985/overview`.
7. Look up the product ID in the open request response data from step 3 and copy the exchange ID (`exchangeId`). In this case `200` for EAM, Euronext Amsterdam.

#### DEGIRO Core Selection

Go to the [DEGIRO Core Selection page](https://www.degiro.nl/tarieven/etf-kernselectie) and look if the product is listed in the Core Selection which means it can be bought with less fees.
In the case of `VWRL` (by searching for the ISIN `IE00B3RBWM25`), it is in the Core Selection for the Euronext Amsterdam exchange.

## Development

1. Install [Node.js](https://nodejs.org/)
2. Clone this repository
3. Copy `example.env` to `.env` and update the configuration
4. Install dependencies and run the script:

```shell
npm i
npm start
```
