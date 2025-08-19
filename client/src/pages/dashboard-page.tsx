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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RandomUserDisplay } from "@/components/random-user-display"; // Assuming this is the correct import path

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

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

  // Dialog states
  const [rechargeDialogOpen, setRechargeDialogOpen] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [supportDialogOpen, setSupportDialogOpen] = useState(false);

  // Feature button handlers
  const handleRechargeClick = () => {
    setRechargeDialogOpen(true);
  };

  const handleWithdrawClick = () => {
    setWithdrawDialogOpen(true);
  };

  const handleVipsClick = () => {
    toast({
      title: "VIP Feature",
      description: "VIP plans coming soon. Check back later!",
    });
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
            Market trading is in USDT, and the minimum withdrawal amount is 3
            USDT. The withdrawal fee is 0.5 USDT.Minimum Deposit is $10, Daily
            Returns is 3% and Withdrawal is allowed only on Fridays. Please note
            Trading Signals is once Per Day
          </span>
        </div>
      </div>

      {/* Feature Quick Access */}
      <div className="grid grid-cols-4 gap-2 mx-4 mb-6">
        <FeatureButton
          icon={Wallet}
          label="Deposit"
          onClick={handleRechargeClick}
        />
        <FeatureButton
          icon={RefreshCcw}
          label="Withdraw"
          onClick={handleWithdrawClick}
        />
        <FeatureButton icon={ChartPie} label="VIPs" onClick={handleVipsClick} />
        <FeatureButton icon={Users} label="Team" onClick={handleTeamClick} />

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
          label="Wealth Growth"
          onClick={handleWealthGrowthClick}
        />
      </div>

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
            ${parseFloat(user?.totalAssets?.toString() || "0").toFixed(2)}
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
            <h3 className="text-[#121212] font-medium">Invite Friends</h3>
            <p className="text-[#121212]/80 text-xs">Earn bonus now!</p>
          </div>
          <button
            className="px-3 py-1.5 rounded-lg bg-[#121212] text-black text-xs"
            onClick={handleInviteClick}
          >
            Invite Now
          </button>
        </div>
      </div>

      <RandomUserDisplay />

      {/* Market Ticker */}
      <MarketTicker />

      {/* Telegram Bubble */}
      <a 
        href="https://t.me/Tibankofficial1"
        target="_blank"
        rel="noopener noreferrer"
        style={telegramStyle}
        className="hover:transform hover:scale-110"
      >
        <MessageCircle size={24} />
      </a>

      {/* Email Bubble */}
      <a 
        href="mailto:Support@tibank.vip"
        target="_blank"
        rel="noopener noreferrer"
        style={emailStyle}
        className="hover:transform hover:scale-110"
      >
        <Mail size={24} />
      </a>

      {/* Random User Display */}

      {/* Random Text Section */}
      <div className="mx-4 mb-6 p-4 bg-white border border-gray-200 rounded-lg text-sm">
        <h3 className="text-gray-900 font-medium mb-2">Additional Information</h3>
        <div className="text-gray-700">
          The Minimum deposit amount for Tibank quantitative trading is 10USDT,
          and the minimum withdrawal amount is 3USDT.<br></br> The withdrawal
          fee is 0.5USDT and the funds will be credited to your account within
          three minutes.<br></br>
          <br></br>
          <br></br> ===========<br></br> ✔How to make money: <br></br>
          1. Invest now and earn 3% per day (weekly cash Withdrawals are
          available every Fridays)<br></br>2. To Generate Daily Returns You Must
          click on "Quantify", then click on "Start Trading" wait
          for few seconds .<br></br>
          3. Invite others to participate and get 5% referral commission
          <br></br>
          <br></br>✔<b> Quantification Trade time:</b> Trading Time at is 11am
          Taipei Time Zone(UTC +8)
          <br></br>
          <br></br>
          <b> Withdrawal days: Fridays Only</b> <br></br>
          <br></br>
          <b>Online customer service:</b> https://t.me/Tibankofficial1 <br></br>
          <br></br>Note: The stored value is used to open the corresponding
          level and obtain the current level percentage benefit.
          <br></br>
          For example, if you deposit 100 USDT , the quantitative profit of a
          single transaction is 100×3%=3 USDT
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
                The Minimum deposit amount for Nebrix quantitative trading is
                10USDT, and the minimum withdrawal amount is 3USDT.
              </p>
              <p>
                The withdrawal fee is 0.5USDT and the funds will be credited to
                your account within three minutes.
              </p>
              <div className="border-t border-b border-gray-600 py-4 my-4">
                <p className="font-semibold mb-2">✔How to make money:</p>
                <ol className="list-decimal pl-4 space-y-2">
                  <li>
                    Invest now and earn 3% per day (weekly cash Withdrawals are
                    available every Fridays)
                  </li>
                  <li>
                    To Generate Daily Returns You Must click on "Quantify", then
                    click on "Start Trading" wait for few seconds .
                  </li>
                  <li>
                    Invite others to participate and get 5% referral
                    commission✔
                  </li>
                </ol>
                <div className="mt-4 space-y-2">
                  <p>
                    Quantification Trade time: Trading Time at is 11am Taipei
                    Time Zone(UTC +8)
                  </p>
                  <p>Withdrawal days: Fridays Only</p>
                  <p>
                    Note: The stored value is used to open the corresponding
                    level and obtain the current level percentage benefit.
                  </p>
                  <p>
                    For example, if you deposit 100 USDT , the quantitative
                    profit of a single transaction is 100×3%=3 USDT
                  </p>
                </div>
              </div>
              <div className="bg-blue-900/20 p-4 rounded-lg">
                <p className="font-semibold mb-2">Special reminder:</p>
                <p>
                  The first deposit amount of the invitee must be greater than
                  50 USDT!
                </p>
                <p>
                  The bonus can be withdrawn immediately. The more users you
                  recommend, the more commission rewards you will get. The
                  commissions collected from the recommended users will go
                  directly into your member account and you can withdraw them
                  directly!
                </p>
              </div>
              <div className="space-y-4">
                <p className="font-semibold">
                  ------Invite team charging reward--------
                </p>
                <p>1: Get 5% of the deposit of level 1 team members</p>
                <p>
                  The first-level team can receive commission income every day =
                  100*5%*10 people = 120 USDT
                </p>
                <p>
                  Nebrix team daily deposit reward Your team can only deposit
                  the value as a reward within 24 hours
                </p>
                <p className="text-sm text-gray-400">
                  Please note: If you meet the requirements, please contact
                  customer service within 24 hours to claim your reward. Once
                  the deadline has passed, it will be considered invalid and
                  your team must recalculate within 24 hours. The final right of
                  interpretation belongs to this platform.
                </p>
                <p className="text-sm text-gray-400">
                  Nebrix works with bloggers on multiple social platforms (such
                  as Twitter, YouTube, TikTok, Facebook, Instagram, etc.) to
                  promote bloggers' tweets, videos and posts and increase
                  account data (views, clicks, etc.) (Likes, reposts, fans,
                  etc.) Help accounts achieve traffic growth. The final right of
                  interpretation belongs to this platform.
                </p>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DashboardPage;
