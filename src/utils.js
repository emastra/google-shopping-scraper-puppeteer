const Apify = require('apify');

const { log } = Apify.utils;
const googleDomains = require('./google-domains.json');

function checkAndEval(extendOutputFunction) {
    let evaledFunc;

    try {
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
    const isObject = val => typeof val === 'object' && val !== null && !Array.isArray(val);

    const pageFunctionString = extendOutputFunction.toString();

    const evaluatePageFunction = async (fnString) => {
        const fn = eval(fnString);
        try {
            const result = await fn($);
            return { result };
        } catch (e) {
            return { error: e.toString()} ;
        }
    };

    await Apify.utils.puppeteer.injectJQuery(page);
    const { result, error } = await page.evaluate(evaluatePageFunction, pageFunctionString);
    if (error) {
        console.log(`extendOutputFunctionfailed. Returning default output. Error: ${error}`);
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

function makeRequestList(queries, inputUrl, countryCode) {
    const hostname = countryCodeToGoogleHostname(countryCode);
    let sources;

    if (!inputUrl) {
        sources = queries.map((query) => {
            const url = `http://www.${hostname}/search?q=${encodeURIComponent(query)}&tbm=shop&tbs=vw:l`;

            return new Apify.Request({
                url,
                userData: {
                    label: 'SEARCH-PAGE',
                    query,
                    hostname,
                },
            });
        });
    } else {
        sources = inputUrl.map((searchUrl) => {
            // URL has to start with plain http for SERP proxy to work
            let url = searchUrl;
            if (url.startsWith('https')) {
                url = url.replace('https', 'http');
            }

            if (url.startsWith('http://google')) {
                url = url.replace('http://google', 'http://www.google');
            }

            return new Apify.Request({
                url,
                userData: {
                    label: 'SEARCH-PAGE',
                    query: url,
                    hostname,
                },
            });
        });
    }

    return Apify.openRequestList('products', sources);
}

module.exports = {
    checkAndEval,
    applyFunction,
    makeRequestList
};
