# DEGIROmatic

[![Version][version-badge]][version]
[![GitHub Container Registry][ghcr-badge]][ghcr]
[![Docker Hub][dockerhub-badge]][dockerhub]
[![Image size][size-badge]][dockerhub]
[![Pulls][pulls-badge]][dockerhub]
[![CI][ci-badge]][ci]
[![Vulnerabilities][vulnerabilities-badge]][vulnerabilities]
[![Stars][stars-badge]][stars]

Automated and passive ETF and stock portfolio investing via the DEGIRO broker.

## Features

- **Passive** - Set and forget, so you don't have to remember to invest your balance. Ideal with scheduled payments.
- **Portfolio** - Define your ETFs or stocks portfolio with a target allocation ratio.
- **Rebalancing** - Finds the optimal way to rebalance your portfolio with new orders to match your target allocation.
- **Limits** - Set limits for maximum and minimum order amounts, and maximum fees.
- **Scheduling** - Run monthly, weekly, daily, or anything in between on a custom schedule. Making periodic investing easy.
- **Logging** - All decisions and orders are logged in the console and log file for monitoring and transparency.
- **Dry run** - Use dry run mode to test and review before placing real orders.
- **Secure** - The container image runs rootless and distroless, and ships only a single binary. Along with other security measures.
- **Private** - Fully local, self-hosted, zero telemetry, only connects to DEGIRO directly.
- **Transparent** - The code is fully open source, the Docker image is built on GitHub Actions with attestations.

## Disclaimer

> [!CAUTION]
>
> - This tool places orders for financial products through **your** DEGIRO account, using **real money**.
> - **Always start with `DRY_RUN` enabled** (the default).
>   It simulates the order flow without placing any real orders.
>   Carefully review the simulated orders and your configuration before disabling dry-run mode.
> - Although this tool has been used for years without problems, always review the open source code carefully before allowing real orders to be placed.
> - The software is provided "as is", without warranty of any kind, under the [MIT license].
> - Any example products used in the documentation are for demonstration purposes only and do not constitute investment advice or recommendations.
>   Always do your own research and choose investments that are right for your situation and goals.

## Installation

Install using Docker Compose by copying the compose example below or the [`compose.yaml`] file.

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
      PRODUCT_VGLA_ISIN: IE000VAHT5T0 # Example product, replace with your configuration
      PRODUCT_VGLA_EXCHANGE: 196
      PRODUCT_VGLA_RATIO: 100
      DRY_RUN: true # Set to false only when done testing your configuration
      TZ: Europe/Amsterdam
    volumes:
      - ./data:/data
    # Security settings
    user: uid:gid # Run the container as non-root user
    read_only: true
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
```

## Configuration

The tool is configured entirely via environment variables.
This section describes all available configuration options and their meanings.
Only required variables without a default value have to be manually defined.

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
| `MAX_FEE_PERCENTAGE`        | `number`  | ✗        |              | Maximum fee in percent of order amount to prevent high fees on small orders.             |
| `ALLOW_OPEN_ORDERS`         | `boolean` | ✓        | `false`      | If `false`, do not place orders if there are open orders in your account.                |
| `USE_LIMIT_ORDER`           | `boolean` | ✓        | `true`       | If `true`, use limit orders. If `false`, use market orders.                              |
| `CASH_CURRENCY`             | `string`  | ✓        | `EUR`        | Currency of cash in your DEGIRO account (3-letter code seen next to the cash balance).   |
| **Portfolio products**      |           |          |              |                                                                                          |
| `PRODUCT_<SYMBOL>_ISIN`     | `string`  | ✓        |              | ISIN identifier for the product. (see [ISIN])                                            |
| `PRODUCT_<SYMBOL>_EXCHANGE` | `number`  | ✓        |              | ID of the exchange to order the product from. (see [Exchange ID])                        |
| `PRODUCT_<SYMBOL>_RATIO`    | `number`  | ✓        |              | Desired relative ratio allocation for the product in your portfolio. (see [Ratios])      |
| **Run settings**            |           |          |              |                                                                                          |
| `SCHEDULE`                  | `string`  | ✓        | `0 12 * * *` | Cron schedule for when to run the tool (see [Schedule]).                                 |
| `RUN_ON_LAUNCH`             | `boolean` | ✓        | `false`      | If `true`, immediately run on launch instead of waiting for schedule. Use with caution!  |
| `DRY_RUN`                   | `boolean` | ✓        | `true`       | If `true`, no actual orders are placed. Only set to `false` if you are done testing!     |
| `LOG_LEVEL`                 | `string`  | ✓        | `info`       | Logging level (e.g. `error`, `warning`, `info` or `debug`).                              |
| `TZ`                        | `string`  | ✗        | `UTC`        | Time zone identifier used by the logs and cron schedule. For example `Europe/Amsterdam`. |

### Portfolio

The tool uses the products configuration to build the desired portfolio and place product orders automatically.
In the examples below, `VGLA` (a.k.a. `VALL`) on the `TDG` exchange is used as an example product.

This product is used as an example because it is a cheap global index tracker in the [Core Selection], which has the lowest fees and costs (when traded during primary exchange hours, see [Tradegate] info).
Because the primary use case of this tool is to passively, periodically, consistently invest in a broad market without emotion (see [Periodic Investing] or [Dollar Cost Averaging]).

#### Requirements

- At least 1 product must be specified in the portfolio. There is no maximum number of products, as long as the keys (symbols) are unique.
- All portfolio products have to be owned beforehand in your existing portfolio. This acts as an extra safety measure to always order the intended product.
  If a configured product is not already present in your owned portfolio, the run will be cancelled.
- If there are any other products in your owned portfolio that are not in your configuration, they will be ignored and treated as if they don't exist.

#### Rebalancing

When multiple products are defined in the portfolio, rebalancing will happen automatically.
It works by increasing the order for a product which is underrepresented in the current portfolio ratio.
It will never sell a position which is overrepresented.

If ordering a proportional position of multiple products exceeds the maximum fee percentage for any order (if the `MAX_FEE_PERCENTAGE` is defined),
the order with the highest fee percentage will be excluded and the remaining products will be divided according to the target ratio, resulting in larger orders.
This process will happen until there are no more orders above the maximum fee percentage or no more products are left.
This results in smaller and relatively more expensive orders will be postponed until the next run,
because of the under-representation from the previous omission the resulting larger order size will result in lower combined fees.

And if only a single product is defined, the logic above simply invests the maximum quantity of that product within the fee and cash limits defined in the configuration.

#### Examples

The products of the desired portfolio are configured as a list of environment variables with the symbol as the key for each config.

Example with a single product (`VGLA`):

```yaml
PRODUCT_VGLA_ISIN: IE000VAHT5T0
PRODUCT_VGLA_EXCHANGE: 196
PRODUCT_VGLA_RATIO: 100
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

The symbol (or [ticker]) is the 1 to 5 character long code that describes a financial product on an exchange.
For example the code for `Vanguard FTSE Global All-Cap UCITS ETF USD Acc` on the `TDG` exchange is `VGLA`. It is listed on the details page and next to the product.

#### ISIN

The [ISIN code] is the 12 character long code that describes the exact financial product across exchanges.
For example the code for `VGLA` is `IE000VAHT5T0`. It is listed on the details page and next to the product.

#### Exchange ID

The exact same product can often be bought on different [exchanges].
So in order to specify which one, an exchange ID is needed.
The exchange ID is the same for all products on the same exchange, so you only need to look this up once per exchange.

Below is a table with the ID's of common exchanges:

| Code | Name                    | ID  |
| ---- | ----------------------- | --- |
| TDG  | Tradegate AG            | 196 |
| EAM  | Euronext Amsterdam      | 200 |
| XET  | Xetra                   | 194 |
| MIL  | Euronext Milan          | 608 |
| LSE  | London Stock Exchange   | 570 |
| NSY  | New York Stock Exchange | 676 |
| NDQ  | Nasdaq                  | 663 |

If the exchange is not listed there, use these steps to find it manually:

1. On the DEGIRO website, open DevTools by pressing `F12` and navigate to the Network tab to see requests.
2. Now search the product by symbol (ticker) or ISIN in the search bar in the top left.
3. Look for a request like this `https://trader.degiro.nl/productsearch/secure/v1/lookup?searchText=IE00B3RBWM25`, and view the response data.
4. Click on the product on the exchange you want.
5. Confirm that the exchange is the one you want on the details page of the product.
6. Take note of the product ID (in this case `108509981`) by looking at the URL on the details page `https://trader.degiro.nl/trader/#/products/108509981/overview`.
7. Look up the product ID in the open request response data from step 3 and copy the exchange ID (`exchangeId`). In this case `196` for `TDG`, Tradegate AG.

### Schedule

The `SCHEDULE` environment variable defines when the tool runs and attempts to order products.
It is not a problem if the schedule triggers more than necessary, as the tool will first check the cash amount before ordering products.
However, running it sparsely reduces log noise and is useful when you want to avoid ordering at certain times or dates.
Such as to place orders on the [Tradegate] exchange only on opening hours of primary exchanges to reduce spread costs.

The schedule uses the [cron syntax] with some additional features. See the [Croner docs] for pattern specifications.
Legacy cron syntax has been disabled in Croner to allow for more complex schedules (see the examples).
A minimum interval of 1 minute per schedule is enforced.
You can also combine multiple cron schedules using a `;` separator in cases where a single pattern is insufficient.
Below are a few example schedules:

| Schedule                                          | Description                                                                                        |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `0 12 * * *`                                      | Every day at 12:00 (default)                                                                       |
| `0 10,14 1 * *`                                   | On the 1st of every month at 10:00 and 14:00                                                       |
| `0 10-17 * * mon-fri`                             | Every weekday, every hour from 10:00 to 17:00                                                      |
| `0 12 * * mon#1`                                  | First Monday of the month at 12:00                                                                 |
| `0 12 26-28 jan-nov mon-fri;0 12 2-4 jan mon-fri` | From the 26th to 28th of January to November and the 2nd to 4th of January at 12:00, weekdays only |

## Persistence

The log files and login session data persist inside the `/data` directory, which can optionally be mounted for outside access and persistence.
The logs are also written to standard output.

## Security

Below are a couple of ways to make the container more secure to use.

### Included security measures

- Minimal dependencies
- Uses the pnpm package manager
- Uses the pnpm minimumReleaseAge setting to combat supply chain attacks
- Container is fully distroless
- Ships only a single binary
- Bundled with tree shaking enabled to remove unused code
- Uses artifact [attestations] to verify a secure container image build process

### Rootless

Optionally, for extra security, the container can be run as a non-root user with the user instruction syntax: `user: uid:gid`.
Do so by adding the following line to the service in the compose file:

```yaml
user: 1000:1000
```

When doing so, make sure that the user has permission to write to the data directory.

### Read-only filesystem

Optionally, the container filesystem can be mounted as read-only to prevent runtime modifications and reduce the attack surface.
Do so by adding the following line to the service in the compose file:

```yaml
read_only: true
```

Be aware that if the `/data` directory is not volume mapped, it will disable session token caching and file logging.
If the volume mapping is configured, this option can be enabled with full tool functionality.

### Drop Linux capabilities

Optionally, Linux capabilities can be restricted to minimize the privileges.
To prevent privilege escalation, add:

```yaml
security_opt:
  - no-new-privileges:true
```

To drop all default Linux capabilities, none of which are needed for the tool to function, add:

```yaml
cap_drop:
  - ALL
```

### Network restrictions

Ingress and egress network traffic can be disabled entirely.
With the exception for 2 outbound domains needed for the tool to function:
`trader.degiro.nl` for placing orders, and `charting.vwdservices.com` for real-time financial product pricing.

## Development

1. Install [Node.js].
2. Install [pnpm].
3. Clone this repository.
4. Copy [`example.env`] to `.env` and update the configuration.
5. Install dependencies and run:

```shell
pnpm start
```

[version]: https://github.com/dkempen/degiromatic/releases
[version-badge]: https://img.shields.io/github/v/release/dkempen/degiromatic?label=Version
[size-badge]: https://img.shields.io/docker/image-size/dkempen/degiromatic?label=Size
[pulls-badge]: https://img.shields.io/docker/pulls/dkempen/degiromatic?color=1284c5&label=Pulls
[ghcr]: https://github.com/dkempen/degiromatic/pkgs/container/degiromatic
[ghcr-badge]: https://img.shields.io/badge/GHCR-5f5f5f?logo=docker&logoColor=fff
[dockerhub]: https://hub.docker.com/r/dkempen/degiromatic
[dockerhub-badge]: https://img.shields.io/badge/Docker%20Hub-1284c5?logo=docker&logoColor=fff
[ci]: https://github.com/dkempen/degiromatic/actions/workflows/ci.yaml
[ci-badge]: https://img.shields.io/github/actions/workflow/status/dkempen/degiromatic/ci.yaml?logo=github&logoColor=fff&label=CI
[vulnerabilities]: package.json
[vulnerabilities-badge]: https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/dkempen/53a33a94fb3ba48996d4284b44d26584/raw/audit.json
[stars]: https://github.com/dkempen/degiromatic
[stars-badge]: https://img.shields.io/github/stars/dkempen/degiromatic
[mit license]: https://github.com/dkempen/degiromatic?tab=MIT-1-ov-file
[`compose.yaml`]: compose.yaml
[schedule]: #schedule
[Core Selection]: https://www.degiro.nl/tarieven/etf-kernselectie
[Tradegate]: https://www.degiro.nl/helpdesk/handelsmogelijkheden/waarom-handelen-op-de-tradegate-exchange
[Periodic Investing]: https://www.degiro.nl/leren-beleggen/strategieen/periodiek-beleggen
[Dollar Cost Averaging]: https://www.degiro.nl/leren-beleggen/strategieen/dollar-cost-averaging
[isin]: #isin
[exchange id]: #exchange-id
[ratios]: #ratios
[ticker]: https://www.degiro.nl/leren-beleggen/begrippenlijst/ticker
[isin code]: https://www.degiro.nl/leren-beleggen/begrippenlijst/isin
[exchanges]: https://www.degiro.nl/leren-beleggen/begrippenlijst/beurs
[cron syntax]: https://crontab.guru/
[croner docs]: https://github.com/hexagon/croner#pattern
[attestations]: https://github.com/dkempen/degiromatic/attestations
[node.js]: https://nodejs.org/
[pnpm]: https://pnpm.io/
[`example.env`]: example.env
