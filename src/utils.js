const Apify = require('apify');

const { log } = Apify.utils;

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

async function applyFunction($, evaledFunc, items) {
    const isObject = val => typeof val === 'object' && val !== null && !Array.isArray(val);

    let userResult = {};
    try {
        userResult = await evaledFunc($);
    } catch (err) {
        log.error(`extendOutputFunction crashed! Pushing default output. Please fix your function if you want to update the output. Error: ${err}`);
    }

    if (!isObject(userResult)) {
        log.exception(new Error('extendOutputFunction must return an object!'));
        process.exit(1);
    }

    items.forEach((item, i) => {
        items[i] = { ...item, ...userResult };
    });

    return items;
}

function countryCodeToGoogleHostname(countryCode) {
    const suffix = countryCode.toLowerCase();
    switch (suffix) {
        case 'us':
            return 'www.google.com';
        default:
            return `www.google.${suffix}`;
    }
}

function makeRequestList(queries, inputUrl, countryCode) {
    const hostname = countryCodeToGoogleHostname(countryCode);
    let sources;

    if (!inputUrl) {
        sources = queries.map((query) => {
            const url = `http://${hostname}/search?q=${encodeURIComponent(query)}&tbm=shop&tbs=vw:l`;
    
            return new Apify.Request({
                url,
                userData: {
                    label: 'SEARCH-PAGE',
                    query,
                    hostname,
                },
            });
        });
    }
    
    else {
        sources = inputUrl.map((searchUrl) => {
            const url = searchUrl;
    
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
