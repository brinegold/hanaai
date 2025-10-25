import React, { useState, useEffect } from "react";
import {
  Bell,
  MessageSquare,
  ArrowRight,
  Clock,
  Zap,
  LineChart,
  Cpu,
  BarChart4,
  Check,
} from "lucide-react";
import Logo from "@/components/logo";
import BottomNav from "@/components/bottom-nav";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/hooks/use-language";

// Define the investment plan interface
interface InvestmentPlan {
  id: string;
  name: string;
  minAmount: number;
  maxAmount: number;
  dailyRate: number;
  description: string;
}


const QuantitativePage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [showTibankInfo, setShowTibankInfo] = useState<boolean>(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [detailedTimeRemaining, setDetailedTimeRemaining] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);
  // Local UI state for the top trading card
  const [selectedRange, setSelectedRange] = useState<'1d' | '7d' | '30d' | '90d' | 'all'>('1d');
  const [strategy, setStrategy] = useState<string>('Hermatic');
  
  // Trading is now available 7 days a week (Monday to Sunday)

  // Fetch investment plans
  const { data: plans, isLoading } = useQuery<InvestmentPlan[]>({
    queryKey: ["/api/investment/plans"],
  });

  // Fetch user investments and account details
  const { data: userInvestments, isLoading: isLoadingInvestments } = useQuery({
    queryKey: ["/api/investment"],
  });

  // Define account info type
  interface AccountInfoType {
    user: {
      id: number;
      username: string;
      email?: string;
      phone?: string;
      telegram?: string;
      referralCode: string;
      totalAssets: string | number;
      quantitativeAssets: string | number;
      profitAssets: string | number;
      todayEarnings: string | number;
      yesterdayEarnings: string | number;
      lastInvestmentDate?: string;
      createdAt: string;
    };
    stats: {
      totalInvested: number;
      currentBalance: number;
      totalProfit: number;
      activeInvestments: number;
      referralsCount: number;
    };
  }

  // Fetch account info to get lastInvestmentDate
  const { data: accountInfo, isLoading: isLoadingAccount } =
    useQuery<AccountInfoType>({
      queryKey: ["/api/account"],
    });

  // Calculate time remaining for next investment
  useEffect(() => {
    const updateTimer = () => {
      if (accountInfo?.user?.lastInvestmentDate) {
        const lastInvestment = new Date(accountInfo.user.lastInvestmentDate);
        const currentTime = new Date();
        const timeDifference = currentTime.getTime() - lastInvestment.getTime();
        const millisecondsIn24Hours = 24 * 60 * 60 * 1000;
        const remainingMs = millisecondsIn24Hours - timeDifference;

        if (remainingMs > 0) {
          const hours = Math.floor(remainingMs / (1000 * 60 * 60));
          const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
          
          setTimeRemaining(Math.ceil(remainingMs / (1000 * 60 * 60)));
          setDetailedTimeRemaining({ hours, minutes, seconds });
        } else {
          setTimeRemaining(null);
          setDetailedTimeRemaining(null);
        }
      } else {
        setTimeRemaining(null);
        setDetailedTimeRemaining(null);
      }
    };

    // Initial update
    updateTimer();

    // Update the timer every second for real-time countdown
    const timer = setInterval(updateTimer, 1000);

    return () => clearInterval(timer);
  }, [accountInfo]);

  // Create investment mutation
  const investmentMutation = useMutation({
    mutationFn: async (data: {
      amount: number;
      plan: string;
      dailyRate: number;
    }) => {
      console.log("Investment data:", data);
      const res = await apiRequest("POST", "/api/investment", data);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to create investment");
      }
      return await res.json();
    },
    onSuccess: (data) => {
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/investment"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });

      // Get the instant profit from the response
      const instantProfit = data.instantProfit;

      // Show success toast with profit information
      toast({
        title: "Investment Created",
        description: instantProfit
          ? `Successfully invested $${data.amount}. You earned ${data.dailyRate}% ($${instantProfit.toFixed(2)}) instant profit!`
          : `Successfully invested $${data.amount}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Investment Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const [showTradingSimulation, setShowTradingSimulation] = useState(false);
  const [simulationSteps, setSimulationSteps] = useState<string[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  // Removed investment dialog state variables as they're no longer needed
  const [btcPrice, setBtcPrice] = useState(84800);

  useEffect(() => {
    // Fetch initial BTC price
    fetch("/api/crypto/prices")
      .then((res) => res.json())
      .then((data) => {
        const btcData = data.find((crypto: any) => crypto.symbol === "BTC");
        if (btcData) {
          setBtcPrice(btcData.price);
        }
      })
      .catch(console.error);
  }, []);

  const handleStartInvestment = async (plan: InvestmentPlan, customAmount: number) => {
    // Check if user is in cooldown period
    if (timeRemaining !== null) {
      toast({
        title: "Trading Cooldown Period",
        description: `You can start a new investment in ${timeRemaining} hour${timeRemaining === 1 ? "" : "s"}. Only one trade is allowed every 24 hours.`,
        variant: "destructive",
      });
      return;
    }

    setShowTradingSimulation(true);
    setIsSimulating(true);
    setSimulationSteps([]);

    const steps = [
      "Initializing Artificial Intelligence trading system...",
      "Analyzing market conditions...",
      "Checking BTC/USDT spread across exchanges...",
      `Found arbitrage opportunity: Binance (${btcPrice.toLocaleString()}) → Huobi (${(btcPrice + 18).toLocaleString()})`,
      "Executing trade...",
      "Trade successful! Profit: +18 USDT",
      "Optimizing position...",
      "Completing investment process...",
    ];

    for (const step of steps) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setSimulationSteps((prev) => [...prev, step]);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSimulating(false);

    // Create the actual investment after simulation
    const amount = customAmount;
    investmentMutation.mutate({
      amount: amount,
      plan: plan.id,
      dailyRate: plan.dailyRate,
    });
  };

  const handlePlanSelect = (plan: InvestmentPlan) => {
    // Get user's total available capital
    const userCapital = user?.totalAssets ? parseFloat(user.totalAssets.toString()) : 0;
    
    // Check if user has sufficient capital for this plan
    if (userCapital < plan.minAmount) {
      toast({
        title: "Insufficient Capital",
        description: `You need at least $${plan.minAmount} to invest in this plan. Your current balance is $${userCapital.toFixed(2)}`,
        variant: "destructive",
      });
      return;
    }
    
    // Automatically invest the user's total available capital
    handleStartInvestment(plan, userCapital);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pb-24">
        <header className="bg-black/20 backdrop-blur-md border-b border-white/10 p-4 mb-4">
          <Skeleton className="h-10 w-full" />
        </header>
        <div className="px-4 space-y-6">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-md border-b border-white/10 p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Logo size="small" />
          </div>
        </div>
      </header>

      {/* Trading Dashboard Card */}
      <div className="px-4 mb-4">
        <Card className="border-white/10 overflow-hidden" style={{ backgroundColor: 'rgba(45, 27, 105, 0.9)' }}>
          <CardContent className="p-4">
            {/* Balance and Today Profit */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-white">{t('quantitative.availableBalance')}</p>
                <div className="flex items-center space-x-2 mt-1">
                  <div className="w-6 h-6 rounded-md bg-[#4F9CF9]/10 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-[#4F9CF9]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 8c-3.866 0-7 1.79-7 4s3.134 4 7 4 7-1.79 7-4-3.134-4-7-4z" />
                      <path d="M5 12v4m14-4v4" />
                    </svg>
                  </div>
                  <div className="text-white text-2xl font-semibold">
                    ${user?.totalAssets ? parseFloat(user.totalAssets.toString()).toFixed(2) : '0.00'}
                  </div>
                </div>
                <p className="text-[10px] text-white mt-1">~ 0.00 BTC</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-white">{t('dashboard.todayEarnings')}</p>
                <p className="text-green-600 font-semibold mt-1">
                  +${user?.todayEarnings ? parseFloat(user.todayEarnings.toString()).toFixed(2) : '0.00'}
                </p>
              </div>
            </div>

            {/* Simple line */}
            <div className="my-3">
              <div className="h-1 rounded bg-green-500" />
            </div>

            {/* Range Filters */}
            <div className="flex items-center space-x-2">
              {['1d','7d','30d','90d','all'].map((r) => (
                <button
                  key={r}
                  onClick={() => setSelectedRange(r as any)}
                  className={`px-3 py-1 rounded-md text-xs border transition-colors ${selectedRange === r ? 'bg-[#4F9CF9] text-white border-[#4F9CF9]' : 'bg-white text-white border-gray-300 hover:bg-gray-50'}`}
                >
                  {r === 'all' ? 'All' : r}
                </button>
              ))}
            </div>

            {/* Strategy Row */}
            <div className="flex items-center mt-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-white">Strategy</span>
                <select
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                  className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-[#4F9CF9]"
                >
                  <option value="Hana">Hana</option>
                </select>
              </div>
            </div>

            {/* Start Trading CTA */}
            <div className="mt-6 flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-[#4F9CF9]/10 flex items-center justify-center mb-2">
                <svg className="w-6 h-6 text-[#4F9CF9]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 17l4-4-4-4" />
                  <path d="M12 17l4-4-4-4" />
                </svg>
              </div>
              <p className="text-white font-medium">Start Trading</p>
              <p className="text-xs text-white mb-3">Enable trading now, and let our system execute trades seamlessly</p>
              <Button
                className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white px-5"
                onClick={() => {
                  const defaultPlan = plans && plans.length > 0 ? plans[0] : undefined;
                  if (defaultPlan) {
                    handlePlanSelect(defaultPlan as any);
                  } else {
                    toast({ title: 'No Plans Available', description: 'Investment plans are not loaded yet.' });
                  }
                }}
              >
                Let’s start
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Time Remaining Alert with Detailed Timer */}
      {timeRemaining !== null && (
        <div className="px-4 mb-4">
          <Alert className="bg-blue-900/30 border-blue-700 text-blue-200">
            <Clock className="h-5 w-5 text-blue-400" />
            <AlertTitle className="ml-2 font-semibold text-white">
              Trading Cooldown Period
            </AlertTitle>
            <AlertDescription className="ml-2 text-white">
              <div className="flex flex-col space-y-2">
                <span>
                  Only one AI trade is allowed every 24 hours.
                </span>
                {detailedTimeRemaining && (
                  <div className="flex items-center space-x-4 mt-2">
                    <span className="text-sm font-medium">Next trade available in:</span>
                    <div className="flex items-center space-x-2 bg-black/20 rounded-lg px-3 py-2">
                      <div className="flex flex-col items-center">
                        <span className="text-lg font-bold text-[#4F9CF9]">
                          {detailedTimeRemaining.hours.toString().padStart(2, '0')}
                        </span>
                        <span className="text-xs text-white">Hours</span>
                      </div>
                      <span className="text-[#4F9CF9] font-bold">:</span>
                      <div className="flex flex-col items-center">
                        <span className="text-lg font-bold text-[#4F9CF9]">
                          {detailedTimeRemaining.minutes.toString().padStart(2, '0')}
                        </span>
                        <span className="text-xs text-white">Minutes</span>
                      </div>
                      <span className="text-[#4F9CF9] font-bold">:</span>
                      <div className="flex flex-col items-center">
                        <span className="text-lg font-bold text-[#4F9CF9]">
                          {detailedTimeRemaining.seconds.toString().padStart(2, '0')}
                        </span>
                        <span className="text-xs text-white">Seconds</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Introduction to Quantitative Trading */}
      <div className="px-4 mb-6">
        <Card className="bg-black/20 backdrop-blur-md border-white/10 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 h-1" />
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-white text-lg">
                  Artificial Intelligence Trading
                </CardTitle>
                <CardDescription className="text-black text-xs">
                  Automatic algorithmic trading with daily profits
                </CardDescription>
              </div>
              <button
                onClick={() => setShowTibankInfo(true)}
                className="text-[#f5ef42] text-sm hover:text-yellow transition-colors"
              >
                Welcome To Hana Ai Trading
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2 text-center mb-4 rounded-lg p-2" style={{ backgroundColor: 'rgba(45, 27, 105, 0.9)' }}>
              <div className="space-y-1">
                <p className="text-xs text-white">{t('quantitative.investmentAmount')}</p>
                <p className="font-medium text-white">
                  {user?.totalAssets
                    ? parseFloat(user.totalAssets.toString()).toFixed(2)
                    : "0.00"}
                  $
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-white">{t('dashboard.todayEarnings')}</p>
                <p className="font-medium text-white">
                  {user?.todayEarnings
                    ? parseFloat(user.todayEarnings.toString()).toFixed(2)
                    : "0.00"}
                  $
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-white">Total Revenue</p>
                <p className="font-medium text-white">
                  {user?.profitAssets
                    ? parseFloat(user.profitAssets.toString()).toFixed(2)
                    : "0.00"}
                  $
                </p>
              </div>
            </div>

            <div className="rounded-lg p-2 mb-2" style={{ backgroundColor: 'rgba(45, 27, 105, 0.9)' }}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center space-x-2">
                  <div className="bg-[#4F9CF9]/10 p-1 rounded-md">
                    <svg
                      className="h-4 w-4 text-[#4F9CF9]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                      />
                    </svg>
                  </div>
                  <span className="text-white text-sm">
                    Ai Trend (24 Day)
                  </span>
                </div>
                <div>
                  <div className="w-6 h-6 rounded-full bg-[#333333] flex items-center justify-center">
                    <svg
                      className="h-3 w-3 text-[#4F9CF9]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="h-32 flex items-center justify-center">
                <div className="h-24 w-full relative">
                  {/* SVG Chart Representation */}
                  <svg
                    className="w-full h-full"
                    viewBox="0 0 300 100"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <defs>
                      <linearGradient
                        id="chartGradient"
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop
                          offset="0%"
                          stopColor="#4F9CF9"
                          stopOpacity="0.4"
                        />
                        <stop
                          offset="100%"
                          stopColor="#4F9CF9"
                          stopOpacity="0"
                        />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,80 C20,70 40,60 60,40 C80,20 100,30 120,40 C140,50 160,90 180,80 C200,70 220,20 240,30 C260,40 280,60 300,50"
                      fill="none"
                      stroke="#4F9CF9"
                      strokeWidth="2"
                    />
                    <path
                      d="M0,80 C20,70 40,60 60,40 C80,20 100,30 120,40 C140,50 160,90 180,80 C200,70 220,20 240,30 C260,40 280,60 300,50 L300,100 L0,100 Z"
                      fill="url(#chartGradient)"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Investment Status */}
      <div className="px-4 mb-6">
        <h2 className="text-white text-lg font-medium mb-4">
          Investment Status
        </h2>
        <div className="space-y-4">
          <Card className="mb-4 overflow-hidden" style={{ backgroundColor: 'rgba(45, 27, 105, 0.9)' }}>
            <div className="bg-gradient-to-r from-blue-600 to-blue-500 h-1.5" />
            <CardContent className="p-4">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <h3 className="text-white font-medium">AI Trading System</h3>
                  <p className="text-xs text-white">Automatic algorithmic trading with daily profits</p>
                </div>
                <Badge className="bg-[#4F9CF9] hover:bg-blue-500">
                  3% Daily
                </Badge>
              </div>

              <div className="space-y-2 mb-4">
                {(() => {
                  // Calculate daily percentage gain based on direct deposits used for trading
                  const directDeposits = user?.rechargeAmount ? parseFloat(user.rechargeAmount.toString()) : 0;
                  const todayEarnings = user?.todayEarnings ? parseFloat(user.todayEarnings.toString()) : 0;
                  const expectedDailyReturn = directDeposits * 0.03; // 3% daily
                  const dailyProgressPercentage = expectedDailyReturn > 0 ? Math.min(100, (todayEarnings / expectedDailyReturn) * 100) : 0;
                  
                  const tradingEarnings = user?.totalAssets ? parseFloat(user.totalAssets.toString()) - directDeposits : 0;
                  
                  return (
                    <>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-white">Daily Trading Progress</span>
                        <span className="text-[#4F9CF9] font-medium">{dailyProgressPercentage.toFixed(0)}%</span>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-white">Today's earnings:</span>
                          <span className="text-white font-medium">
                            ${todayEarnings.toFixed(2)} / Expected: ${expectedDailyReturn.toFixed(2)} (3% daily)
                          </span>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="text-white">Total earnings:</span>
                          <span className="text-white font-medium">
                            ${tradingEarnings.toFixed(2)} (No limit)
                          </span>
                        </div>
                      </div>

                      <Progress
                        value={dailyProgressPercentage}
                        className="h-2 bg-gray-200"
                        style={
                          { "--progress-foreground": dailyProgressPercentage >= 100 ? "#00ff00" : "#4F9CF9" } as React.CSSProperties
                        }
                      />
                    </>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Investment Plans */}
      <div className="px-4 pb-20">
        <h2 className="text-black text-lg font-medium mb-4">
          Investment Plans
        </h2>
        <div className="space-y-4">
          {(() => {
            const userCapital = user?.totalAssets ? parseFloat(user.totalAssets.toString()) : 0;
            const filteredPlans = plans?.filter((plan) => {
              return userCapital >= plan.minAmount && userCapital <= plan.maxAmount;
            });

            if (!filteredPlans || filteredPlans.length === 0) {
              return (
                <Card className="border-gray-200" style={{ backgroundColor: 'rgba(45, 27, 105, 0.9)' }}>
                  <CardContent className="p-6 text-center">
                    <div className="text-white mb-2">
                      <Zap className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                      <h3 className="font-medium">No Available Plans</h3>
                    </div>
                    <p className="text-white text-sm mb-3">
                      Your current balance (${userCapital.toFixed(2)}) doesn't match any available investment plans.
                    </p>
                    <p className="text-white text-xs">
                      Please add funds to your account to access investment opportunities.
                    </p>
                  </CardContent>
                </Card>
              );
            }

            return filteredPlans.map((plan) => (
            <Card key={plan.id} className="border-gray-200" style={{ backgroundColor: 'rgba(45, 27, 105, 0.9)' }}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-white font-medium">{plan.name}</h3>
                    <p className="text-xs text-white">{plan.description}</p>
                  </div>
                  <Badge className="bg-[#4F9CF9] hover:bg-blue-500">
                    {plan.dailyRate}% Daily
                  </Badge>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between">
                    <span className="text-white text-sm">
                      {t('quantitative.minimumInvestment')}
                    </span>
                    <span className="text-white font-medium">
                      ${plan.minAmount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white text-sm">
                      {t('quantitative.maximumInvestment')}
                    </span>
                    <span className="text-white font-medium">
                      ${plan.maxAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white text-sm">{t('quantitative.dailyReturn')}</span>
                    <span className="text-[#4CAF50] font-medium">
                      {plan.dailyRate}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white text-sm">Trading Days</span>
                    <span className="text-green-500 font-medium">
                      Monday to Sunday
                    </span>
                  </div>
                </div>

                <Button
                  className="w-full bg-gradient-to-r from-[#4F9CF9] to-[#FFCB8E] text-[#121212] hover:opacity-90 transition-opacity"
                  variant="default"
                  onClick={() => handlePlanSelect(plan)}
                >
                  Invest ${user?.totalAssets ? parseFloat(user.totalAssets.toString()).toFixed(2) : '0.00'} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
            ));
          })()}
        </div>
      </div>

      {/* Trading Simulation Dialog */}
      <Dialog
        open={showTradingSimulation}
        onOpenChange={setShowTradingSimulation}
      >
        <DialogContent className="bg-white border-gray-200 text-gray-900">
          <DialogHeader>
            <DialogTitle>Ai Trading Process</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {simulationSteps.map((step, index) => (
              <div key={index} className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Check className="h-3 w-3 text-blue-500" />
                </div>
                <p className="text-sm">{step}</p>
              </div>
            ))}
            {isSimulating && (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4">
                  <svg
                    className="animate-spin h-4 w-4 text-blue-500"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                </div>
                <p className="text-sm text-blue-500">Processing...</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bottom Navigation */}
      <BottomNav />

      {/* Hana Info Dialog */}
      <Dialog open={showTibankInfo} onOpenChange={setShowTibankInfo}>
        <DialogContent className="bg-white border-gray-200 text-gray-900 max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center text-black mb-4">
              Welcome To Hana Ai Trading
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <p>
            Hana is an advanced AI-powered quantitative trading ecosystem designed to transform the way investors interact with the digital economy. By integrating Hermetic AI, a proprietary trading engine, Hana delivers consistent and sustainable returns through adaptive strategies that thrive in the fast-paced crypto market.
            </p>

            <h3 className="text-[#4F9CF9] font-medium mt-4">
              Hana automatic Ai money-making function
            </h3>
            <p>
              Hana can buy Bitcoin at a low price from Exchange A within 1
              second, and sell it at a high price on Exchange B to make a
              profit.
            </p>
            
            <div className="bg-green-50 border border-green-200 p-3 rounded-lg mt-3">
              <p className="text-green-700 font-medium text-sm">
                📅 Trading Schedule: Monday to Sunday (7 days a week)
              </p>
              <p className="text-green-600 text-xs mt-1">
                Daily returns are generated every day of the week including weekends.
              </p>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg my-4">
              <p>
                Example: (BTC/USDT) is bought at 30743.32 USDT on Binance and
                sold at 30761.32 USDT on Huobi. This transaction can earn 18
                USDT.
              </p>
              <p className="text-blue-400 text-xs mt-2">
                Note: It is impossible for humans to buy at the lowest price and
                sell at the highest price almost at the same time within 1
                second.
              </p>
            </div>

            <h3 className="text-[#4F9CF9] font-medium">Key Advantages:</h3>

            <div className="space-y-3">
              <div>
                <h4 className="font-medium mb-1">1. Speed and Accuracy</h4>
                <p className="text-white">
                  Hana executes trades with unparalleled speed and accuracy,
                  operating 24/7 through automated algorithms.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">2. Emotion-Free Trading</h4>
                <p className="text-white">
                  Hana uses computer programs and algorithms to ensure
                  consistent trading results without emotional bias.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">3. Advanced Backtesting</h4>
                <p className="text-white">
                  Uses historical market data to customize and optimize trading
                  models for maximum profit.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">4. Strict Discipline</h4>
                <p className="text-white">
                  Helps investors stick to established trading plans and avoid
                  human errors in volatile markets.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">5. Market Trend Analysis</h4>
                <p className="text-white">
                  Real-time analysis of market prospects across multiple
                  cryptocurrency categories.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">6. Decentralized Trading</h4>
                <p className="text-white">
                  Enables diversified trading across multiple exchanges and
                  trading types automatically.
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-600/20 to-blue-500/20 p-4 rounded-lg mt-6">
              <p className="text-center">
                Hana has undergone its fourth transformation, expanding
                functionality while simplifying investor transactions. Profits
                can be realized with just one click and waiting for 1-2 minutes.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuantitativePage;
