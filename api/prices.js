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
        price: 22703.83,   // SMM Spot USD (VAT included)
        priceCNY: 158500,  // SMM Spot CNY (Original)
        changeCNY: 6000,   // +6,000
        changeUSD: 859.45, // +859.45
        changePercent: 3.93, // +3.93%
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
    // GFEX Lithium Carbonate Futures - Futures Prices in CNY
    futures: [
        { contract: 'LC2602', month: 'Feb-26', priceCNY: 165080 },
        { contract: 'LC2603', month: 'Mar-26', priceCNY: 165600 },
        { contract: 'LC2604', month: 'Apr-26', priceCNY: 166400 },
        { contract: 'LC2605', month: 'May-26', priceCNY: 166740 },
        { contract: 'LC2606', month: 'Jun-26', priceCNY: 167200 },
        { contract: 'LC2607', month: 'Jul-26', priceCNY: 167360 },
        { contract: 'LC2608', month: 'Aug-26', priceCNY: 167940 },
        { contract: 'LC2609', month: 'Sep-26', priceCNY: 168320 },
        { contract: 'LC2610', month: 'Oct-26', priceCNY: 169280 },
        { contract: 'LC2611', month: 'Nov-26', priceCNY: 169980 },
        { contract: 'LC2612', month: 'Dec-26', priceCNY: 169980 },
        { contract: 'LC2701', month: 'Jan-27', priceCNY: 170000 },
    ],
};

// In-memory history storage
let priceHistory = null;

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
    // Use explicit changePercent if available (scraped), otherwise calculate
    let carbonateChange = prices.carbonate.changeUSD;
    let carbonateChangePercent = prices.carbonate.changePercent;

    if (carbonateChangePercent === undefined) {
        if (hasValidHistory && history.carbonate?.price) {
            carbonateChange = prices.carbonate.price - history.carbonate.price;
            carbonateChangePercent = calculateChange(prices.carbonate.price, history.carbonate.price);
        } else if (prices.carbonate.changeCNY) {
            // Fallback: estimate percent from CNY change
            const prevCNY = prices.carbonate.priceCNY - prices.carbonate.changeCNY;
            carbonateChangePercent = (prices.carbonate.changeCNY / prevCNY) * 100;
            carbonateChange = prices.carbonate.changeCNY / conversionRate;
        }
    }

    // Calculate spodumene changes
    let spodumeneChange = prices.spodumene.changeUSD;
    let spodumeneChangePercent = prices.spodumene.changePercent; // If added later

    if (spodumeneChangePercent === undefined) {
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
        const changePercent = hasValidHistory && historyPriceCNY
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
