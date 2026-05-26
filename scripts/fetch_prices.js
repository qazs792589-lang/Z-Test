import fs from 'fs';
import path from 'path';

async function refreshPrices() {
  console.log("Refreshing stock prices from TWSE for build...");
  const DATA_FILE = path.join(process.cwd(), "public", "stock_prices.json");
  
  // Ensure directory exists
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  try {
    const response = await fetch("https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL");
    if (!response.ok) throw new Error("Failed to fetch from TWSE");
    const data = await response.json();
    
    const newPrices = {};
    data.forEach((item) => {
      const price = parseFloat(item.ClosingPrice);
      if (!isNaN(price)) {
        newPrices[item.Code] = price;
      }
    });

    fs.writeFileSync(DATA_FILE, JSON.stringify({ 
      updated: new Date().toISOString(), 
      prices: newPrices 
    }));
    console.log("Successfully updated build-time prices for", Object.keys(newPrices).length, "stocks.");
  } catch (error) {
    console.error("Error refreshing prices during build:", error);
    // Produce an empty valid file if it fails so build doesn't break
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify({ updated: null, prices: {} }));
    }
  }
}

refreshPrices();
