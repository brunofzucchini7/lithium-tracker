// SMM Lithium Price Data - Fetched from API
// Uses /api/prices endpoint on Vercel, falls back to static JSON locally

// Determine API URL based on environment
const API_URL = import.meta.env.PROD
    ? '/api/prices'
    : '/prices.json'; // Use static file in development

/**
 * Fetch prices from API or static file
 */
export async function fetchPricesFromAPI() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching prices:', error);
        return getDefaultData();
    }
}

/**
 * Save history (call API to store today's prices)
 * Only works in production with the API
 */
export async function saveHistoryToAPI() {
    if (!import.meta.env.PROD) {
        console.log('History save only available in production');
        return false;
    }

    try {
        const response = await fetch('/api/prices?action=save-history', {
            method: 'POST',
        });
        const result = await response.json();
        return result.success;
    } catch (error) {
        console.error('Error saving history:', error);
        return false;
    }
}

/**
 * Get spot prices from data
 */
export function getSpotPrices(data) {
    return {
        carbonate: data.carbonate,
        spodumene: data.spodumene,
    };
}

/**
 * Get conversion rate
 */
export function getConversionRate(data) {
    return data.conversionRate || 7.25;
}

/**
 * Check if a contract has expired
 */
export function isContractExpired(contractCode) {
    const year = 2000 + parseInt(contractCode.substring(2, 4));
    const month = parseInt(contractCode.substring(4, 6));

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    if (year < currentYear) return true;
    if (year === currentYear && month < currentMonth) return true;

    return false;
}

/**
 * Get active contracts
 */
export function getActiveContracts(futures) {
    return futures.filter(c => !isContractExpired(c.contract));
}

/**
 * Convert futures prices to USD
 */
export function getFuturesContractsUSD(data) {
    const conversionRate = getConversionRate(data);
    const spotUSD = data.carbonate.price;
    const activeContracts = getActiveContracts(data.futures || []);

    return [
        {
            contract: 'Spot',
            month: 'Today',
            price: spotUSD,
            change: data.carbonate.changePercent,
            type: 'SMM PHYSICAL SPOT',
            isSpot: true
        },
        ...activeContracts.map(f => ({
            contract: f.contract,
            month: f.month,
            price: Math.round(f.priceCNY / conversionRate),
            change: f.change,
            type: 'GFEX DERIVATIVE',
            isSpot: false,
        }))
    ];
}

/**
 * Get chart data
 */
export function getChartData(data) {
    const contracts = getFuturesContractsUSD(data);
    return contracts.map(c => ({
        label: c.month,
        price: c.price,
        isSpot: c.isSpot,
    }));
}

/**
 * Format last updated
 */
export function formatLastUpdated(isoString) {
    if (!isoString) return 'Not available';
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * Default data fallback
 */
function getDefaultData() {
    return {
        carbonate: {
            id: 'carbonate',
            name: 'LITHIUM CARBONATE',
            grade: '99.5%',
            price: 22704,
            priceCNY: 164700,
            change: null,
            changePercent: null,
            unit: 'USD/T',
        },
        spodumene: {
            id: 'spodumene',
            name: 'SPODUMENE CONCENTRATE',
            grade: '6.0%',
            price: 2035,
            change: null,
            changePercent: null,
            unit: 'USD/T',
            spotOnly: true,
        },
        futures: [
            { contract: 'LC2602', month: 'Feb-26', priceCNY: 165080, change: null },
            { contract: 'LC2603', month: 'Mar-26', priceCNY: 165600, change: null },
            { contract: 'LC2604', month: 'Apr-26', priceCNY: 164900, change: null },
            { contract: 'LC2605', month: 'May-26', priceCNY: 164460, change: null },
            { contract: 'LC2606', month: 'Jun-26', priceCNY: 166120, change: null },
            { contract: 'LC2607', month: 'Jul-26', priceCNY: 165020, change: null },
            { contract: 'LC2608', month: 'Aug-26', priceCNY: 165500, change: null },
            { contract: 'LC2609', month: 'Sep-26', priceCNY: 168320, change: null },
            { contract: 'LC2610', month: 'Oct-26', priceCNY: 166260, change: null },
            { contract: 'LC2611', month: 'Nov-26', priceCNY: 166480, change: null },
            { contract: 'LC2612', month: 'Dec-26', priceCNY: 167000, change: null },
            { contract: 'LC2701', month: 'Jan-27', priceCNY: 167500, change: null },
        ],
        conversionRate: 7.2543,
        lastUpdated: new Date().toISOString(),
    };
}

// Export default data for initial render
export const defaultData = getDefaultData();
