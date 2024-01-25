# DEGIRO ETF autobuy script

This script will read your desired portfolio from a config file, and work up to those ratio's automatically.

Possible use cases:

- You can set it to run daily and as soon as your account reaches a set amount of cash money
- You can set it to run monthly

When ran, the script will place orders to get as closed to your desired portfolio as possible.

## Configuration

### Configuration parameters

#### General

| Parameter | Value | Description |
| --- | --- | --- |
| `minCashInvest` | Number | Minimum total order amount for a single script execution |
| `maxCashInvest` | Number | Maximum total order amount for a single script execution |
| `cashCurrency` | String | Currency of cash in your DeGiro account |
| `allowOpenOrders` | Boolean | If set to false, script will not place any orders if there are open orders in your account |
| `useMargin` | Boolean | If set to true, the script will place orders even if cash in account is less than minCashInvest. Your DeGiro account must have margin trading enabled for this to correctly work |
| `divideEqually` | Boolean | If set to true, the script will divide the total order amount evenly between multiple free ETF's. If set to false, the script will use the ratio's to divide the total order amount smartly |
| `desiredPortfolio` | Array | Your desired portfolio |
| `demo` | Boolean | If set to true, the script will not actually place orders. Set to true if you want to test out the script or your settings first |

#### Desired portfolio element

| Parameter | Value | Description |
| --- | --- | --- |
| `symbol` | String | Ticker symbol for ETF |
| `isin` | String | ISIN for ETF |
| `ratio` | Number | Ratio of amount of this ETF you want in your portfolio. NOT A PERCENTAGE! This number is relative to ratio's of your other elements in your desired portfolio |
| `exchangeId` | Number | ID of the exchange you want to buy this ETF from. Some examples are: EAM Euronext Amsterdam 200 &  NSY New York Stock Exchange: 676 |
| `degiroCore` | Boolean | If set to true, orders for this ETF will only be placed if there are no transaction fees (see [DeGiro Core Selection](https://www.degiro.nl/data/pdf/DEGIRO_Trackers_Kernselectie.pdf)) |

### Example

```json
{
  "cashCurrency": "EUR",      // Cash currency is EUR
  "minCashInvest": 500,       // Script will place orders with a total of at least 500 EUR
  "maxCashInvest": 600,       // Script will place orders with a total of maximum 600 EUR
  "allowOpenOrders": true,    // Script will place orders even if account has open orders
  "useMargin": true,          // Script will place orders even if cash in account is less than 500 EUR (minCashInvest)
  "divideEqually" : false,    // Script will divide order amounts itself by using ratio's
  "desiredPortfolio": [
    {
      "symbol": "IWDA",       // Symbol of ETF
      "isin": "IE00B4L5Y983", // ISIN of ETF
      "ratio": 88,            // Ratio of this ETF to keep in portfolio
      "exchangeId": 200,      // ID of exchange to buy ETF on, 200 = Euronext Amsterdam
      "degiroCore": true      // Will only place order for this ETF if there are no transaction fees
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
  "demo": false               // Actually place orders to DeGiro
}
```

## How to install

TODO...
