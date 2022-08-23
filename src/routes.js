const Apify = require('apify');

const {
    utils: { log },
} = Apify;
const { applyFunction } = require('./utils');

exports.SEARCH_PAGE = async (page, request, query, requestQueue, maxPostCount, evaledFunc) => {
    // CHECK FOR SELECTOR
    let { savedItems, pageNumber } = request.userData;
    const { hostname } = request.userData;

    await page.waitForSelector('div.sh-pr__product-results');

    const resultsLength = await page.evaluate(() => {
        return document.querySelector('div.sh-pr__product-results').children.length;
    });


    // check HTML if page has no results
    if (resultsLength === 0) {
        log.warning('The page has no results. Check dataset for more info.');

        await Apify.pushData({
            '#debug': Apify.utils.createRequestDebugInfo(request),
        });
    }


    log.info(`Found ${resultsLength} products on the page.`);
    // eslint-disable-next-line no-shadow
    const data = await page.evaluate(
        (maxPostCount, query, savedItems) => {
            // nodes with items
            let results = Array.from(document.querySelectorAll('.sh-dlr__list-result'));
            if (results.length === 0) results = Array.from(document.querySelectorAll('.sh-dgr__content'));
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
                const title = item.querySelector('h3') ? item.querySelector('h3') : null;

                const productName = title?.textContent ?? null;

                const productLinkAnchor = item.querySelector('a[href*="shopping/product/"]')
                    ? item.querySelector('a[href*="shopping/product/"]')
                    : null;
                const productLink = productLinkAnchor ? productLinkAnchor.href : null;

                const price = item.querySelector('div[data-sh-or="price"] div > span > span')?.textContent ?? null;

                const description = item.querySelectorAll('div.hBUZL')[1]?.textContent ?? null;

                const merchantName = item.querySelector('div[data-sh-or="price"]')?.nextSibling?.textContent ?? null;

                const merchantLink = item.querySelector('div[data-sh-or="price"]')?.parentElement?.parentElement?.href ?? null;

                const idArray = productLink ? productLink.split('?')[0].split('/') : null;
                const shoppingId = idArray ? idArray[idArray.length - 1] : null;

                const reviewInfo = item.querySelector('div[aria-label*=","]') ? item.querySelector('div[aria-label*=","]').getAttribute('aria-label') : null;

                const reviewsScore = item.querySelector('div[aria-label*=","]')?.textContent?.slice(0,3) ?? null;
                const reviewsCount = reviewInfo ? reviewInfo.split(' ')[0] : null;

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
                    productDetails: item.querySelectorAll('.translate-content')[1]?.textContent.trim(),
                };

                data.push(output);
            }

            return data;
        },
        maxPostCount,
        query,
        savedItems,
    );
    // ITERATING ITEMS TO EXTEND WITH USERS FUNCTION
    for (let item of data) {
        if (evaledFunc) {
            item = await applyFunction(page, evaledFunc, item);
        }

        await Apify.pushData(item);
        savedItems++;
    }
    log.info(`${Math.min(maxPostCount, resultsLength)} items on the page were successfully scraped.`);
};
