/**
 * Vercel Serverless API - Fetch Lithium Prices
 * 
 * This API endpoint is called by the frontend to get live prices.
 * It stores history in Vercel KV or Edge Config (or falls back to in-memory for demo)
 */

// Current prices - Update these with latest GFEX data
// In production, you would scrape these from SMM or use their API
const CURRENT_PRICES = {
    carbonate: {
        id: 'carbonate',
        name: 'LITHIUM CARBONATE',
        grade: '99.5%',
        price: 22704,
        priceCNY: 164700,
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
    // GFEX Lithium Carbonate Futures - Latest prices (Jan 21, 2026)
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

// In-memory history storage (resets on cold start)
// For persistent storage, use Vercel KV or a database
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

function buildPricesWithChanges(prices, history) {
    const today = getTodayDate();
    const hasValidHistory = history && history.date !== today;

    // Calculate carbonate changes
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

    // Build history map for futures
    const historyFuturesMap = new Map(
        (history?.futures || []).map(f => [f.contract, f.priceCNY])
    );

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
        futures: prices.futures.map(f => {
            const historyPrice = historyFuturesMap.get(f.contract);
            const changePercent = hasValidHistory ? calculateChange(f.priceCNY, historyPrice) : null;
            return {
                ...f,
                change: changePercent !== null ? Math.round(changePercent * 100) / 100 : null,
            };
        }),
        conversionRate: calculateConversionRate(prices.carbonate),
        lastUpdated: new Date().toISOString(),
        historyDate: history?.date || null,
    };
}

export default function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // POST request to save history (called once daily)
    if (req.method === 'POST' && req.query.action === 'save-history') {
        priceHistory = {
            date: getTodayDate(),
            savedAt: new Date().toISOString(),
            carbonate: {
                price: CURRENT_PRICES.carbonate.price,
                priceCNY: CURRENT_PRICES.carbonate.priceCNY,
            },
            spodumene: {
                price: CURRENT_PRICES.spodumene.price,
            },
            futures: CURRENT_PRICES.futures.map(f => ({
                contract: f.contract,
                priceCNY: f.priceCNY,
            })),
        };
        return res.status(200).json({ success: true, date: priceHistory.date });
    }

    // GET request - return prices with changes
    const prices = buildPricesWithChanges(CURRENT_PRICES, priceHistory);

    return res.status(200).json(prices);
}
