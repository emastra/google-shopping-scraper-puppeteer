const Apify = require('apify');

const { log } = Apify.utils;
const googleDomains = require('./google-domains.json');

function checkAndEval(extendOutputFunction) {
    let evaledFunc;
    try {
        // eslint-disable-next-line no-eval
        evaledFunc = eval(extendOutputFunction);
    } catch (e) {
        throw new Error(`extendOutputFunction is not a valid JavaScript! Error: ${e}`);
    }

    if (typeof evaledFunc !== 'function') {
        throw new Error('extendOutputFunction is not a function! Please fix it or use just default output!');
    }

    return evaledFunc;
}

async function applyFunction(page, extendOutputFunction, item) {
    const isObject = (val) => typeof val === 'object' && val !== null && !Array.isArray(val);

    const pageFunctionString = extendOutputFunction.toString();

    const evaluatePageFunction = async (fnString) => {
        const fn = eval(fnString);
        try {
            const result = await fn($);
            return { result };
        } catch (e) {
            return { error: e.toString() };
        }
    };

    await Apify.utils.puppeteer.injectJQuery(page);
    const { result, error } = await page.evaluate(evaluatePageFunction, pageFunctionString);
    if (error) {
        log.info(`extendOutputFunctionfailed. Returning default output. Error: ${error}`);
        return item;
    }

    if (!isObject(result)) {
        log.exception(new Error('extendOutputFunction must return an object!'));
        process.exit(1);
    }

    return { ...item, ...result };
}

function countryCodeToGoogleHostname(countryCode) {
    const suffix = countryCode.toUpperCase();
    return googleDomains[suffix];
}

// New function which forms a URL from countryCode and query params
function formUrl(countryCode, query) {
    const hostname = countryCodeToGoogleHostname(countryCode);
    const url = `http://www.${hostname}/search?q=${encodeURIComponent(query)}&tbm=shop&tbs=vw:l`;
    return { url, hostname };
}

async function makeRequestList(queries, inputUrl, countryCode) {
    const hostname = countryCodeToGoogleHostname(countryCode);
    let sources = [];

    if (!inputUrl) {
        sources = queries.map((query) => {
            const { url } = formUrl(countryCode, query);

            return new Apify.Request({
                url,
                userData: {
                    label: 'SEARCH_PAGE',
                    query,
                    hostname,
                    savedItems: 0,
                    pageNumber: 1,
                },
            });
        });
    } else {
        const startUrls = [];
        for await (const req of fromStartUrls(inputUrl)) {
            // Parse out the keyword from the provided URL and format it into our own URL
            // Why? Selectors seem to be different depending on the TYPE of Google Shopping page you're on
            const keyword = new URL(req.url).searchParams.get('q');
            const { url } = formUrl(countryCode, keyword);
            startUrls.push({ ...req, url });
        }
        sources = startUrls.map((startUrl) => {
            // URL has to start with plain http for SERP proxy to work
            let { url } = startUrl;
            if (url.startsWith('https')) {
                url = url.replace('https', 'http');
            }

            if (url.startsWith('http://google')) {
                url = url.replace('http://google', 'http://www.google');
            }

            return new Apify.Request({
                url,
                userData: {
                    label: 'SEARCH_PAGE',
                    query: url,
                    hostname,
                    savedItems: 0,
                    pageNumber: 1,
                },
            });
        });
    }
    return Apify.openRequestList('products', sources);
}

// FUNCTION TO DEAL WITH ALL TYPES OF START URLS  (EXTERNAL CSV FILE, LOCAL TXT-FILE, NORMAL URL)
async function* fromStartUrls(startUrls, name = 'STARTURLS') {
    const rl = await Apify.openRequestList(name, startUrls);

    /** @type {Apify.Request | null} */
    let rq;

    // eslint-disable-next-line no-cond-assign
    while ((rq = await rl.fetchNextRequest())) {
        yield rq;
    }
}

module.exports = {
    checkAndEval,
    applyFunction,
    makeRequestList,
    fromStartUrls,
};
