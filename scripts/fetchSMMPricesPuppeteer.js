/**
 * SMM Price Fetcher using Puppeteer
 * 
 * Scrapes real-time data from metal.com using a headless browser.
 * Extracts USD/CNY prices AND daily changes.
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

        console.log('Waiting for price tables...');
        await page.waitForSelector('table', { timeout: 10000 }).catch(() => console.log('Timeout waiting for table'));

        // Extract Data
        const data = await page.evaluate(() => {
            const result = {
                carbonate: { price: null, priceCNY: null, changeCNY: 0 },
                spodumene: { price: null, changeUSD: 0 },
                futures: []
            };

            const rows = Array.from(document.querySelectorAll('tr'));

            rows.forEach(row => {
                const text = row.innerText.toLowerCase();

                // 1. Spot Lithium Carbonate
                if (text.includes('lithium carbonate') && text.includes('99.5')) {
                    const cells = Array.from(row.querySelectorAll('td'));

                    // Helper to clean and parse number
                    const parseVal = (txt) => {
                        const clean = txt.replace(/,/g, '').trim();
                        // Handle negative numbers or signs
                        return parseFloat(clean);
                    };

                    // Find values in the row cells
                    // Usually: [Name, Price, Change, ...]
                    let foundCNY = false;
                    let foundUSD = false;

                    cells.forEach(cell => {
                        const val = parseVal(cell.innerText);
                        if (!isNaN(val)) {
                            // Determine if it's Price or Change based on magnitude
                            if (Math.abs(val) > 100000) {
                                // Must be CNY Price
                                result.carbonate.priceCNY = val;
                                foundCNY = true;
                            } else if (Math.abs(val) > 10000 && Math.abs(val) < 60000) {
                                // Must be USD Price (or maybe price per KG? but SMM usually MT)
                                result.carbonate.price = val;
                                foundUSD = true;
                            } else if (Math.abs(val) < 5000 && foundCNY && !foundUSD) {
                                // If we found CNY but not USD yet, this small num might be ANY Change
                                // But usually change follows price immediately
                                // Let's assume this is CNY Change
                                result.carbonate.changeCNY = val;
                            }
                        }
                    });
                }

                // 2. GFEX Futures (LC contracts)
                if (text.match(/lc2\d{3}/)) {
                    const cells = Array.from(row.querySelectorAll('td'));
                    const contractCode = cells[0]?.innerText.trim();
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

    // Update Carbonate CNY Price
    if (data.carbonate.priceCNY) {
        content = content.replace(/priceCNY:\s*\d+/, `priceCNY: ${data.carbonate.priceCNY}`);
        updated = true;
    }

    // Update Carbonate USD Price 
    if (data.carbonate.price) {
        content = content.replace(/price:\s*\d+/, `price: ${data.carbonate.price}`);
        updated = true;
    }

    // Update Carbonate Change CNY
    if (data.carbonate.changeCNY !== undefined) {
        content = content.replace(/changeCNY:\s*-?\d+/, `changeCNY: ${data.carbonate.changeCNY}`);
        updated = true;
    }

    // Update Futures
    if (data.futures && data.futures.length > 0) {
        data.futures.forEach(f => {
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
