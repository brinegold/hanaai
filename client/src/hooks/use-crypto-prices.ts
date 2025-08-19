import { useQuery } from "@tanstack/react-query";

interface CryptoCurrency {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  exchange: string;
}

export function useCryptoPrices() {
  return useQuery<CryptoCurrency[]>({
    queryKey: ["/api/crypto/prices"],
    queryFn: async () => {
      const response = await fetch('/api/crypto/prices');
      if (!response.ok) {
        throw new Error('Failed to fetch crypto prices');
      }
      return response.json();
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });
}

function getCryptoName(symbol: string): string {
  const names: { [key: string]: string } = {
    'BTC': 'Bitcoin',
    'ETH': 'Ethereum',
    'BNB': 'Binance Coin',
    'XRP': 'Ripple',
    'ADA': 'Cardano',
    'SOL': 'Solana',
    'DOGE': 'Dogecoin',
    'AVAX': 'Avalanche'
  };
  return names[symbol] || symbol;
}