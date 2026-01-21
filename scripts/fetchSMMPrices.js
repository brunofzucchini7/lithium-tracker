/**
 * SMM Price Fetcher for GitHub Actions
 * 
 * This script fetches the latest prices from SMM (Shanghai Metals Market)
 * and updates the api/prices.js file with new values.
 * 
 * Run: node scripts/fetchSMMPrices.js
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_FILE = path.join(__dirname, '..', 'api', 'prices.js');

// SMM URLs
const URLS = {
    lithium: 'https://www.metal.com/Lithium',
};

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
};

/**
 * Fetch prices from SMM website
 * Note: SMM uses JavaScript to render prices, so direct HTML scraping may not work.
 * This is a placeholder that should be enhanced with Puppeteer or an API.
 */
async function fetchSMMPrices() {
    console.log('📡 Fetching SMM prices...');

    try {
        const response = await axios.get(URLS.lithium, {
            headers: HEADERS,
            timeout: 30000
        });

        const $ = cheerio.load(response.data);

        // Try to extract prices from the page
        // Note: SMM loads data via JavaScript, so this may need adjustment
        let carbonatePrice = null;
        let carbonatePriceCNY = null;
        let spodumenePrice = null;

        // Look for price tables or data elements
        $('table tr').each((i, row) => {
            const text = $(row).text().toLowerCase();
            if (text.includes('lithium carbonate') && text.includes('99.5')) {
                const cells = $(row).find('td');
                cells.each((j, cell) => {
                    const cellText = $(cell).text().trim();
                    const price = parseFloat(cellText.replace(/[,$]/g, ''));
                    if (!isNaN(price) && price > 10000) {
                        if (!carbonatePrice) carbonatePrice = price;
                    }
                });
            }
        });

        console.log(`Found carbonatePrice: ${carbonatePrice || 'not found'}`);

        return {
            carbonatePrice,
            carbonatePriceCNY,
            spodumenePrice,
        };
    } catch (error) {
        console.error('Error fetching SMM:', error.message);
        return null;
    }
}

/**
 * Update the API file with new prices
 */
function updateAPIFile(prices) {
    if (!prices) {
        console.log('No prices to update');
        return false;
    }

    let content = fs.readFileSync(API_FILE, 'utf8');

    // Update prices in the file using regex
    if (prices.carbonatePrice) {
        content = content.replace(
            /price:\s*\d+,\s*\/\/\s*SMM Spot USD/,
            `price: ${prices.carbonatePrice},      // SMM Spot USD`
        );
    }

    if (prices.carbonatePriceCNY) {
        content = content.replace(
            /priceCNY:\s*\d+,\s*\/\/\s*SMM Spot CNY/,
            `priceCNY: ${prices.carbonatePriceCNY},  // SMM Spot CNY`
        );
    }

    fs.writeFileSync(API_FILE, content);
    console.log('✅ Updated api/prices.js');
    return true;
}

/**
 * Main function
 */
async function main() {
    console.log('🔄 SMM Price Update Script');
    console.log(`📅 ${new Date().toISOString()}`);
    console.log('');

    // For now, log a message about manual updates
    // SMM requires JavaScript rendering or API access
    console.log('⚠️  Note: SMM uses JavaScript to render prices.');
    console.log('    For full automation, consider:');
    console.log('    1. Using Puppeteer for browser-based scraping');
    console.log('    2. Subscribing to SMM API (~$1,599/year)');
    console.log('');

    // Attempt to fetch (may not work without JS rendering)
    const prices = await fetchSMMPrices();

    if (prices && (prices.carbonatePrice || prices.carbonatePriceCNY)) {
        updateAPIFile(prices);
    } else {
        console.log('ℹ️  No price updates found. Manual update may be required.');
        console.log('');
        console.log('To manually update prices:');
        console.log('1. Visit https://www.metal.com/Lithium');
        console.log('2. Find the latest Lithium Carbonate 99.5% price (USD and CNY)');
        console.log('3. Find GFEX futures latest prices');
        console.log('4. Update api/prices.js with new values');
        console.log('5. Push to GitHub: git add . && git commit -m "Update prices" && git push');
    }

    console.log('');
    console.log('✅ Script complete');
}

main();
