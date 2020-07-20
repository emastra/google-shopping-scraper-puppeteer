# Google Shopping Scraper
Google Shopping Scraper is an [Apify actor](https://apify.com/actors) for extracting data from [Google Shopping](https://www.google.com/shopping) web site, in any country domain. It scrapes the first result page and details about each product and its sellers. It is build on top of [Apify SDK](https://sdk.apify.com/) and you can run it both on [Apify platform](https://my.apify.com) and locally.

- [Input](#input)
- [Output](#output)
- [Google SERP](#google-serp)
- [Expected CU consumption](#expected-cu-consumption)
- [Extend output function](#extend-output-function)
- [Open an issue](#open-an-issue)

### Input

| Field | Type | Description |
| ----- | ---- | ----------- |
| queries | Array of Strings | (Required if you don't use `inputUrl`) List of queries to search for |
| inputUrl | Array of Strings | (Required if you don't use `queries`) Here you can provide a list of search URLs. |
| countryCode | String | (required) Provide the country to search in (choose from the country list when using the editor, provide the country code when using JSON) |
| maxPostCount | Integer | Limit of the results to be scraped per page, 0 means no limit. Currently the actor scrapes only the 1st page (20 results) |
| isAdvancedResults | Boolean | Check this if you want to scrape more data. Your dataset items will have more fields including `merchantName` and `reviews` |
| extendOutputFunction | string | Function that takes a JQuery handle ($) as argument and returns data that will be merged with the default output. More information in [Extend output function](#extend-output-function) |

INPUT Example:

```
{
  "queries": [
    "iphone 11 pro"
  ],
  "countryCode": "US",
  "maxPostCount": 10,
  "isAdvancedResults": true
}
```

### Output

Output is stored in a dataset.
Example of one output item:
```
{
  "query": "iphone 11 pro",
  "productName": "Apple iPhone 11 Pro - 64 GB - Space Gray - Unlocked - CDMA/GSM",
  "productLink": "http://www.google.com/shopping/product/7412086993790421270?q=iphone+11+pro&hl=en&gl=us&uule=w+CAIQICINVW5pdGVkIFN0YXRlcw&prds=epd:12986884032099345386,prmr:1&sa=X&ved=0ahUKEwiVxNfskdTqAhVmTRUIHZZBByMQ8gII0QQ",
  "price": "$999.00",
  "description": "5,453 product reviews",
  "merchantName": "Apple",
  "merchantMetrics": "93% positive seller rating",
  "merchantLink": "http://www.google.com/aclk?sa=L&ai=DChcSEwiRydvskdTqAhWF7u0KHbFVAVsYABAEGgJkZw&sig=AOD64_3XQE0ANMdXdV-A13_3UoAq7QojIA&ctype=5&q=&ved=0ahUKEwiVxNfskdTqAhVmTRUIHZZBByMQg-UECNME&adurl=",
  "shoppingId": "7412086993790421270",
  "reviewsLink": "http://www.google.com/shopping/product/7412086993790421270?q=iphone+11+pro&hl=en&gl=us&uule=w+CAIQICINVW5pdGVkIFN0YXRlcw&prds=epd:12986884032099345386,prmr:1&sa=X&ved=0ahUKEwiVxNfskdTqAhVmTRUIHZZBByMQ9AII1gQ#reviews",
  "reviewsScore": "4.7 out of 5 stars",
  "reviewsCount": "5,453 product reviews",
  "positionOnSearchPage": 2,
  "productDetails": null
},
```

*Note about price format*
- Different countries has different price formats, currently the actor leaves the price format as it is found on the page.

*Note about the results*
- Google results are affected by your internet history. The results from the scraper might differ from the results in your browser.

### Google SERP
The actor uses Google SERP Proxy to scrape localized results. For more information, check the [documentation](https://docs.apify.com/proxy/google-serp-proxy).

### Extend output function

You can use this function to update the default output of this actor. This function gets a JQuery handle `$` as an argument so you can choose what data from the page you want to scrape. The output from this will function will get merged with the default output.

The **return value** of this function has to be an **object**!

You can return fields to achieve 3 different things:
- Add a new field - Return object with a field that is not in the default output
- Change a field - Return an existing field with a new value
- Remove a field - Return an existing field with a value `undefined`

The following example will add a new field:
```
($) => {
    return {
        comment: 'This is a comment',
    }
}
```

### Expected CU consumption
Expected compute units is 0.394 every 10 products.

### Open an issue
If you find any bug, please create an issue on the actor [Github page](https://github.com/emastra/google-shopping-scraper-puppeteer).
