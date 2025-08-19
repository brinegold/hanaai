// hooks/use-crypto-prices.ts
import { useState, useEffect } from "react";

export interface CryptoCurrency {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  exchange: string;
}

export const useCryptoPrices = () => {
  const [data, setData] = useState<CryptoCurrency[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCryptoPrices = async () => {
    try {
      const response = await fetch(
        "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=false",
      );
      const result = await response.json();

      const exchanges = ["BINANCE", "OKX", "HUOBI", "COINBASE"];
      const cryptoData = result.map((coin: any) => ({
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        price: coin.current_price,
        change24h: coin.price_change_percentage_24h,
        exchange: exchanges[Math.floor(Math.random() * exchanges.length)],
      }));

      setData(cryptoData);
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching crypto prices:", error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCryptoPrices();
  }, []);

  return { data, isLoading };
};
