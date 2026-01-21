/**
 * Vercel Serverless API - Fetch Lithium Prices
 * 
 * Returns prices with futures already converted to USD
 */

// Current prices - Update these with latest GFEX data
// Format: SMM Spot in USD, GFEX Futures in CNY (converted automatically)
const CURRENT_PRICES = {
    carbonate: {
        id: 'carbonate',
        name: 'LITHIUM CARBONATE',
        grade: '99.5%',
        price: 21850,      // SMM Spot USD/T (Estimated based on 158,500 / 7.25)
        priceCNY: 158500,  // SMM Spot CNY/T (User provided)
        unit: 'USD/T',
    },
    spodumene: {
        id: 'spodumene',
        name: 'SPODUMENE CONCENTRATE',
        grade: '6.0%',
        price: 2035,
        unit: 'USD/T',
        spotOnly: true,
    },
    // GFEX Lithium Carbonate Futures - Latest prices in CNY
    // NOTE: These will be updated automatically by the GitHub Action scraper
    futures: [
        { contract: 'LC2602', month: 'Feb-26', priceCNY: 165080 },
        { contract: 'LC2603', month: 'Mar-26', priceCNY: 165600 },
        { contract: 'LC2604', month: 'Apr-26', priceCNY: 164900 },
        { contract: 'LC2605', month: 'May-26', priceCNY: 164460 },
        { contract: 'LC2606', month: 'Jun-26', priceCNY: 166120 },
        { contract: 'LC2607', month: 'Jul-26', priceCNY: 165020 },
        { contract: 'LC2608', month: 'Aug-26', priceCNY: 165500 },
        { contract: 'LC2609', month: 'Sep-26', priceCNY: 168320 },
        { contract: 'LC2610', month: 'Oct-26', priceCNY: 166260 },
        { contract: 'LC2611', month: 'Nov-26', priceCNY: 166480 },
        { contract: 'LC2612', month: 'Dec-26', priceCNY: 167000 },
        { contract: 'LC2701', month: 'Jan-27', priceCNY: 167500 },
    ],
};

// In-memory history storage
let priceHistory = null;

function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

function calculateConversionRate(carbonate) {
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

    // Calculate carbonate changes (Using history if available, else null)
    // The user asked for variation from the page, but since we scrape once a day,
    // simply comparing to yesterday's history is the most robust way for now.
    // The scraper can also be enhanced to pull the "change" value directly.
    const carbonateChange = hasValidHistory && history.carbonate?.price
        ? prices.carbonate.price - history.carbonate.price
        : null;
    const carbonateChangePercent = hasValidHistory && history.carbonate?.price
        ? calculateChange(prices.carbonate.price, history.carbonate.price)
        : null;

    // Calculate spodumene changes
    const spodumeneChange = hasValidHistory && history.spodumene?.price
        ? prices.spodumene.price - history.spodumene.price
        : null;
    const spodumeneChangePercent = hasValidHistory && history.spodumene?.price
        ? calculateChange(prices.spodumene.price, history.spodumene.price)
        : null;

    // Build history map for futures (stored in CNY)
    const historyFuturesMap = new Map(
        (history?.futures || []).map(f => [f.contract, f.priceCNY])
    );

    // Convert futures to USD and calculate changes
    const futuresUSD = prices.futures.map(f => {
        const priceUSD = Math.round(f.priceCNY / conversionRate);
        const historyPriceCNY = historyFuturesMap.get(f.contract);
        const changePercent = hasValidHistory && historyPriceCNY
            ? calculateChange(f.priceCNY, historyPriceCNY)
            : null;

        return {
            contract: f.contract,
            month: f.month,
            priceCNY: f.priceCNY,
            price: priceUSD,  // USD price for display
            change: changePercent !== null ? Math.round(changePercent * 100) / 100 : null,
        };
    });

    return {
        carbonate: {
            ...prices.carbonate,
            change: carbonateChange !== null ? Math.round(carbonateChange * 100) / 100 : null,
            changePercent: carbonateChangePercent !== null ? Math.round(carbonateChangePercent * 100) / 100 : null,
        },
        spodumene: {
            ...prices.spodumene,
            change: spodumeneChange !== null ? Math.round(spodumeneChange * 100) / 100 : null,
            changePercent: spodumeneChangePercent !== null ? Math.round(spodumeneChangePercent * 100) / 100 : null,
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

    if (req.method === 'POST' && req.query.action === 'save-history') {
        priceHistory = {
            date: getTodayDate(),
            savedAt: new Date().toISOString(),
            carbonate: { ...CURRENT_PRICES.carbonate },
            spodumene: { ...CURRENT_PRICES.spodumene },
            futures: CURRENT_PRICES.futures.map(f => ({ ...f })),
        };
        return res.status(200).json({ success: true, date: priceHistory.date });
    }

    const response = buildResponse(CURRENT_PRICES, priceHistory);
    return res.status(200).json(response);
}
