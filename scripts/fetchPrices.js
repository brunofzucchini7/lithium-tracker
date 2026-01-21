/**
 * SMM Price Fetcher with Historical Storage
 * 
 * - Fetches current prices and stores them
 * - Saves previous day prices at 8am for change calculation
 * - Calculates % changes automatically
 * 
 * Run daily: node scripts/fetchPrices.js
 * Schedule at 8am: Creates history snapshot for change calculation
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// File paths
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PRICES_PATH = path.join(PUBLIC_DIR, 'prices.json');
const HISTORY_PATH = path.join(PUBLIC_DIR, 'history.json');

// Headers for requests
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

/**
 * Load history file (previous day prices)
 */
function loadHistory() {
    try {
        if (fs.existsSync(HISTORY_PATH)) {
            return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
        }
    } catch (error) {
        console.warn('⚠️ Could not load history:', error.message);
    }
    return null;
}

/**
 * Save current prices as history (for next day's comparison)
 */
function saveHistory(prices) {
    const history = {
        date: new Date().toISOString().split('T')[0],
        savedAt: new Date().toISOString(),
        carbonate: {
            price: prices.carbonate?.price,
            priceCNY: prices.carbonate?.priceCNY,
        },
        spodumene: {
            price: prices.spodumene?.price,
        },
        futures: (prices.futures || []).map(f => ({
            contract: f.contract,
            priceCNY: f.priceCNY,
        })),
    };

    fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
    console.log(`📚 Saved history for ${history.date}`);
}

/**
 * Calculate % change from history
 */
function calculateChange(currentPrice, historyPrice) {
    if (!historyPrice || historyPrice === 0 || !currentPrice) {
        return null; // No data to calculate
    }
    return ((currentPrice - historyPrice) / historyPrice) * 100;
}

/**
 * Get current prices - Latest GFEX prices for January 21, 2026
 * Update these values daily with real SMM data
 */
function getSampleData() {
    return {
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
        // GFEX Lithium Carbonate Futures - Latest prices Jan 21, 2026
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
}

/**
 * Apply changes from history to current prices
 */
function applyChangesFromHistory(prices, history) {
    // Check if we have history from a previous day
    const today = new Date().toISOString().split('T')[0];

    if (!history || history.date === today) {
        // No history or history is from today (not useful for comparison)
        console.log('📊 No previous day data available - changes will show as N/A');

        // Set all changes to null (N/A)
        prices.carbonate.change = null;
        prices.carbonate.changePercent = null;
        prices.spodumene.change = null;
        prices.spodumene.changePercent = null;

        prices.futures = prices.futures.map(f => ({
            ...f,
            change: null,
        }));

        return prices;
    }

    console.log(`📊 Calculating changes from ${history.date}`);

    // Calculate carbonate change
    if (history.carbonate?.price) {
        const change = prices.carbonate.price - history.carbonate.price;
        const changePercent = calculateChange(prices.carbonate.price, history.carbonate.price);
        prices.carbonate.change = Math.round(change * 100) / 100;
        prices.carbonate.changePercent = Math.round(changePercent * 100) / 100;
        console.log(`  Carbonate: ${changePercent > 0 ? '+' : ''}${changePercent?.toFixed(2)}%`);
    }

    // Calculate spodumene change
    if (history.spodumene?.price) {
        const change = prices.spodumene.price - history.spodumene.price;
        const changePercent = calculateChange(prices.spodumene.price, history.spodumene.price);
        prices.spodumene.change = Math.round(change * 100) / 100;
        prices.spodumene.changePercent = Math.round(changePercent * 100) / 100;
        console.log(`  Spodumene: ${changePercent > 0 ? '+' : ''}${changePercent?.toFixed(2)}%`);
    }

    // Calculate futures changes
    const historyFuturesMap = new Map(
        (history.futures || []).map(f => [f.contract, f.priceCNY])
    );

    prices.futures = prices.futures.map(f => {
        const historyPrice = historyFuturesMap.get(f.contract);
        const changePercent = calculateChange(f.priceCNY, historyPrice);

        return {
            ...f,
            change: changePercent !== null ? Math.round(changePercent * 100) / 100 : null,
        };
    });

    return prices;
}

/**
 * Main function
 */
async function main() {
    console.log('🔄 Starting SMM price fetch...');
    console.log(`📅 Date: ${new Date().toLocaleString()}`);
    console.log('');

    // Ensure output directory exists
    if (!fs.existsSync(PUBLIC_DIR)) {
        fs.mkdirSync(PUBLIC_DIR, { recursive: true });
    }

    // Load history (previous day prices)
    const history = loadHistory();

    // Get current prices (using sample data for now)
    // TODO: Replace with actual scraping when SMM provides static HTML
    let prices = getSampleData();

    // Calculate conversion rate
    prices.conversionRate = prices.carbonate.priceCNY / prices.carbonate.price;

    // Apply changes from history
    prices = applyChangesFromHistory(prices, history);

    // Add metadata
    prices.lastUpdated = new Date().toISOString();
    prices.historyDate = history?.date || null;

    // Save current prices
    fs.writeFileSync(PRICES_PATH, JSON.stringify(prices, null, 2));
    console.log('');
    console.log(`💾 Saved prices to: ${PRICES_PATH}`);

    // Save as history for tomorrow's comparison
    // This should ideally run at 8am via task scheduler
    const hour = new Date().getHours();
    const shouldSaveHistory = process.argv.includes('--save-history') ||
        (hour >= 7 && hour <= 9); // Auto-save between 7-9am

    if (shouldSaveHistory) {
        saveHistory(prices);
    } else {
        console.log('💡 Run with --save-history flag to save today\'s prices as baseline');
    }

    console.log('');
    console.log('✅ Price fetch complete!');
}

// Run
main();
