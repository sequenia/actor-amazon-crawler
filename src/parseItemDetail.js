const Apify = require('apify');
const parsePrice = require('parse-price');

const { log } = Apify.utils;

function extractPriceInfo($) {
    const possiblePriceSelectors = getPossiblePriceSelectors();
    const priceElement = findFirstMetElement($, possiblePriceSelectors);

    if (priceElement === undefined) {
        return undefined;
    }

    const price = extractTextPrice(priceElement);
    const priceParsed = parsePrice(price);

    return { price, priceParsed };
}

function getPossiblePriceSelectors() {
    return [
        '#priceblock_ourprice',
        '#priceblock_saleprice'
    ];
}

function findFirstMetElement($, possibleSelectors) {
    for (let index = 0; index < possibleSelectors.length; index++) {
        const selector = possibleSelectors[index];
        const element = $(selector);

        if (element.length !== 0) {
            return element;
        }
    }

    return undefined;
}

function extractTextPrice(priceElement) {
    const prices = priceElement.text().split('-');
    const firstPrice = prices[0].trim();
    return firstPrice;
}

function extractTitle($) {
    const titleElement = $('#productTitle');
    return titleElement.length !== 0 ? titleElement.text().trim() : null;
}

async function parseItemDetail($, request, requestQueue, getReviews) {
    const { sellerUrl, asin, detailUrl, reviewsUrl, delivery } = request.userData;
    const item = {};
    const reviewsConunt = $('#acrCustomerReviewText').length !== 0 ? $('#acrCustomerReviewText').eq(0).text() : null;
    const stars = $('.reviewCountTextLinkedHistogram').length !== 0 ? $('.reviewCountTextLinkedHistogram').attr('title').match(/(\d+\.\d+)|\d+/)[0] : null;
    const details = {};
    const breadCrumbs = $('#wayfinding-breadcrumbs_feature_div').text().trim().split('\n')
        .filter(el => el.trim() != '')
        .map(el => el.trim()).join('')
    $('table.prodDetTable tr').each(function () {
        if ($(this).find('th').text().trim() !== '') {
            details[$(this).find('th').text().trim()] = $(this).find('td').text().trim();
        }
    });

    // console.log($('#nav-global-location-slot').text().trim());
    if ($('.DElocale table').length !== 0) {
        $('.DElocale table tr').each(function () {
            if ($(this).find('td').eq(0).text()
                .trim() !== '') {
                details[$(this).find('td').eq(0).text()
                    .trim()] = $(this).find('td').eq(1).text()
                    .trim();
            }
        });
    }
    // if (getReviews) {
    //     item.reviews = await parseItemReviews($, request, requestQueue);
    // }
    item.InStock = $('#availability') ? true: false;
    item.delivery = $('#delivery-message').text().trim();
    item.featureDesc = $('#featurebullets_feature_div').length !== 0 ? $('#featurebullets_feature_div').text().trim() : null;
    item.desc = $('#productDescription').length !== 0 ? $('#productDescription').text().trim() : null;
    item.breadCrumbs = breadCrumbs;
    item.NumberOfQuestions = $('#askATFLink').text().trim().match(/\d+/) ? parseInt($('#askATFLink').text().trim().match(/\d+/).shift()) : 0;
    item.reviewsCount = reviewsConunt;
    item.stars = stars;
    item.details = details;
    item.images = [];
    if ($('script:contains("ImageBlockATF")').length !== 0) {
        const scriptText = $('script:contains("ImageBlockATF")').html();
        if (scriptText.indexOf("'colorImages':").length !== 0
            && scriptText.indexOf("'colorToAsin'").length !== 0
            && scriptText.indexOf("'initial': ").length !== 0) {

            let textParse = scriptText.split("'colorImages':")[1]
            textParse = textParse ? textParse.split("'colorToAsin'")[0].trim().replace("'initial': ", '').replace(/(},$|^{)/g, '') : textParse;
            textParse = textParse ? textParse : "[]";

            const parsedImageArray = JSON.parse(textParse);
            for (const image of parsedImageArray) {
                if (image.hiRes && image.hiRes !== null) {
                    item.images.push(image.hiRes);
                } else if (image.large && image.large !== null) {
                    item.images.push(image.large);
                } else {
                    log.info(`Bad image, report to github, please (debug info item url: ${request.url})`);
                }
            }
        }
    }

    const priceInfo = extractPriceInfo($);
    item.price = priceInfo ? priceInfo.price : undefined;
    item.priceParsed = priceInfo ? priceInfo.priceParsed : undefined;

    const title = extractTitle($);

    // NOTE: Wrapped to repeat the end result of other parsing
    // because other parsing is commented.
    itemInfo = {
        title,
        asin,
        detailUrl,
        sellerUrl,
        itemDetail: item
    };

    if (itemInfo.title === null) {
        itemInfo.status = 'This ASIN is not available for this country.';
    }

    return itemInfo;

    // NOTE: Commented because not necessary
    /*if (getReviews) {
        await requestQueue.addRequest({
            url: reviewsUrl,
            userData: {
                asin,
                detailUrl,
                sellerUrl,
                itemDetail: item,
                label: 'reviews',
            },
        }, { forefront: true });
    } else {
        await requestQueue.addRequest({
            url: sellerUrl,
            userData: {
                asin,
                detailUrl,
                sellerUrl,
                itemDetail: item,
                label: 'seller',
            },
        }, { forefront: true });
    }*/
}

module.exports = parseItemDetail;
