## 2021-05-26
*Changes*
- SDK updated to 2.0.6;

## 2021-06-21
*Changes*
- BREAKING: Changed  editor type for "start URL" field to "requestListSources" in the input.
 Instead of list of strings (e.g. ["https://example.com"]),  now you  need to provide list of Request objects (e.g. [{ "url": "https://example1.com" }, { "url": "https://example2.com" }]) 

## 2021-06-16
*Changes*
- Added option to get input urls from remote CSV file or from uploaded text file from PC (issue #18);
- Removed "advanced" mode for the output (due to being almost similar to "standard" mode) (issue #17).



## 2021-05-26
*Fixes*
- Updated selectors to relevant;
- Removed "merchantMetrics" and "reviewsLink" keys from the output object (this info is not represented on the page);
- Updated SDK to 1.2.0.
