const Apify = require('apify');

const { log, sleep } = Apify.utils;

const {
    checkAndEval,
    applyFunction,
    makeRequestList
} = require('./utils');


Apify.main(async () => {
    const input = await Apify.getValue('INPUT');

    // Validate the input
    if (!input) throw new Error('Missing configuration');

    const {
        queries = null,
        inputUrl = null,
        countryCode,
        maxPostCount,
        isAdvancedResults,
        extendOutputFunction = null,
    } = input;

    if (!(queries && countryCode) && !inputUrl) {
        throw new Error('At least "Search Queries & countryCode" or "Input URL" must be provided');
    }

    // Prepare the initial list of google shopping queries and request queue
    const requestList = await makeRequestList(queries, inputUrl, countryCode);
    log.info('Search URLs:');
    requestList.requests.forEach(r => console.log('  ', r.url));

    const requestQueue = await Apify.openRequestQueue();

    // if exists, evaluate extendOutputFunction
    let evaledFunc;
    if (extendOutputFunction) evaledFunc = checkAndEval(extendOutputFunction);

    const proxyConfiguration = await Apify.createProxyConfiguration({
        groups: ['GOOGLE_SERP'],
    });

    // crawler config
    const crawler = new Apify.PuppeteerCrawler({
        requestList,
        requestQueue,
        maxRequestRetries: 3,
        handlePageTimeoutSecs: 240,
        maxConcurrency: 20,
        proxyConfiguration,
        launchPuppeteerOptions: {
            timeout: 120 * 1000,
            headless: true,
        },
        gotoFunction: async ({ request, page }) => {
            return page.goto(request.url, {
                timeout: 180 * 1000,
                waitUntil: 'load',
            });
        },

        handlePageFunction: async ({ page, request, response, puppeteerPool, autoscaledPool, session, proxyInfo }) => {
            log.info('Processing: ' + request.url);
            const { label, query, hostname } = request.userData;

            if (label === 'SEARCH-PAGE') {
                try {
                    await page.waitForSelector('div.sh-pr__product-results');
                } catch (e) {
                    const html = await page.content();
                    await Apify.setValue(`ERROR-PAGE-${Math.random()}`, html, { contentType: 'text/html' });
                    throw `Page didn't load properly, retrying...`;
                }
                const resultsLength = await page.evaluate(() => {
                    return document.querySelector('div.sh-pr__product-results').children.length;
                });

                log.info(`Processing "${query}" - found ${resultsLength} products`);

                // check HTML if page has no results
                if (resultsLength === 0) {
                    log.warning('The page has no results. Check dataset for more info.');

                    await Apify.pushData({
                        '#debug': Apify.utils.createRequestDebugInfo(request),
                    });
                }

                const data = await page.evaluate((maxPostCount, query) => {
                    let results = Array.from(document.querySelector('div.sh-pr__product-results').children);
                    results = results.filter(item => item.classList.contains('sh-dlr__list-result'));

                    // limit the results to be scraped, if maxPostCount exists
                    if (maxPostCount) {
                        results = results.slice(0, maxPostCount);
                    }

                    const data = [];

                    for (let i = 0; i < results.length; i++) {
                        const item = results[i];

                        const title = item.querySelector('h3');
                        const productName = title ? title.textContent : null;

                        const productLinkAnchor = item.querySelector('a[href*="shopping/product/"]');
                        const productLink = productLinkAnchor ? productLinkAnchor.href : null;

                        const priceTag = item.querySelector('span.h1Wfwb');
                        const priceSpan = priceTag.querySelector('span[aria-hidden="true"]');
                        const price = priceSpan ? priceSpan.textContent : null;

                        let description = item.querySelectorAll('div.hBUZL')[1].textContent;

                        const merchantAnchor = item.querySelector('a[class*=merchant-name]');
                        const merchantName = merchantAnchor ? merchantAnchor.textContent : '';

                        const merchantMetricsAnchor = item.querySelector('a[href*="shopping/ratings/account/metrics"]');
                        let merchantMetrics = merchantMetricsAnchor ? merchantMetricsAnchor.textContent : '';

                        let merchantLink = merchantAnchor ? merchantAnchor.href : '';

                        const idArray = productLink ? productLink.split('?')[0].split('/') : null;
                        let shoppingId = idArray ? idArray[idArray.length - 1] : null;

                        const reviewsElement = item.querySelector('a[href$="#reviews"]');
                        let reviewsLink = reviewsElement ? reviewsElement.href : null;
                        const scoreElement = reviewsElement ? reviewsElement.querySelector('span div[aria-label]') : null;
                        let reviewsScore = scoreElement ? scoreElement.attributes['aria-label'].nodeValue : null;
                        let reviewsCount = reviewsElement ? reviewsElement.querySelector('span[aria-label]').textContent : null;

                        const output = {
                            query,
                            productName,
                            productLink,
                            price,
                            description,
                            merchantName,
                            merchantMetrics,
                            merchantLink,
                            shoppingId,
                            reviewsLink,
                            reviewsScore,
                            reviewsCount,
                            positionOnSearchPage: i + 1,
                            productDetails: null,
                        };

                        data.push(output);
                    }

                    return data;
                }, maxPostCount, query);

                for (let i = 0; i < data.length; i++) {
                    let item = data[i];

                    // if basic item, re-initialize item object with relevant props
                    if (!isAdvancedResults) {
                        item = {
                            idArray: item.idArray,
                            shoppingId: item.shoppingId,
                            productName: item.productName,
                            description: item.description,
                            merchantMetrics: item.merchantMetrics,
                            seller: {
                                sellerName: item.merchantName,
                                sellerLink: item.merchantLink,
                                sellerPrice: item.price
                            },
                            price: item.price,
                            merchantLink: item.merchantLink
                        }
                    }

                    // TODO: Not sure why is this commented, fix it
                    // if extended output fnction exists, apply it now.
                    // if (evaledFunc) item = await applyFunction($, evaledFunc, item);

                    await Apify.pushData(item);
                    log.info(`${item.productName} item pushed.`);
                }
            }

            // if (label === 'DETAIL_PAGE') {
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
        },

        handleFailedRequestFunction: async ({ request }) => {
            log.warning(`Request ${request.url} failed too many times`);

            await Apify.pushData({
                '#debug': Apify.utils.createRequestDebugInfo(request),
            });
        },
    });

    log.info('Starting crawler.');
    await crawler.run();

    log.info('Crawler Finished.');
});
