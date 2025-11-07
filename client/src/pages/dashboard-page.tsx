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
  Plus,
  X,
  FileText,
} from "lucide-react";
import { useLocation } from "wouter";
import Logo from "@/components/logo";
import BottomNav from "@/components/bottom-nav";
import MarketTicker from "@/components/market-ticker";
import FeatureButton from "@/components/feature-button";
import RechargeDialog from "@/components/recharge-dialog";
import WithdrawDialog from "@/components/withdraw-dialog";
import { WithdrawalProcessingStatus } from "@/components/withdrawal-processing-status";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { useQuery } from "@tanstack/react-query";
import { Crown, Star, Award, Mail, Twitter } from "lucide-react";
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
  const directVolume = rankData?.directVolume || 0;
  const indirectVolume = rankData?.indirectVolume || 0;

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
    if (rank === "none") return "text-black";
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
              <p className="text-xs text-black">
                {t('rank.totalVolume')}: ${totalVolume.toLocaleString()}
              </p>
              <div className="flex gap-4 mt-1">
                <p className="text-xs text-blue-600">
                  Direct: ${directVolume.toLocaleString()}
                </p>
                <p className="text-xs text-purple-600">
                  Indirect: ${indirectVolume.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          
          {nextRank && (
            <div className="text-right">
              <p className="text-xs text-white500">{t('rank.nextRank')}</p>
              <p className="font-medium text-sm text-white700">
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
            <div className="flex justify-between text-xs text-white600 mb-1">
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
    navigate("/tradenow");
  };

  const handleInviteClick = () => {
    navigate("/invite");
  };

  const handleWhitePaperClick = () => {
    toast({
      title: "Coming Soon",
      description: "White Paper will be available soon!",
    });
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
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-md border-b border-white/10 p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Logo size="small" />
          </div>
        </div>
      </header>

      {/* Market Status Banner */}
      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg mx-4 mb-6 p-3 text-xs overflow-hidden">
        <div className="flex items-center text-white">
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
        <FeatureButton
          icon={FileText}
          label="White Paper"
          onClick={handleWhitePaperClick}
        />
      </div>

      {/* Rank Display */}
      <RankDisplay />

      {/* Withdrawal Processing Status */}
      <div className="mx-4 mb-6">
        <WithdrawalProcessingStatus />
      </div>

    

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
                className="text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'rgba(45, 27, 105, 0.9)' }}
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
        <div className="flex-1 bg-black/20 backdrop-blur-md border border-white/10 rounded-lg p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#4CAF50] to-[#4CAF50]/50"></div>
          <div className="flex items-center mb-1">
          </div>
          <div className="font-mono font-medium text-white text-xl">
            ${parseFloat(user?.totalAssets?.toString() || "0").toLocaleString('en-US', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2
            })}
          </div>
        </div>
      </div>

      {/* Invite Friends Banner */}
      <div className="mx-4 mb-6 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <strong className="text-white font-bold">{t('invite.title')}</strong><br />
              <strong className="text-white text-xs">Every 3 referrals who deposit $12 = $10 bonus!</strong><br />
            </div>
            <button
              className="px-3 py-1.5 rounded-lg text-white text-xs hover:bg-white/10 transition-colors"
              style={{ backgroundColor: 'rgba(45, 27, 105, 0.9)' }}
              onClick={handleInviteClick}
            >
              {t('nav.invite')}
            </button>
          </div>
          <div className="text-xs text-white">
            <strong>✓ Refer friends with your unique code</strong><br />
            <strong>✓ They deposit $12 ($10 to account + $2 fee) and start earning</strong><br />
            <strong>✓ You get $10 for every 3 qualified referrals</strong><br />
          </div>
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
              href="https://t.me/Hanadex"
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
              href="mailto:hanaaisupport@atomicmail.io"
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
          </div>
        )}
      </div>

      {/* Random User Display */}

      {/* Random Text Section */}
      <div className="mx-4 mb-6 p-4 rounded-lg text-sm" style={{ backgroundColor: 'rgba(45, 27, 105, 0.9)' }}>
        <h3 className="text-white font-medium mb-2">Additional Information</h3>
        <div className="text-white/80">
        Deposit $12 USDT ($10 to your account + $2 admin fee), and the minimum withdrawal amount is $2 USDT.
        The funds will be credited to your account within three minutes.<br />
          <br />
          <br /> ===========<br /> ✔How to make money: <br />
          1. Deposit $12 ($10 credited to account + $2 fee) and Earn 3% daily (Withdrawals available every day)<br />
2. To Generate Daily Returns You Must Click on "Trade now", then Click on "Start Trading" wait for few seconds for Hana AI to generate profits. <br />
3. Refer friends: Every 3 people who deposit $12 using your referral code = $10 bonus for you!<br />
4. Accounts must be funded within 24 hours or they will be automatically deleted.<br />

<strong>
Trade Time : Once Per day
</strong>
<br />

 <strong>Withdrawal days : Every day</strong><br />

 <strong>Trading Days: Monday to Sunday (7 days a week)</strong>
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
        <DialogContent className="bg-black/90 backdrop-blur-md text-white border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">
              Hana Trading Info
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            <div className="space-y-4 pr-4">
              <p>
                Deposit exactly $12 USDT ($10 credited to your account + $2 admin fee), and the minimum withdrawal amount is $2 USDT
              </p>
              <p>
                The Deposit Fee is $2 (Fixed fee used for Maintenance of the Hana AI Ecosystem) - included in the $12 total
              </p>
              <p>
                The withdrawal fee is $1 (Fixed fee) and the funds will be credited to your account within few minutes.
              </p>
              <p>
                Accounts must be funded within 24 hours or they will be automatically deleted from the system.
              </p>
              <p>
                Please if you have any enquiries send us an email at: <span style={{color: '#2563eb', fontWeight: 'bold'}}>Support@nebrix.dev</span>
              </p>
              
              <div className="border-t border-b border-gray-600 py-4 my-4">
                <p className="font-semibold mb-2">✔How to make money:</p>
                <div className="space-y-2">
                  <p>
                    Deposit $12 ($10 to account + $2 fee) and earn 3% per day (Withdrawals are available every day)
                  </p>
                  <p>
                    To Generate Daily Returns You Must click on "Trade Now", then click on "Start Trading" wait for few seconds.
                  </p>
                  <p>
                    <strong>Referral Bonus:</strong> Every 3 people who join with $12 using your referral link = $10 bonus for you!
                  </p>
                  <p>
                    Trading time: Trading Time is once every 24hrs.
                  </p>
                  <p>
                    Withdrawal days: Available Every day
                  </p>
                  <p>
                    Trading Days: Monday to Sunday (7 days a week)
                  </p>
                  <p>
                    For example, if you deposit $12 USDT ($10 to account), the AI profit of a single transaction is $10 × 3% = $0.30 USDT
                  </p>
                  <p>
                    The profit can be withdrawn immediately.
                  </p>
                  <p>
                    Important: Accounts must be funded within 24 hours or they will be automatically deleted from the system.
                  </p>
                </div>
              </div>


              <p className="text-sm text-white600">
                Hana works with bloggers on multiple social platforms (such as Twitter, YouTube, TikTok, Facebook, Instagram, etc.)
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
