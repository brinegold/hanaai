import React, { useState } from "react";
import {
  Bell,
  MessageSquare,
  Wallet,
  RefreshCcw,
  ChartPie,
  Users,
  Download,
  Gift,
  MessageCircle,
  TrendingUp,
  Mail,
  Twitter,
  Plus,
  X,
} from "lucide-react";
import { useLocation } from "wouter";
import Logo from "@/components/logo";
import BottomNav from "@/components/bottom-nav";
import MarketTicker from "@/components/market-ticker";
import FeatureButton from "@/components/feature-button";
import RechargeDialog from "@/components/recharge-dialog";
import WithdrawDialog from "@/components/withdraw-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { useQuery } from "@tanstack/react-query";
import { Crown, Star, Award } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RandomUserDisplay } from "@/components/random-user-display"; // Assuming this is the correct import path

// Rank Display Component
const RankDisplay: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();

  const { data: ranks } = useQuery({
    queryKey: ["/api/ranks"],
  });

  // Automatically check and update user rank when component loads
  const { data: rankData, refetch: refetchRank } = useQuery({
    queryKey: ["/api/check-rank", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const response = await fetch(`/api/check-rank/${user.id}`);
      return response.json();
    },
    enabled: !!user?.id,
    staleTime: 30 * 1000, // 30 seconds - shorter cache for more frequent updates
    refetchOnWindowFocus: true,
  });

  const currentRank = user?.currentRank || "none";
  // Use the calculated volume from the rank check API if available, otherwise fall back to user data
  const totalVolume = rankData?.totalVolume || parseFloat(user?.totalVolumeGenerated?.toString() || "0");

  // Find next rank
  const nextRank = ranks?.find((rank: any) => 
    parseFloat(rank.requiredVolume) > totalVolume
  ) || (ranks && ranks.length > 0 ? ranks[0] : null);

  const getRankIcon = (rank: string) => {
    if (rank === "none") return null;
    if (["President", "Chairman", "Vice Chairman"].includes(rank)) {
      return <Crown className="h-5 w-5 text-yellow-500" />;
    }
    if (["Executive", "Director"].includes(rank)) {
      return <Award className="h-5 w-5 text-purple-500" />;
    }
    return <Star className="h-5 w-5 text-blue-500" />;
  };

  const getRankColor = (rank: string) => {
    if (rank === "none") return "text-gray-500";
    if (["President", "Chairman", "Vice Chairman"].includes(rank)) {
      return "text-yellow-600";
    }
    if (["Executive", "Director"].includes(rank)) {
      return "text-purple-600";
    }
    return "text-blue-600";
  };

  // Always show rank display, even for users with no rank
  // if (currentRank === "none" && !nextRank) return null;

  return (
    <div className="mx-4 mb-6">
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getRankIcon(currentRank)}
            <div>
              <h3 className={`font-semibold ${getRankColor(currentRank)}`}>
                {currentRank === "none" ? t('rank.noRank') : currentRank}
              </h3>
              <p className="text-xs text-gray-500">
                {t('rank.totalVolume')}: ${totalVolume.toLocaleString()}
              </p>
            </div>
          </div>
          
          {nextRank && (
            <div className="text-right">
              <p className="text-xs text-gray-500">{t('rank.nextRank')}</p>
              <p className="font-medium text-sm text-gray-700">
                {nextRank.name}
              </p>
              <p className="text-xs text-blue-600">
                ${(parseFloat(nextRank.requiredVolume) - totalVolume).toLocaleString()} {t('rank.remaining')}
              </p>
            </div>
          )}
        </div>
        
        {nextRank && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>${totalVolume.toLocaleString()}</span>
              <span>${parseFloat(nextRank.requiredVolume).toLocaleString()}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${Math.min((totalVolume / parseFloat(nextRank.requiredVolume)) * 100, 100)}%` 
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();

  const bubbleStyle = (bottom: string, backgroundColor: string): React.CSSProperties => ({
    position: 'fixed',
    bottom,
    right: '20px',
    backgroundColor,
    borderRadius: '50%',
    width: '50px',
    height: '50px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)',
    zIndex: 50,
    color: 'white',
    cursor: 'pointer',
    transition: 'transform 0.2s',
  });

  const telegramStyle = bubbleStyle('80px', '#229ED9');
  const emailStyle = bubbleStyle('140px', '#4CAF50');
  const twitterStyle = bubbleStyle('200px', '#1DA1F2');

  // Dialog states
  const [rechargeDialogOpen, setRechargeDialogOpen] = useState(false);
  const [socialBubbleOpen, setSocialBubbleOpen] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [supportDialogOpen, setSupportDialogOpen] = useState(false);
  const [isApplyingCountryRep, setIsApplyingCountryRep] = useState(false);

  // Feature button handlers
  const handleRechargeClick = () => {
    setRechargeDialogOpen(true);
  };

  const handleWithdrawClick = () => {
    setWithdrawDialogOpen(true);
  };


  const handleTeamClick = () => {
    navigate("/invite");
  };

  const handleDownloadAppClick = () => {
    toast({
      title: "App Download",
      description: "Mobile app coming soon. Currently only available via web.",
    });
  };

  const handleActivityClick = () => {
    toast({
      title: "Promotions & Activities",
      description: "New activities will be announced soon. Stay tuned!",
    });
  };

  const handleConversationClick = () => {
    setSupportDialogOpen(true);
  };

  const handleWealthGrowthClick = () => {
    navigate("/quantitative");
  };

  const handleInviteClick = () => {
    navigate("/invite");
  };

  // Country Rep application handler
  const handleCountryRepApplication = async () => {
    try {
      setIsApplyingCountryRep(true);
      const response = await fetch("/api/apply-country-rep", {
        method: "POST",
        credentials: "include",
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Application Submitted!",
          description: data.message,
        });
      } else {
        toast({
          title: "Application Failed",
          description: data.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit Country Rep application",
        variant: "destructive",
      });
    } finally {
      setIsApplyingCountryRep(false);
    }
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Logo size="small" />
          </div>
        </div>
      </header>

      {/* Market Status Banner */}
      <div className="bg-white border border-gray-200 rounded-lg mx-4 mb-6 p-3 text-xs overflow-hidden">
        <div className="flex items-center text-gray-700">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#4F9CF9"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-2 animate-pulse"
          >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          <span className="animate-marquee whitespace-nowrap">
            {t('dashboard.marketBanner')}
          </span>
        </div>
      </div>

      {/* Feature Quick Access */}
      <div className="grid grid-cols-4 gap-2 mx-4 mb-6">
        <FeatureButton
          icon={Wallet}
          label={t('dashboard.deposit')}
          onClick={handleRechargeClick}
        />
        <FeatureButton
          icon={RefreshCcw}
          label={t('dashboard.withdraw')}
          onClick={handleWithdrawClick}
        />
        <FeatureButton icon={Users} label={t('nav.invite')} onClick={handleTeamClick} />

        {/* Second Row */}
        <FeatureButton
          icon={Download}
          label="Download APP"
          onClick={handleDownloadAppClick}
        />
        <FeatureButton
          icon={Gift}
          label="Activity"
          onClick={handleActivityClick}
        />
        <FeatureButton
          icon={MessageCircle}
          label="Support"
          onClick={handleConversationClick}
        />
        <FeatureButton
          icon={TrendingUp}
          label={t('dashboard.aiTrading')}
          onClick={handleWealthGrowthClick}
        />
      </div>

      {/* Rank Display */}
      <RankDisplay />

      {/* Country Rep Application */}
      {user && !user.isCountryRep && user.countryRepStatus !== "pending" && (
        <div className="mx-4 mb-6">
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-bold text-lg mb-1">🏆 Apply for Country Rep</h3>
                <p className="text-purple-100 text-sm mb-2">
                  Unlock exclusive benefits and earn $10,000 bonus!
                </p>
                <div className="text-xs text-purple-200">
                  <div className="flex items-center gap-2">
                    <span>✓ Exclusive Country Representative status</span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleCountryRepApplication}
                disabled={isApplyingCountryRep}
                className="bg-white text-purple-600 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-purple-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApplyingCountryRep ? "Applying..." : "Apply Now"}
              </button>
            </div>
            <div className="mt-3 pt-3 border-t border-purple-400/30">
              <p className="text-xs text-purple-200">
                <strong>Requirement:</strong> $1,000,000 in Team Volume
              </p>
              <p className="text-xs text-purple-200 mt-1">
                Current Volume: ${parseFloat(user.totalVolumeGenerated || "0").toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Country Rep Status - Pending */}
      {user && user.countryRepStatus === "pending" && (
        <div className="mx-4 mb-6">
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg p-4 text-white">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-full p-2">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg">⏳ Country Rep Application Pending</h3>
                <p className="text-orange-100 text-sm">
                  Your application is under review. You'll be notified once approved!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Country Rep Status - Approved */}
      {user && user.isCountryRep && (
        <div className="mx-4 mb-6">
          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-4 text-white">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-full p-2">
                <Crown className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg">👑 Country Representative</h3>
                <p className="text-green-100 text-sm">
                  You are now a Country Rep with exclusive benefits!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Asset Summary */}
      <div className="flex space-x-4 mx-4 mb-6">
        {/* USDT Balance */}
        <div className="flex-1 bg-white border border-gray-200 rounded-lg p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#4CAF50] to-[#4CAF50]/50"></div>
          <div className="flex items-center mb-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 mr-2 text-green-500"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v12" />
              <path d="M8 10h8" />
            </svg>
            <span className="text-xs text-gray-400">USDT</span>
          </div>
          <div className="font-mono font-medium text-gray-900 text-xl">
            ${parseFloat(user?.totalAssets?.toString() || "0").toLocaleString('en-US', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2
            })}
          </div>
          <div className="text-xs flex items-center">
            <span className="text-[#4CAF50]">+2.5%</span>
            <span className="text-gray-400 ml-1">24h</span>
          </div>
        </div>

        {/* ETH Balance */}
        <div className="flex-1 bg-white border border-gray-200 rounded-lg p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#2196F3] to-[#2196F3]/50"></div>
          <div className="flex items-center mb-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 mr-2 text-blue-500"
            >
              <path d="M11.767 19.089c4.924.868 6.14-6.025 1.216-6.894m-1.216 6.894L5.86 18.047m5.908 1.042-.347 1.97m1.563-8.864c4.924.869 6.14-6.025 1.215-6.893m-1.215 6.893-3.94-.694m5.155-6.2L8.29 4.26m5.908 1.042.348-1.97" />
            </svg>
            <span className="text-xs text-gray-400">ETH</span>
          </div>
          <div className="font-mono font-medium text-gray-900 text-xl">$0.00</div>
          <div className="text-xs flex items-center">
            <span className="text-[#4CAF50]">+3.2%</span>
            <span className="text-gray-400 ml-1">24h</span>
          </div>
        </div>
      </div>

      {/* Invite Friends Banner */}
      <div className="mx-4 mb-6 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg px-4 py-3 flex items-center justify-between">
          <div>
            <h3 className="text-[#121212] font-medium">{t('invite.title')}</h3>
            <p className="text-[#121212]/80 text-xs">Earn Income now!</p>
          </div>
          <button
            className="px-3 py-1.5 rounded-lg bg-white text-black text-xs"
            onClick={handleInviteClick}
          >
            {t('nav.invite')}
          </button>
        </div>
      </div>

      <RandomUserDisplay />

      {/* Market Ticker */}
      <MarketTicker />

      {/* Social Media Bubble */}
      <div style={{
        position: 'fixed',
        bottom: '80px',
        right: '20px',
        zIndex: 50,
      }}>
        {/* Main Toggle Bubble */}
        <div
          onClick={() => setSocialBubbleOpen(!socialBubbleOpen)}
          style={{
            backgroundColor: '#4F9CF9',
            borderRadius: '50%',
            width: '50px',
            height: '50px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            transform: socialBubbleOpen ? 'rotate(45deg)' : 'rotate(0deg)',
          }}
          className="hover:transform hover:scale-110"
        >
          {socialBubbleOpen ? <X size={24} /> : <Plus size={24} />}
        </div>

        {/* Expandable Social Links */}
        {socialBubbleOpen && (
          <div style={{
            position: 'absolute',
            bottom: '60px',
            right: '0px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            animation: 'fadeIn 0.3s ease-in-out',
          }}>
            {/* Telegram */}
            <a 
              href="https://t.me/Nebrixdex"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                backgroundColor: '#229ED9',
                borderRadius: '50%',
                width: '45px',
                height: '45px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)',
                color: 'white',
                cursor: 'pointer',
                transition: 'transform 0.2s',
              }}
              className="hover:transform hover:scale-110"
            >
              <MessageCircle size={20} />
            </a>

            {/* Email */}
            <a 
              href="mailto:support@nebrix.dev"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                backgroundColor: '#4CAF50',
                borderRadius: '50%',
                width: '45px',
                height: '45px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)',
                color: 'white',
                cursor: 'pointer',
                transition: 'transform 0.2s',
              }}
              className="hover:transform hover:scale-110"
            >
              <Mail size={20} />
            </a>

            {/* Twitter */}
            <a 
              href="https://x.com/NebrixCoin"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                backgroundColor: '#1DA1F2',
                borderRadius: '50%',
                width: '45px',
                height: '45px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)',
                color: 'white',
                cursor: 'pointer',
                transition: 'transform 0.2s',
              }}
              className="hover:transform hover:scale-110"
            >
              <Twitter size={20} />
            </a>
          </div>
        )}
      </div>

      {/* Random User Display */}

      {/* Random Text Section */}
      <div className="mx-4 mb-6 p-4 bg-white border border-gray-200 rounded-lg text-sm">
        <h3 className="text-gray-900 font-medium mb-2">Additional Information</h3>
        <div className="text-gray-700">
        The Minimum deposit amount for Nebrix AI Trading is 5USDT , and the minimum withdrawal amount is 1USDT .
        The funds will be credited to your account within three minutes.<br></br>
          <br></br>
          <br></br> ===========<br></br> ✔How to make money: <br></br>
          1. Deposit Now and Earn 1.5% daily(Withdrawals available each day)<br></br>
2. To Generate Daily Returns You Must Click on "Trade now" ,then Click on Start Trading" wait for few seconds for Nebrix AI to generate profits. <br></br>
3.  Invite others participate and earn in Nebrix Uni-level referral Program earning in 4 levels; 5%,3%,2% and 1%.<br></br>

<strong>
Trade Time : Once Per day
</strong>
<br></br>

 <strong>Withdrawal days : Every day</strong>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav />

      {/* Dialogs */}
      <RechargeDialog
        open={rechargeDialogOpen}
        onOpenChange={setRechargeDialogOpen}
      />

      <WithdrawDialog
        open={withdrawDialogOpen}
        onOpenChange={setWithdrawDialogOpen}
      />

      {/* Support Dialog */}
      <Dialog open={supportDialogOpen} onOpenChange={setSupportDialogOpen}>
        <DialogContent className="bg-white text-gray-900 border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-900">
              Nebrix Trading Info
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            <div className="space-y-4 pr-4">
              <p>
                The Minimum deposit amount for Nebrix AI trading is 5USDT, and the minimum withdrawal amount is 1USDT
              </p>
              <p>
                The Maximum deposit is 500,000USDT.
              </p>
              <p>
                The Deposit Fee is 5%(Fees used for Maintenance of the Nebrix AI Ecosystem)
              </p>
              <p>
                The withdrawal fee is 10% and the funds will be credited to your account within few minutes.
              </p>
              <p>
                Please if you have any enquiries send us an email at: Support@nebrix.dev
              </p>
              
              <div className="border-t border-b border-gray-600 py-4 my-4">
                <p className="font-semibold mb-2">✔How to make money:</p>
                <div className="space-y-2">
                  <p>
                    Invest now and earn 1.5% per day (weekly cash Withdrawals are available every day)
                  </p>
                  <p>
                    To Generate Daily Returns You Must click on "Trade Now", then click on "Start Trading" wait for few seconds .
                  </p>
                  <p>
                    Invite others to participate and get 5%,3%,2% and 1% in Nebrix Uni-Level referral commission Program✔
                  </p>
                  <p>
                    Trading time: Trading Time is once every 24hrs.
                  </p>
                  <p>
                    Withdrawal days: Available Every day
                  </p>
                  <p>
                    For example, if you deposit 100 USDT , the AI profit of a single transaction is 100×1.5%= 1.5USDT
                  </p>
                  <p>
                    The bonus can be withdrawn immediately. The more users you recommend, the more commission rewards you will get.
                  </p>
                  <p>
                    The commissions collected from the recommended users will go directly into your member account and you can withdraw them directly!
                  </p>
                </div>
              </div>

              <div className="border-b border-gray-600 pb-4 mb-4">
                <p className="font-semibold mb-2">------Invite Team charging reward--------</p>
                <div className="space-y-3">
                  <div>
                    <p className="font-medium">1: Get 5% of the deposit of level-1 team members</p>
                    <p className="text-sm text-gray-600">
                      The first-level team can receive commission income every day = 100*5%*10 people = 50 USDT
                    </p>
                    <p className="text-sm text-gray-600">
                      Nebrix team daily deposit reward Your team can only deposit the value as a reward within 24 hours
                    </p>
                  </div>
                  
                  <div>
                    <p className="font-medium">2: Get 3% of the deposit of level-2 team members</p>
                    <p className="text-sm text-gray-600">
                      The second-level team can receive commission income every day = 100*3%*10 people = 30 USDT
                    </p>
                    <p className="text-sm text-gray-600">
                      Nebrix team daily deposit reward Your team can only deposit the value as a reward within 24 hours
                    </p>
                  </div>
                  
                  <div>
                    <p className="font-medium">3: Get 2% of the deposit of level-3 team members</p>
                    <p className="text-sm text-gray-600">
                      The third-level team can receive commission income every day = 100*2%*10 people = 20 USDT
                    </p>
                    <p className="text-sm text-gray-600">
                      Nebrix team daily deposit reward Your team can only deposit the value as a reward within 24 hours
                    </p>
                  </div>
                  
                  <div>
                    <p className="font-medium">4: Get 1% of the deposit of level-4 team members</p>
                    <p className="text-sm text-gray-600">
                      The fourth-level team can receive commission income every day = 100*1%*10 people = 10 USDT
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-600">
                Nebrix works with bloggers on multiple social platforms (such as Twitter, YouTube, TikTok, Facebook, Instagram, etc.)
                to promote bloggers' tweets, videos and posts and increase account data (views, clicks, etc.) (Likes, reposts, fans, etc.)
                Help accounts achieve traffic growth. The final right of interpretation belongs to this platform.
              </p>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DashboardPage;
