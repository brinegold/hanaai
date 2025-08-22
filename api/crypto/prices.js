import 'dotenv/config';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const [binanceRes, okxRes, huobiRes, coinbaseRes] = await Promise.all([
      fetch("https://api.binance.com/api/v3/ticker/24hr"),
      fetch(
        "https://www.okx.com/api/v5/market/tickers?instType=SPOT&instId=BTC-USDT,ETH-USDT,BNB-USDT,XRP-USDT,ADA-USDT,SOL-USDT,DOGE-USDT,AVAX-USDT",
      ),
      fetch("https://api.huobi.pro/market/tickers"),
      fetch("https://api.coinbase.com/v2/exchange-rates"),
    ]);

    const [binanceData, okxData, huobiData, coinbaseData] = await Promise.all(
      [binanceRes.json(), okxRes.json(), huobiRes.json(), coinbaseRes.json()],
    );

    const formatPrice = (price) => Number(price.toFixed(2));
    const prices = [];

    // Process Binance data
    try {
      if (
        binanceData?.code === 0 &&
        binanceData?.msg?.includes("restricted location")
      ) {
        console.log("Binance API not available in current region");
      } else {
        const binanceSymbols = [
          "BTCUSDT", "ETHUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", 
          "SOLUSDT", "DOGEUSDT", "AVAXUSDT"
        ];
        
        binanceSymbols.forEach(symbol => {
          const ticker = binanceData.find(t => t.symbol === symbol);
          if (ticker) {
            prices.push({
              symbol: symbol.replace('USDT', ''),
              price: formatPrice(parseFloat(ticker.lastPrice)),
              change: formatPrice(parseFloat(ticker.priceChangePercent)),
              exchange: 'Binance'
            });
          }
        });
      }
    } catch (error) {
      console.error("Error processing Binance data:", error);
    }

    // Process OKX data
    try {
      if (okxData?.data) {
        okxData.data.forEach(ticker => {
          const symbol = ticker.instId.split('-')[0];
          prices.push({
            symbol,
            price: formatPrice(parseFloat(ticker.last)),
            change: formatPrice(parseFloat(ticker.changePercent) * 100),
            exchange: 'OKX'
          });
        });
      }
    } catch (error) {
      console.error("Error processing OKX data:", error);
    }

    // Process Huobi data
    try {
      if (huobiData?.data) {
        const huobiSymbols = ['btcusdt', 'ethusdt', 'bnbusdt', 'xrpusdt', 'adausdt', 'solusdt', 'dogeusdt', 'avaxusdt'];
        huobiSymbols.forEach(symbolLower => {
          const ticker = huobiData.data.find(t => t.symbol === symbolLower);
          if (ticker) {
            prices.push({
              symbol: symbolLower.replace('usdt', '').toUpperCase(),
              price: formatPrice(parseFloat(ticker.close)),
              change: formatPrice(((parseFloat(ticker.close) - parseFloat(ticker.open)) / parseFloat(ticker.open)) * 100),
              exchange: 'Huobi'
            });
          }
        });
      }
    } catch (error) {
      console.error("Error processing Huobi data:", error);
    }

    // Process Coinbase data
    try {
      if (coinbaseData?.data?.rates) {
        const coinbaseSymbols = ['BTC', 'ETH', 'BNB', 'XRP', 'ADA', 'SOL', 'DOGE', 'AVAX'];
        coinbaseSymbols.forEach(symbol => {
          const rate = coinbaseData.data.rates[symbol];
          if (rate) {
            prices.push({
              symbol,
              price: formatPrice(1 / parseFloat(rate)),
              change: 0, // Coinbase doesn't provide 24h change in this endpoint
              exchange: 'Coinbase'
            });
          }
        });
      }
    } catch (error) {
      console.error("Error processing Coinbase data:", error);
    }

    res.json({ prices });
  } catch (error) {
    console.error("Error fetching crypto prices:", error);
    res.status(500).json({ error: "Failed to fetch crypto prices" });
  }
}
