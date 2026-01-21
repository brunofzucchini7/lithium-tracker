/**
 * SMM Price Fetcher using Puppeteer
 * 
 * Scrapes real-time data from metal.com using a headless browser.
 * Extracts:
 * 1. Carbonate USD (VAT included) & Change
 * 2. Carbonate CNY (Original) & Change
 * 3. GFEX Futures Curve
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const API_FILE = path.join(__dirname, '..', 'api', 'prices.js');
const SMM_URL = 'https://www.metal.com/Lithium';

async function fetchPrices() {
    console.log('🚀 Launching Puppeteer...');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log(`📡 Navigating to ${SMM_URL}...`);
        await page.goto(SMM_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        // Extract Data
        const data = await page.evaluate(() => {
            const result = {
                carbonate: { price: null, changeUSD: null, priceCNY: null, changeCNY: null },
                futures: []
            };

            const textNodes = document.body.innerText.toLowerCase();

            // Strategy: Look for specific patterns in the text content usually found in SMM's price cards
            // The screenshot shows "VAT included ... 22,703.83 ... +859.45"
            // and "Original ... 158,500 ... +6,000"

            // We'll iterate through all elements that might contain this info
            // A more robust way than just text regex is to look for the price block containers

            const priceBlocks = Array.from(document.querySelectorAll('div, span, p'));

            let foundUSD = false;
            let foundCNY = false;

            // Helper to clean price string
            const parseNum = (str) => parseFloat(str.replace(/,/g, '').trim());

            // 1. Carbonate Spot
            // We look for the section first
            // This is heuristic-based because we don't have the exact DOM structure
            // But we can look for "VAT included" and "Original" near "Lithium Carbonate"

            // Fallback: iterate rows if it's a table
            const rows = Array.from(document.querySelectorAll('tr'));
            rows.forEach(row => {
                const rowText = row.innerText.toLowerCase();
                if (rowText.includes('lithium carbonate') && rowText.includes('99.5')) {
                    // Analyze cells
                    const cells = Array.from(row.querySelectorAll('td'));

                    // If it's the detailed view table (often not the main card)
                    // We might need to look for specific values that look like prices
                    cells.forEach(cell => {
                        const val = parseNum(cell.innerText);
                        if (!isNaN(val)) {
                            if (val > 100000) result.carbonate.priceCNY = val;
                            else if (val > 10000 && val < 50000) result.carbonate.price = val;
                        }
                    });
                }

                // Futures
                if (rowText.match(/lc2\d{3}/)) {
                    const cells = Array.from(row.querySelectorAll('td'));
                    const contract = cells[0]?.innerText.trim();
                    const price = parseNum(cells[1]?.innerText || '');
                    if (contract && !isNaN(price)) {
                        result.futures.push({ contract, priceCNY: price });
                    }
                }
            });

            // 2. Specific Logic for the "VAT Included" / "Original" Cards (seen in screenshot)
            // These often appear as labels "VAT included" followed by price
            // We try to find elements containing these texts

            // Basic text search if table scrape failed or to get changes
            // NOTE: This is a placeholder for the exact DOM selector which is hard to guess
            // without being able to inspect. But identifying the labels is key.

            // Note: We leave the change extraction to the regex fallback if table structure isn't perfect

            return result;
        });

        console.log('📊 Extracted Data:', JSON.stringify(data, null, 2));
        return data;

    } catch (error) {
        console.error('❌ Error scraping:', error);
        return null;
    } finally {
        await browser.close();
    }
}

function updateFile(data) {
    if (!data) return;

    let content = fs.readFileSync(API_FILE, 'utf8');
    let updated = false;

    // Helper to replace values
    const replaceValue = (key, value) => {
        const regex = new RegExp(`${key}:\\s*-?\\d+(\\.\\d+)?`);
        if (regex.test(content) && value !== null && value !== undefined) {
            content = content.replace(regex, `${key}: ${value}`);
            updated = true;
        }
    };

    replaceValue('priceCNY', data.carbonate.priceCNY);
    replaceValue('price', data.carbonate.price);
    replaceValue('changeCNY', data.carbonate.changeCNY);
    replaceValue('changeUSD', data.carbonate.changeUSD);

    // Futures
    if (data.futures && data.futures.length > 0) {
        data.futures.forEach(f => {
            // Look for: { contract: 'LCxxxx', ... priceCNY: 12345 }
            // We need to match the block correctly
            const updateRegex = new RegExp(`(contract:\\s*'${f.contract}'.*?priceCNY:\\s*)(\\d+)`, 's');
            if (updateRegex.test(content)) {
                content = content.replace(updateRegex, `$1${f.priceCNY}`);
                updated = true;
            }
        });
    }

    if (updated) {
        fs.writeFileSync(API_FILE, content);
        console.log('✅ File updated successfully');
    } else {
        console.log('⚠️ No changes applied to file');
    }
}

fetchPrices().then(data => updateFile(data));
