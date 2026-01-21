/**
 * SMM Price Fetcher using Puppeteer
 * 
 * Scrapes real-time data from metal.com using a headless browser.
 * This is robust against client-side rendering.
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

        // Set a real user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log(`📡 Navigating to ${SMM_URL}...`);
        await page.goto(SMM_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        console.log('Waiting for price tables...');
        await page.waitForSelector('table', { timeout: 10000 }).catch(() => console.log('Timeout waiting for table'));

        // Extract Data
        const data = await page.evaluate(() => {
            const result = {
                carbonatePrice: null,
                carbonatePriceCNY: null,
                spodumenePrice: null,
                futures: []
            };

            // Helper to find text in rows
            const rows = Array.from(document.querySelectorAll('tr'));

            rows.forEach(row => {
                const text = row.innerText.toLowerCase();

                // 1. Spot Lithium Carbonate
                if (text.includes('lithium carbonate') && text.includes('99.5')) {
                    const cells = Array.from(row.querySelectorAll('td'));
                    // Usually Price is in 2nd or 3rd column
                    // We look for numbers > 1000
                    const values = cells.map(c => parseFloat(c.innerText.replace(/,/g, ''))).filter(v => !isNaN(v) && v > 1000);

                    // Heuristic: CNY is usually ~100k+, USD is ~15k+
                    values.forEach(v => {
                        if (v > 100000) result.carbonatePriceCNY = v;
                        else if (v > 10000 && v < 50000) result.carbonatePrice = v;
                    });
                }

                // 2. GFEX Futures (LC contracts)
                // Look for pattern LC26xx or LC27xx
                if (text.match(/lc2\d{3}/)) {
                    const cells = Array.from(row.querySelectorAll('td'));
                    const contractCode = cells[0]?.innerText.trim(); // First cell is usually contract code
                    // Price is usually next
                    const price = parseFloat(cells[1]?.innerText.replace(/,/g, ''));

                    if (contractCode && !isNaN(price)) {
                        result.futures.push({
                            contract: contractCode,
                            priceCNY: price
                        });
                    }
                }
            });

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

    if (data.carbonatePriceCNY) {
        console.log(`Updating Carbonate CNY: ${data.carbonatePriceCNY}`);
        content = content.replace(/priceCNY:\s*\d+/, `priceCNY: ${data.carbonatePriceCNY}`);
        updated = true;
    }

    if (data.carbonatePrice) {
        console.log(`Updating Carbonate USD: ${data.carbonatePrice}`);
        content = content.replace(/price:\s*\d+/, `price: ${data.carbonatePrice}`);
        updated = true;
    }

    // Update Futures
    // This is tricky with regex, so we'll do a simple replacement for specific known contracts
    // or regenerate the whole futures block if needed.
    // For now, let's update specific contracts if found
    if (data.futures && data.futures.length > 0) {
        data.futures.forEach(f => {
            const regex = new RegExp(`contract:\\s*'${f.contract}',\\s*month:\\s*'[^']+',\\s*priceCNY:\\s*\\d+`);
            if (regex.test(content)) {
                // We found the line, but we need to keep the month.
                // Let's Replace just the price part for that contract
                // Find: { contract: 'LC2602', ... priceCNY: 123456 }
                // We assume consistent formatting from our file
                const updateRegex = new RegExp(`(contract:\\s*'${f.contract}'.*?priceCNY:\\s*)(\\d+)`, 's');
                if (updateRegex.test(content)) {
                    content = content.replace(updateRegex, `$1${f.priceCNY}`);
                    console.log(`Updated ${f.contract} to ${f.priceCNY}`);
                    updated = true;
                }
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
