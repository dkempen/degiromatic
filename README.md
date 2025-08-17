# DEGIROmatic

Passively invest in ETFs or stocks with automated portfolio balancing via the DEGIRO broker.

## Features

- **Passive** - Set and forget, so you don't have to remember to invest your balance. Ideal with scheduled payments.
- **Portfolio** - Define your ETFs or stocks portfolio with a target allocation ratio.
- **Rebalancing** - Finds the optimal way to rebalance your portfolio with new orders to match your target allocation.
- **Limits** - Set limits for maximum and minimum order amounts, and maximum fees.
- **Scheduling** - Run monthly, daily, or anything in between on a custom schedule.
- **Logging** - All decisions and orders are logged for monitoring and transparency.
- **Dry mode** - Use dry mode to test and review before committing.

## Disclaimer

> [!CAUTION]
>
> This tool buys financial products with **your** DEGIRO account, and handles **real money**!
> Always, but especially in this case, review this open source code and your configuration **carefully** before running!
>
> Use the **`DRY_RUN`** option that is enabled by default until you are certain that everything is in order, and that no unwanted trades will be executed.
>
> So use at your own risk. The software is provided as is without warranty of any kind under the [MIT license](LICENSE).

## Installation

Install using Docker Compose by copying the compose example below or the [`compose.yaml`](compose.yaml) file.

```yaml
services:
  degiromatic:
    image: ghcr.io/dkempen/degiromatic:1
    container_name: degiromatic
    restart: unless-stopped
    environment:
      # For all configuration environment variables, see the documentation
      DEGIRO_USERNAME: username
      DEGIRO_PASSWORD: password # Use .env or Docker Secrets!
      DEGIRO_TOTP_SEED: totp_seed # Use .env or Docker Secrets!
      PRODUCT_VWRL_ISIN: IE00B3RBWM25 # Example product, replace with your configuration
      PRODUCT_VWRL_EXCHANGE: 200
      PRODUCT_VWRL_RATIO: 100
      DRY_RUN: true # Set to false only when done testing
      TZ: Europe/Amsterdam
    volumes:
      - ./data:/data
```

## Configuration

The tool is configured entirely via environment variables. This section describes all available configuration options and their meanings. Only required variables without a default value have to be manually defined.

### Environment variables

| Name                        | Type      | Required | Default      | Description                                                                              |
| --------------------------- | --------- | -------- | ------------ | ---------------------------------------------------------------------------------------- |
| **Credentials**             |           |          |              |                                                                                          |
| `DEGIRO_USERNAME`           | `string`  | ✓        |              | Username of your DEGIRO account.                                                         |
| `DEGIRO_PASSWORD`           | `string`  | ✓        |              | Password of your DEGIRO account (use .env or Docker Secrets!).                           |
| `DEGIRO_TOTP_SEED`          | `string`  | ✗        |              | The TOTP seed (optional) for two-factor authentication (use .env or Docker Secrets!).    |
| **Broker settings**         |           |          |              |                                                                                          |
| `MIN_CASH_INVEST`           | `number`  | ✓        | `100`        | Minimum total order amount in cash for a single run.                                     |
| `MAX_CASH_INVEST`           | `number`  | ✓        | `2000`       | Maximum total order amount in cash for a single run.                                     |
| `MAX_FEE_PERCENTAGE`        | `number`  | ✗        |              | The maximum fee allowed in percent of order amount to prevent high fees on small orders. |
| `ALLOW_OPEN_ORDERS`         | `boolean` | ✓        | `false`      | If `false`, do not place orders if there are open orders in your account.                |
| `USE_LIMIT_ORDER`           | `boolean` | ✓        | `true`       | If `true`, use limit orders. If `false`, use market orders.                              |
| `CASH_CURRENCY`             | `string`  | ✓        | `EUR`        | Currency of cash in your DEGIRO account (3-letter code seen next to the cash balance).   |
| **Portfolio products**      |           |          |              |                                                                                          |
| `PRODUCT_<SYMBOL>_ISIN`     | `string`  | ✓        |              | ISIN identifier for the product.                                                         |
| `PRODUCT_<SYMBOL>_EXCHANGE` | `number`  | ✓        |              | ID of the exchange to buy the product from (e.g. EAM: 200, NSY: 676, and NDQ: 663).      |
| `PRODUCT_<SYMBOL>_RATIO`    | `number`  | ✓        |              | Desired relative ratio allocation for the product in your portfolio.                     |
| **Run settings**            |           |          |              |                                                                                          |
| `SCHEDULE`                  | `string`  | ✓        | `0 12 * * *` | [Cron schedule](https://crontab.guru/) for when to run the tool.                         |
| `RUN_ON_LAUNCH`             | `boolean` | ✓        | `false`      | If `true`, immediately run on launch instead of waiting for schedule. Use with caution!  |
| `DRY_RUN`                   | `boolean` | ✓        | `true`       | If `true`, no actual orders are placed. Only set to `false` if you are done testing!     |
| `LOG_LEVEL`                 | `string`  | ✓        | `info`       | Application log level (e.g. `error`, `warn`, `info` or `debug`).                         |
| `TZ`                        | `string`  | ✗        | `UTC`        | Time zone identifier used by the logs and cron schedule. For example `Europe/Amsterdam`. |

### Persistence

The logs and login session data persist inside the `/data` directory, which can optionally be mounted for outside access and persistence.

Optionally, the container can be run as another user with the user instruction syntax: `user: UID:GID`.
For example `user: 1000:1000` in the compose file.
When doing so, make sure that the user has permission to write to the data directory.

### Portfolio

The tool uses configuration details to build the desired portfolio and place product orders automatically.
In the examples below, `VWRL` on the `EAM` exchange is used as a sample product.

#### Examples

The products of the desired portfolio are configured as a list of environment variables with the symbol as the key for each config.
A couple of notes:

- At least 1 product must be specified in the portfolio. There is no maximum number of products, as long as the keys (symbols) are unique.
- All portfolio products have to be owned beforehand in your existing portfolio. This acts as an extra safety measure.
  If a configured product is not already present in your owned portfolio, the run will be cancelled.
- If there are any other products in your owned portfolio that are not in your configuration, they will be ignored and treated as if they don't exist.

Example with a single product (`VWRL`):

```yaml
PRODUCT_VWRL_ISIN: IE00B3RBWM25
PRODUCT_VWRL_EXCHANGE: 200
PRODUCT_VWRL_RATIO: 100
```

Example with multiple products (`IWDA` and `IEMA`):

```yaml
PRODUCT_IWDA_ISIN: IE00B4L5Y983
PRODUCT_IWDA_EXCHANGE: 200
PRODUCT_IWDA_RATIO: 88
PRODUCT_IEMA_ISIN: IE00B4L5YC18
PRODUCT_IEMA_EXCHANGE: 200
PRODUCT_IEMA_RATIO: 12
```

#### Ratios

The product ratios are calculated in relation to each other, not as fixed percentages that add up to 100%.
So for example, a configured portfolio of product A with ratio `4` and product B with ratio `1`, will be calculated to the percentages `80%` and `20%`.
However, it is useful to set the ratios to the exact percentages adding up to 100% for extra clarity. So the last example can also be configured with `80` and `20`.

#### Symbol

The symbol (or [ticker](https://www.degiro.nl/leren-beleggen/begrippenlijst/ticker)) is the 1 to 5 character long code that describes the exact financial product on an exchange.
For example the code for `Vanguard FTSE All-World UCITS ETF USD Dis` on the `EAM` exchange is `VWRL`. It is listed on the details page and next to the product.

#### ISIN

The [ISIN](https://www.degiro.nl/leren-beleggen/begrippenlijst/isin) is the 12 character long code that describes the exact financial product on an exchange.
For example the code for `VWRL` on the `EAM` exchange is `IE00B3RBWM25`. It is listed on the details page and next to the product.

#### Exchange ID

The exact same product can often be bought on different [exchanges](https://www.degiro.nl/leren-beleggen/begrippenlijst/beurs).
So in order to specify which one, a couple of steps are needed.
The exchange ID is the same for all products on the same exchange, so you only need to look this up once per exchange.

1. On the DEGIRO website, open DevTools by pressing `F12` and navigate to the Network tab to see requests.
2. Now search the product by symbol (ticker) or ISIN in the search bar in the top left.
3. Look for a request like this `https://trader.degiro.nl/productsearch/secure/v1/lookup?searchText=IE00B3RBWM25`, and view the response data.
4. Click on the product on the exchange you want.
5. Confirm that the exchange is the one you want on the details page of the product.
6. Take note of the product ID (in this case `4586985`) by looking at the URL on the details page `https://trader.degiro.nl/trader/#/products/4586985/overview`.
7. Look up the product ID in the open request response data from step 3 and copy the exchange ID (`exchangeId`). In this case `200` for `EAM`, Euronext Amsterdam.

## Development

1. Install [Node.js](https://nodejs.org/)
2. Clone this repository
3. Copy [`example.env`](example.env) to `.env` and update the configuration
4. Install dependencies and run:

```shell
npm i
npm start
```
