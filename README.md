# DEGIRO ETF autobuy script

This script will read your desired portfolio from a config file, and work up to those ratio's automatically.

Possible use cases:

- You can set it to run daily and as soon as your account reaches a set amount of cash money
- You can set it to run monthly

When ran, the script will place orders to get as closed to your desired portfolio as possible.

## Configuration

### Configuration file

#### General

| Parameter | Value | Description |
| --- | --- | --- |
| `minCashInvest` | number | Minimum total order amount for a single script execution |
| `maxCashInvest` | number | Maximum total order amount for a single script execution |
| `cashCurrency` | string | Currency of cash in your DEGIRO account |
| `allowOpenOrders` | boolean | If set to false, script will not place any orders if there are open orders in your account |
| `useMargin` | boolean | If set to true, the script will place orders even if cash in account is less than minCashInvest. Your DEGIRO account must have margin trading enabled for this to correctly work |
| `divideEqually` | boolean | If set to true, the script will divide the total order amount evenly between multiple free ETFs. If set to false, the script will use the ratio's to divide the total order amount smartly |
| `desiredPortfolio` | etf[] | Your desired portfolio |
| `dryRun` | boolean | If set to true, the script will not actually place orders. Set to true if you want to test out the script or your settings first |

#### Desired portfolio ETF

| Parameter | Value | Description |
| --- | --- | --- |
| `symbol` | string | Ticker symbol for ETF |
| `isin` | string | ISIN for ETF |
| `ratio` | number | Ratio of amount of this ETF you want in your portfolio. NOT A PERCENTAGE! This number is relative to ratio's of your other elements in your desired portfolio |
| `exchangeId` | number | ID of the exchange you want to buy this ETF from. Some examples are: EAM Euronext Amsterdam (200) & NSY New York Stock Exchange: (676) |
| `degiroCore` | boolean | If set to true, orders for this ETF will only be placed if there are low transaction fees when an ETF is part of the Core Selection (see [DEGIRO Core Selection](https://www.degiro.nl/tarieven/etf-kernselectie)) |

### Example

```json
{
  "cashCurrency": "EUR",      // Cash currency is EUR
  "minCashInvest": 400,       // Script will place orders with a total of at least 400 EUR
  "maxCashInvest": 1000,      // Script will place orders with a total of maximum 1000 EUR
  "allowOpenOrders": true,    // Script will place orders even if account has open orders
  "useMargin": true,          // Script will place orders even if cash in account is less than 400 EUR (minCashInvest)
  "divideEqually" : false,    // Script will divide order amounts itself by using ratio's
  "desiredPortfolio": [
    {
      "symbol": "IWDA",       // Symbol of ETF
      "isin": "IE00B4L5Y983", // ISIN of ETF
      "ratio": 88,            // Ratio of this ETF to keep in portfolio
      "exchangeId": 200,      // ID of exchange to buy ETF on, 200 = Euronext Amsterdam
      "degiroCore": true      // Will only place order for this ETF if there are low transaction fees
    },
    {
      "symbol": "IEMA",
      "isin": "IE00B4L5YC18",
      "ratio": 12,
      "exchangeId": 200,
      "degiroCore": true
    },
    {
      "symbol": "INRG",
      "isin": "IE00B1XNHC34",
      "ratio": 43,
      "exchangeId": 608,
      "degiroCore": false
    }
  ],
  "dryRun": true              // Change to false to actually place orders to DEGIRO
}
```

### Environment variables

| Parameter | Value | Description |
| --- | --- | --- |
| `DEGIRO_USERNAME` | string | Username of your DEGIRO account |
| `DEGIRO_PASSWORD` | string | password of your DEGIRO account |
| `DEGIRO_OTP_SEED` | string | The TOTP seed (not the 6 digit code) of your DEGIRO account |
| `SCHEDULE` | cron | Cron schedule for when to execute the autobuy. See [crontab guru](https://crontab.guru/) for reference. |
| `BUY_ON_LAUNCH` | boolean | When true, starts the autobuy on launch, use with caution! |

## How to install

TODO...
