/**
 * Vercel Serverless API - Fetch Lithium Prices
 * 
 * Returns prices with futures already converted to USD
 */

// Current prices - Update these with data from SMM and GFEX
// LAST_SCRAPE_DATE: 2026-01-23
const CURRENT_PRICES = {
    carbonate: {
        id: 'carbonate',
        name: 'LITHIUM CARBONATE',
        grade: '99.5%',
        price: 24502.78   // SMM Spot USD (VAT included)
        priceCNY: 164500,  // SMM Spot CNY (Original)
        changeCNY: 6000,   // +6,000
        changeUSD: 936.11 // +859.57
        changePercent: 3.97 // +3.79%
        unit: 'USD/T',
    },
    spodumene: {
        id: 'spodumene',
        name: 'SPODUMENE CONCENTRATE',
        grade: '6.0%',
        price: 2130,
        changeUSD: 95,     // Index Jan 22
        changePercent: 4.67, // Calculated
        unit: 'USD/T',
        spotOnly: true,
    },
    futures: [
        { contract: 'LC2602', month: 'Feb-26', priceCNY: 179640 },
        { contract: 'LC2603', month: 'Mar-26', priceCNY: 180580 },
        { contract: 'LC2604', month: 'Apr-26', priceCNY: 181680 },
        { contract: 'LC2605', month: 'May-26', priceCNY: 181520 },
        { contract: 'LC2606', month: 'Jun-26', priceCNY: 181920 },
        { contract: 'LC2607', month: 'Jul-26', priceCNY: 182640 },
        { contract: 'LC2608', month: 'Aug-26', priceCNY: 182300 },
        { contract: 'LC2609', month: 'Sep-26', priceCNY: 183380 },
        { contract: 'LC2610', month: 'Oct-26', priceCNY: 183460 },
        { contract: 'LC2611', month: 'Nov-26', priceCNY: 184140 },
        { contract: 'LC2612', month: 'Dec-26', priceCNY: 183600 },
        { contract: 'LC2701', month: 'Jan-27', priceCNY: 181800 },
    ],
};

// Historical data for change calculations (Jan 21 Baseline - Official Settlements)
const HISTORY = {
    date: '2026-01-22',
    carbonate: { price: 23566.66 },
    spodumene: { price: 2130 },
    futures: [
        { contract: 'LC2602', priceCNY: 166500 },
        { contract: 'LC2603', priceCNY: 167460 },
        { contract: 'LC2604', priceCNY: 168620 },
        { contract: 'LC2605', priceCNY: 168780 },
        { contract: 'LC2606', priceCNY: 168660 },
        { contract: 'LC2607', priceCNY: 169780 },
        { contract: 'LC2608', priceCNY: 170360 },
        { contract: 'LC2609', priceCNY: 170120 },
        { contract: 'LC2610', priceCNY: 170320 },
        { contract: 'LC2611', priceCNY: 171420 },
        { contract: 'LC2612', priceCNY: 172000 },
        { contract: 'LC2701', priceCNY: 170260 },
        { contract: 'LC2602', priceCNY: 164160 },
        { contract: 'LC2603', priceCNY: 163540 },
        { contract: 'LC2604', priceCNY: 164980 },
        { contract: 'LC2605', priceCNY: 164580 },
        { contract: 'LC2606', priceCNY: 164960 },
        { contract: 'LC2607', priceCNY: 165200 },
        { contract: 'LC2608', priceCNY: 165740 },
        { contract: 'LC2609', priceCNY: 166080 },
        { contract: 'LC2610', priceCNY: 166280 },
        { contract: 'LC2611', priceCNY: 167500 },
        { contract: 'LC2612', priceCNY: 167440 },
        { contract: 'LC2701', priceCNY: 168520 },
    ]
};

function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

function calculateConversionRate(carbonate) {
    if (!carbonate.price || !carbonate.priceCNY) return 6.98;
    return carbonate.priceCNY / carbonate.price;
}

function calculateChange(current, previous) {
    if (!previous || previous === 0) return null;
    return ((current - previous) / previous) * 100;
}

function buildResponse(prices, history) {
    const conversionRate = calculateConversionRate(prices.carbonate);

    // Calculate variations strictly against HISTORY
    const carbChangeVal = history.carbonate?.price ? prices.carbonate.price - history.carbonate.price : prices.carbonate.changeUSD;
    const carbChangePct = history.carbonate?.price ? calculateChange(prices.carbonate.price, history.carbonate.price) : prices.carbonate.changePercent;

    const spodChangeVal = history.spodumene?.price ? prices.spodumene.price - history.spodumene.price : prices.spodumene.changeUSD;
    const spodChangePct = history.spodumene?.price ? calculateChange(prices.spodumene.price, history.spodumene.price) : prices.spodumene.changePercent;

    // Build history map for futures
    const historyFuturesMap = new Map(
        (history?.futures || []).map(f => [f.contract, f.priceCNY])
    );

    // Convert futures to USD and calculate changes
    const futuresUSD = prices.futures.map(f => {
        const priceUSD = Math.round(f.priceCNY / conversionRate);
        const historyPriceCNY = historyFuturesMap.get(f.contract);
        const changePercent = historyPriceCNY
            ? calculateChange(f.priceCNY, historyPriceCNY)
            : null;

        return {
            contract: f.contract,
            month: f.month,
            priceCNY: f.priceCNY,
            price: priceUSD,
            change: changePercent !== null ? Math.round(changePercent * 100) / 100 : null,
        };
    });

    return {
        carbonate: {
            ...prices.carbonate,
            change: Math.round(carbChangeVal * 100) / 100,
            changePercent: Math.round(carbChangePct * 100) / 100,
        },
        spodumene: {
            ...prices.spodumene,
            change: Math.round(spodChangeVal * 100) / 100,
            changePercent: Math.round(spodChangePct * 100) / 100,
        },
        futures: futuresUSD,
        conversionRate: Math.round(conversionRate * 10000) / 10000,
        lastUpdated: new Date().toISOString(),
        historyDate: history?.date || null,
    };
}

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const response = buildResponse(CURRENT_PRICES, HISTORY);
    return res.status(200).json(response);
}
