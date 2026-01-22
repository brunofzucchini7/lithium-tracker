/**
 * SMM Price Fetcher using Puppeteer
 * 
 * Scrapes real-time data from metal.com using a headless browser.
 * Targeting specific "VAT included" (USD) and "Original" (CNY) prices.
 */

import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

        // Debug: Dump page content
        const pageText = await page.evaluate(() => document.body.innerText);
        fs.writeFileSync('debug_page.txt', pageText);
        console.log('📝 Saved page text to debug_page.txt');

        // Helper to parse numbers
        const parseNum = (str) => {
            if (!str) return null;
            const clean = str.replace(/[^\d.-]/g, '');
            return parseFloat(clean);
        };

        const result = {
            carbonate: { price: null, changeUSD: null, changePercent: null, priceCNY: null, changeCNY: null },
            spodumene: { price: null, changeUSD: null, changePercent: null },
            futures: []
        };

        // 1. Get initial text (Carbonate + Futures)
        let text = await page.evaluate(() => document.body.innerText);
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);

        // Parse Carbonate
        // Look for "Battery-Grade Lithium Carbonate"
        const carbIndex = lines.findIndex(l => l.includes('Battery-Grade Lithium Carbonate') && l.includes('USD/mt'));
        console.log(`🔍 Carbonate Index: ${carbIndex}`);

        if (carbIndex !== -1) {
            const price = parseNum(lines[carbIndex + 2]);
            const change = parseNum(lines[carbIndex + 3]);

            if (price) {
                // Heuristic: If price is around 20k, it's likely VAT excluded. 
                // We want VAT included (~23k). 1.13 multiplier for VAT in China.
                if (price < 22000) {
                    console.log('⚠️ Detected VAT excluded price, converting to VAT included...');
                    result.carbonate.price = Math.round(price * 1.13 * 100) / 100;
                    result.carbonate.changeUSD = Math.round(change * 1.13 * 100) / 100;
                } else {
                    result.carbonate.price = price;
                    result.carbonate.changeUSD = change;
                }

                if (result.carbonate.price && result.carbonate.changeUSD) {
                    const prev = result.carbonate.price - result.carbonate.changeUSD;
                    result.carbonate.changePercent = Math.round((result.carbonate.changeUSD / prev) * 100 * 100) / 100;
                }
            }
        }

        // Try to find CNY (Original) price
        const cnyIndex = lines.findIndex(l => l.includes('Battery-Grade Lithium Carbonate') && l.includes('CNY/mt'));
        if (cnyIndex !== -1) {
            result.carbonate.priceCNY = parseNum(lines[cnyIndex + 2]);
            result.carbonate.changeCNY = parseNum(lines[cnyIndex + 3]);
        }

        // Parse Futures
        // Look for LCxxxx (CNY/mt)
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(/(LC\d{4}) \(CNY\/mt\)/);
            if (match) {
                const contract = match[1];
                const priceCNY = parseNum(lines[i + 1]);
                if (contract && priceCNY) {
                    result.futures.push({ contract, priceCNY });
                }
            }
        }

        // 2. Click "Lithium Ore" to get Spodumene
        console.log('⛏️ Clicking "Lithium Ore" tab...');
        try {
            const buttons = await page.$x("//div[contains(text(), 'Lithium Ore')]");
            if (buttons.length > 0) {
                const button = buttons[0];
                await button.click();
                // Wait for content to change/load. 
                // We'll wait 2 seconds to be safe as networkidle might not trigger on simple tab switch
                await new Promise(r => setTimeout(r, 3000));

                // Get text again
                text = await page.evaluate(() => document.body.innerText);
                const oreLines = text.split('\n').map(l => l.trim()).filter(l => l);

                // Parse Spodumene
                // Look for "Spodumene Concentrate (6%, CIF China)" or similiar
                // "Spodumene Concentrate (USD/mt)" likely

                // Since I don't know the EXACT text, I'll search for "Spodumene"
                const spodIndex = oreLines.findIndex(l => l.includes('Spodumene Concentrate Index') && l.includes('USD/mt'));
                if (spodIndex !== -1) {
                    const price = parseNum(oreLines[spodIndex + 2]);
                    const change = parseNum(oreLines[spodIndex + 3]);
                    if (price) {
                        result.spodumene.price = price;
                        result.spodumene.changeUSD = change;
                        const prev = price - change;
                        result.spodumene.changePercent = Math.round((change / prev) * 100 * 100) / 100;
                    }
                } else {
                    console.log('⚠️ Spodumene section not found in text after click');
                }
            } else {
                console.log('⚠️ "Lithium Ore" tab not found');
            }
        } catch (e) {
            console.error('⚠️ Error clicking Lithium Ore:', e);
        }

        console.log('📊 Extracted Data:', JSON.stringify(result, null, 2));
        return result;

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

    const replaceInBlock = (blockName, key, value) => {
        // Find the block and the key specifically within it
        const blockRegex = new RegExp(`(${blockName}:\\s*\\{[^}]*?${key}:\\s*)([\\d,.-]+)`, 's');
        if (blockRegex.test(content) && value !== null && value !== undefined) {
            content = content.replace(blockRegex, `$1${value}`);
            updated = true;
        }
    };

    // Carbonate
    if (data.carbonate.price) replaceInBlock('carbonate', 'price', data.carbonate.price);
    if (data.carbonate.priceCNY) replaceInBlock('carbonate', 'priceCNY', data.carbonate.priceCNY);
    if (data.carbonate.changeCNY !== null) replaceInBlock('carbonate', 'changeCNY', data.carbonate.changeCNY);
    if (data.carbonate.changeUSD !== null) replaceInBlock('carbonate', 'changeUSD', data.carbonate.changeUSD);
    if (data.carbonate.changePercent !== null) replaceInBlock('carbonate', 'changePercent', data.carbonate.changePercent);

    // Spodumene
    if (data.spodumene.price) replaceInBlock('spodumene', 'price', data.spodumene.price);
    if (data.spodumene.changeUSD !== null) replaceInBlock('spodumene', 'changeUSD', data.spodumene.changeUSD);
    if (data.spodumene.changePercent !== null) replaceInBlock('spodumene', 'changePercent', data.spodumene.changePercent);

    // Futures
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
