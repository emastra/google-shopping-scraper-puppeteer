const Apify = require('apify');

const { utils: { log } } = Apify;
const { applyFunction } = require('./utils');


exports.SEARCH_PAGE = async (page, request, query, requestQueue, maxPostCount, evaledFunc) => {
    // CHECK FOR SELECTOR
    let { savedItems, pageNumber } = request.userData;
    const { hostname } = request.userData;
    try {
        await page.waitForSelector('div.sh-pr__product-results');
    } catch (e) {
        const html = await page.content();
        await Apify.setValue(`ERROR-PAGE-${Math.random()}`, html, { contentType: 'text/html' });
        throw new Error('Page didn\'t load properly, retrying...');
    }
    // GETTING NUMBER OF RESULTS
    const resultsLength = await page.evaluate(() => {
        return document.querySelector('div.sh-pr__product-results').children.length;
    });

    log.info(`Found ${resultsLength} products on the page.`);

    // check HTML if page has no results
    if (resultsLength === 0) {
        log.warning('The page has no results. Check dataset for more info.');

        await Apify.pushData({
            '#debug': Apify.utils.createRequestDebugInfo(request),
        });
    }
    // eslint-disable-next-line no-shadow
    const data = await page.evaluate((maxPostCount, query, savedItems) => {
        // nodes with items
        let results = Array.from(document.querySelectorAll('.sh-dlr__list-result'));
        // limit the results to be scraped, if maxPostCount exists
        if (maxPostCount) {
            results = results.slice(0, maxPostCount - savedItems);
        }

        // eslint-disable-next-line no-shadow
        const data = [];
        // ITERATING NODES TO GET RESULTS
        for (let i = 0; i < results.length; i++) {
            // Please pay attention that "merchantMetrics" and "reviewsLink" were removed from the  "SEARCH" page.
            const item = results[i];
            // KEYS OF OUTPUT OBJ
            const title = item.querySelector('h3');
            const productName = title ? title.textContent : null;

            const productLinkAnchor = item.querySelector('a[href*="shopping/product/"]');
            const productLink = productLinkAnchor ? productLinkAnchor.href : null;
            const price = item.querySelector('div[data-sh-or="price"] div > span > span')
                ? item.querySelector('div[data-sh-or="price"] div > span > span').textContent : null;

            const description = item.querySelectorAll('div.hBUZL')[1].textContent;

            const merchantName = item.querySelector('div[data-sh-or="price"]').nextSibling
                ? item.querySelector('div[data-sh-or="price"]').nextSibling.textContent : null;

            const merchantLink = item.querySelector('div[data-sh-or="price"]').parentElement.parentElement.href;

            const idArray = productLink ? productLink.split('?')[0].split('/') : null;
            const shoppingId = idArray ? idArray[idArray.length - 1] : null;

            const reviewsScore = item.querySelector('div[aria-label*="product reviews"]')
                ? item.querySelector('div[aria-label*="product reviews"] span').textContent : null;
            const reviewsCount = item.querySelector('div[aria-label*="product reviews"]')
                ? item.querySelector('div[aria-label*="product reviews"]').getAttribute('aria-label').split(' ')[0] : null;

            // FINAL OUTPUT OBJ
            const output = {
                query,
                productName,
                productLink,
                price,
                description,
                merchantName,
                merchantLink,
                shoppingId,
                reviewsScore,
                reviewsCount,
                positionOnSearchPage: i + 1,
                productDetails: item.querySelectorAll('.translate-content')[1].textContent.trim(),
            };

            data.push(output);
        }

        return data;
    }, maxPostCount, query, savedItems);

    // ITERATING ITEMS TO EXTEND WITH USERS FUNCTION
    for (let i = 0; i < data.length; i++) {
        let item = data[i];

        if (evaledFunc) {
            item = await applyFunction(page, evaledFunc, item);
        }

        await Apify.pushData(item);
        savedItems++;
    }
    log.info('All items from the page were successfully saved.');

    // COMMENTED PART ABOUT PAGINATION:
    // IT DOESN'T WORK PROPERLY (SHOWS DIFFERENT LOCATION + OFTEN FAILS TO LOAD). NEED TO DIVE DEEPER

    // let nextPageLink;
    // try {
    //     nextPageLink = await page.evaluate(() => {
    //         return document.querySelector('td[role="heading"] a').getAttribute('href');
    //     });
    // } catch (e) {
    //     log.warning('Can not find next page. This page would be the last.');
    // }

    // if (savedItems < maxPostCount && nextPageLink) {
    //     const nextPageUrl = `http://www.${hostname}${nextPageLink}`;
    //     log.info('Adding to the queue next page');
    //     log.info(`Next page: ${nextPageUrl}`);
    //     pageNumber++;
    //     requestQueue.addRequest({
    //         url: nextPageUrl,
    //         userData: {
    //             label: 'SEARCH_PAGE',
    //             query,
    //             hostname,
    //             savedItems,
    //             pageNumber,
    //         },
    //     });
    // } else {
    //     log.info(`Saved ${savedItems} items in total.`);
    // }
};
// ORIGINALLY SCRAPER HAS THIS UNUSED LOGIC FOR ITEM PAGE

// exports.DETAIL_PAGE = async ({request, session}, requestQueue, proxyConfiguration) => {
//     log.info('Processing detail-page: ' + request.url);
//     const { label, query, hostname, item } = request.userData;
//     // console.log(response, puppeteerPool, autoscaledPool, session, proxyInfo);

//     // await page.waitForSelector('table');
//     const data = await page.evaluate(() => {
//         const data = [];

//         const sellerTable = document.querySelector('table');

//         const tbody = sellerTable.querySelector('tbody');
//         const trs = Array.from(tbody.children);

//         for (let i = 0; trs.length; i++) {
//             const tr = trs[i];
//             tds = Array.from(tr.children);

//             currentSeller = Object.create(null);

//             for (let z = 0; tds.length; z++) {
//                 if (z === 0) {
//                     td = tds[z];
//                     currentSeller.sellerName = td.innerText.split('\n')[0];
//                     currentSeller.sellerLink = td.querySelector('a').href;
//                 }

//                 if (z === 2) {
//                     td = tds[z];
//                     currentSeller.sellerPrice = td.innerText;
//                 }
//             }

//             data.push(currentSeller);
//         }

//         return data;
//     });

//     item.sellers = data;

//     Apify.pushData(item);
//     console.log('item with sellers pushed.');
// }
