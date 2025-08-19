// components/MarketTicker.tsx
import React, { useState, useEffect } from "react";
import { useCryptoPrices } from "@/hooks/use-crypto-prices";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

const MarketTicker: React.FC = () => {
  const { data: initialCryptos, isLoading } = useCryptoPrices();
  const [cryptos, setCryptos] = useState(initialCryptos);
  const [exchanges] = useState(["COINBASE", "OKX", "HUOBI"]);
  const [selectedExchange, setSelectedExchange] = useState("COINBASE");

  useEffect(() => {
    if (!initialCryptos || initialCryptos.length === 0) return;

    const interval = setInterval(() => {
      setCryptos((prevCryptos) =>
        prevCryptos.map((crypto) => {
          const fluctuation = (Math.random() - 0.5) * 0.02;
          const newPrice = crypto.price * (1 + fluctuation);
          const priceChange = ((newPrice - crypto.price) / crypto.price) * 100;

          return {
            ...crypto,
            price: newPrice,
            change24h: crypto.change24h + priceChange,
          };
        }),
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [initialCryptos]);

  useEffect(() => {
    setCryptos(initialCryptos);
  }, [initialCryptos]);

  if (isLoading || !cryptos) {
    return (
      <div className="mx-4 mb-2">
        <div className="flex space-x-4 text-sm mb-2">
          {exchanges.map((exchange) => (
            <Skeleton key={exchange} className="h-8 w-20" />
          ))}
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-4">
      <Tabs defaultValue="COINBASE" onValueChange={setSelectedExchange}>
        <TabsList className="flex space-x-4 mb-2 bg-transparent h-auto p-0">
          {exchanges.map((exchange) => (
            <TabsTrigger
              key={exchange}
              value={exchange}
              className="py-1 text-gray-400 data-[state=active]:text-black data-[state=active]:font-medium data-[state=active]:relative data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:h-0.5 data-[state=active]:after:w-full data-[state=active]:after:bg-[#4F9CF9] bg-transparent px-0"
            >
              {exchange === "COINBASE" ? "BINANCE" : exchange}
            </TabsTrigger>
          ))}
        </TabsList>

        {exchanges.map((exchange) => (
          <TabsContent key={exchange} value={exchange} className="pb-24">
            <div className="flex justify-between text-xs text-gray-400 px-2 py-3 border-b border-[#333333]">
              <div className="w-1/4">Currency</div>
              <div className="w-1/4 text-right">Latest Price</div>
              <div className="flex justify-end w-1/2">24h Rise & Down</div>
            </div>

            <div className="custom-scrollbar overflow-y-auto max-h-96">
              {cryptos
                ?.filter((crypto) => crypto.exchange === exchange)
                .map((crypto) => (
                  <div
                    key={crypto.symbol}
                    className="flex items-center justify-between py-3 border-b border-[#333333] hover:bg-[#252525]/30 transition-colors"
                  >
                    <div className="flex items-center w-1/4">
                      <div className="w-6 h-6 mr-2 flex items-center justify-center text-xs font-bold bg-gray-50 rounded-full text-blue-500">
                        {crypto.symbol.substring(0, 1)}
                      </div>
                      <div>
                        <div className="text-black font-medium">
                          {crypto.symbol}
                        </div>
                        <div className="text-xs text-gray-400">
                          {crypto.name}
                        </div>
                      </div>
                    </div>
                    <div className="w-1/4 text-right">
                      <div className="text-black font-mono">
                        $
                        {(crypto.price ?? 0).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits:
                            (crypto.price ?? 0) < 1 ? 4 : 2,
                        })}
                      </div>
                    </div>
                    <div className="w-1/2 flex justify-end">
                      <div
                        className={`${
                          crypto.change24h >= 0
                            ? "bg-[#4CAF50]/10 text-[#4CAF50]"
                            : "bg-[#F44336]/10 text-[#F44336]"
                        } rounded-full px-3 py-1 text-xs font-medium`}
                      >
                        {crypto.change24h >= 0 ? "+" : ""}
                        {(crypto.change24h ?? 0).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default MarketTicker;
