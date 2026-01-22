/**
 * Vercel Serverless API - Fetch Lithium Prices
 * 
 * Returns prices with futures already converted to USD
 */

// Current prices - Update these with data from SMM and GFEX
// Last Updated: Based on User Screenshots (Jan 21, 2026)
const CURRENT_PRICES = {
    carbonate: {
        id: 'carbonate',
        name: 'LITHIUM CARBONATE',
        grade: '99.5%',
        price: 23617.8   // SMM Spot USD (VAT included)
        priceCNY: 164500,  // SMM Spot CNY (Original)
        changeCNY: 6000,   // +6,000
        changeUSD: 751.39 // +859.57
        changePercent: 3.29 // +3.79%
        unit: 'USD/T',
    },
    spodumene: {
        id: 'spodumene',
        name: 'SPODUMENE CONCENTRATE',
        grade: '6.0%',
        price: 2130,
        changeUSD: 95,     // Index Jan 22
        changePercent: 4.67, // (95 / (2130 - 95)) * 100
        unit: 'USD/T',
        spotOnly: true,
    },
    // GFEX Lithium Carbonate Futures - Futures Prices in CNY
    futures: [
        { contract: 'LC2602', month: 'Feb-26', priceCNY: 166500 },
        { contract: 'LC2603', month: 'Mar-26', priceCNY: 167460 },
        { contract: 'LC2604', month: 'Apr-26', priceCNY: 168620 },
        { contract: 'LC2605', month: 'May-26', priceCNY: 168780 },
        { contract: 'LC2606', month: 'Jun-26', priceCNY: 168660 },
        { contract: 'LC2607', month: 'Jul-26', priceCNY: 169780 },
        { contract: 'LC2608', month: 'Aug-26', priceCNY: 170360 },
        { contract: 'LC2609', month: 'Sep-26', priceCNY: 170120 },
        { contract: 'LC2610', month: 'Oct-26', priceCNY: 170320 },
        { contract: 'LC2611', month: 'Nov-26', priceCNY: 171420 },
        { contract: 'LC2612', month: 'Dec-26', priceCNY: 172000 },
        { contract: 'LC2701', month: 'Jan-27', priceCNY: 170260 },
    ],
};

// Historical data for change calculations (Updated automatically by scraper)
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
    const today = getTodayDate();
    const hasValidHistory = history && history.date !== today;
    const conversionRate = calculateConversionRate(prices.carbonate);

    // Calculate carbonate changes
    let carbonateChange = prices.carbonate.changeUSD;
    let carbonateChangePercent = prices.carbonate.changePercent;

    if (carbonateChangePercent === undefined || carbonateChangePercent === null) {
        if (hasValidHistory && history.carbonate?.price) {
            carbonateChange = prices.carbonate.price - history.carbonate.price;
            carbonateChangePercent = calculateChange(prices.carbonate.price, history.carbonate.price);
        }
    }

    // Calculate spodumene changes
    let spodumeneChange = prices.spodumene.changeUSD;
    let spodumeneChangePercent = prices.spodumene.changePercent;

    if (spodumeneChangePercent === undefined || spodumeneChangePercent === null) {
        if (hasValidHistory && history.spodumene?.price) {
            spodumeneChange = prices.spodumene.price - history.spodumene.price;
            spodumeneChangePercent = calculateChange(prices.spodumene.price, history.spodumene.price);
        }
    }

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
            change: carbonateChange !== undefined ? Math.round(carbonateChange * 100) / 100 : null,
            changePercent: carbonateChangePercent !== undefined ? Math.round(carbonateChangePercent * 100) / 100 : null,
        },
        spodumene: {
            ...prices.spodumene,
            change: spodumeneChange !== undefined ? Math.round(spodumeneChange * 100) / 100 : null,
            changePercent: spodumeneChangePercent !== undefined ? Math.round(spodumeneChangePercent * 100) / 100 : null,
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
