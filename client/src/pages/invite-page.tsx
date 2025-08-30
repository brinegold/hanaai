import React, { useEffect, useState } from "react";
import {
  Bell,
  MessageSquare,
  Copy,
  Share2,
  Loader2,
  Plus,
  User,
  Calendar,
  Users,
  DollarSign,
} from "lucide-react";
import Logo from "@/components/logo";
import BottomNav from "@/components/bottom-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { generateQRCode, formatCurrency } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/hooks/use-language";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

// Define types for referrals
interface ReferredUser {
  id: number;
  username: string;
  email: string;
  createdAt: string;
}

interface ReferralDetail {
  id: number;
  referredId: number;
  level: string;
  commission: number;
  totalDeposits: number;
  displayName: string;
  username: string;
  email: string;
  totalAssets: number;
  rechargeAmount: number;
  commissionAssets: number;
  createdAt: string;
}

interface ReferralSummary {
  tier1: number;
  tier2: number;
  tier3: number;
  tier4: number;
  total: number;
}

interface ProfileResponse {
  profile: any;
  referrals: ReferralDetail[];
}

interface UplineInfo {
  id: number;
  username: string;
  email: string;
  createdAt: string;
}

const InvitePage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [referralLink, setReferralLink] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [inviteCodes, setInviteCodes] = useState<any[]>([]);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [referrals, setReferrals] = useState<ReferralDetail[]>([]);
  const [isLoadingReferrals, setIsLoadingReferrals] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 40;
  const [referralSummary, setReferralSummary] = useState<ReferralSummary>({ tier1: 0, tier2: 0, tier3: 0, tier4: 0, total: 0 });
  const [selectedLevel, setSelectedLevel] = useState<string>('1');
  const [levelReferrals, setLevelReferrals] = useState<ReferralDetail[]>([]);
  const [isLoadingLevel, setIsLoadingLevel] = useState(false);
  const [upline, setUpline] = useState<UplineInfo | null>(null);
  const [isLoadingUpline, setIsLoadingUpline] = useState(false);

  // Fetch user's invites and profile data when component mounts
  useEffect(() => {
    if (user) {
      fetchInviteCodes();
      fetchReferralSummary();
      fetchLevelReferrals('1');
      fetchUpline();

      if (user.referralCode) {
        const link = `${window.location.origin}/auth?ref=${user.referralCode}`;
        setReferralLink(link);
        try {
          setQrCodeUrl(generateQRCode(link));
        } catch (error) {
          console.error("Error generating QR code:", error);
          // Fallback to a default empty QR that won't break the UI
          setQrCodeUrl(
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
          );
        }
      }
    }
  }, [user]);

  // Fetch invite codes from the server
  const fetchInviteCodes = async () => {
    try {
      const res = await apiRequest("GET", "/api/invite-codes");
      const data = await res.json();
      setInviteCodes(data);
    } catch (error) {
      console.error("Error fetching invite codes:", error);
      toast({
        title: "Error",
        description: "Failed to load invite codes",
        variant: "destructive",
      });
    }
  };

  // Fetch referral summary
  const fetchReferralSummary = async () => {
    if (!user) {
      console.log("No user authenticated, skipping referral summary fetch");
      return;
    }
    
    try {
      const res = await apiRequest("GET", "/api/referrals/summary");
      if (!res.ok) {
        throw new Error(`${res.status}: ${res.statusText}`);
      }
      const data: ReferralSummary = await res.json();
      setReferralSummary(data);
    } catch (error) {
      console.error("Error fetching referral summary:", error);
      toast({
        title: "Error",
        description: "Failed to load referral summary. Please try logging in again.",
        variant: "destructive",
      });
    }
  };

  // Fetch referrals for specific level
  const fetchLevelReferrals = async (level: string) => {
    if (!user) {
      console.log("No user authenticated, skipping level referrals fetch");
      setLevelReferrals([]);
      return;
    }
    
    try {
      setIsLoadingLevel(true);
      const res = await apiRequest("GET", `/api/referrals/tier/${level}`);
      if (!res.ok) {
        throw new Error(`${res.status}: ${res.statusText}`);
      }
      const data: ReferralDetail[] = await res.json();
      setLevelReferrals(data);
    } catch (error) {
      console.error("Error fetching level referrals:", error);
      setLevelReferrals([]);
      toast({
        title: "Error",
        description: "Failed to load level referrals. Please try logging in again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingLevel(false);
    }
  };

  // Fetch upline information
  const fetchUpline = async () => {
    if (!user) {
      console.log("No user authenticated, skipping upline fetch");
      setUpline(null);
      return;
    }
    
    try {
      setIsLoadingUpline(true);
      const res = await apiRequest("GET", "/api/upline");
      if (!res.ok) {
        throw new Error(`${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      setUpline(data.upline);
    } catch (error) {
      console.error("Error fetching upline:", error);
      setUpline(null);
      toast({
        title: "Error",
        description: "Failed to load upline information.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingUpline(false);
    }
  };

  // Handle level change
  const handleLevelChange = (level: string) => {
    setSelectedLevel(level);
    fetchLevelReferrals(level);
  };

  // Generate a new invite code
  const generateInviteCode = async () => {
    try {
      setIsGeneratingCode(true);
      // Generate new invite code
      const res = await apiRequest("POST", "/api/invite-code");
      const data = await res.json();

      // Update invite codes list
      setInviteCodes((prev) => [data, ...prev]);

      // Update referral link with new code
      const newLink = `${window.location.origin}/auth?ref=${data.code}`;
      setReferralLink(newLink);

      // Generate new QR code
      try {
        setQrCodeUrl(generateQRCode(newLink));
      } catch (qrError) {
        console.error("Error generating QR code:", qrError);
      }

      toast({
        title: "Success",
        description: "New invite code generated successfully",
      });
    } catch (error) {
      console.error("Error generating invite code:", error);
      toast({
        title: "Error",
        description: "Failed to generate invite code",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const copyToClipboard = (text: string) => {
    if (!text) {
      toast({
        title: "Error",
        description: "No referral link available to copy",
        variant: "destructive",
      });
      return;
    }

    navigator.clipboard.writeText(text).then(
      () => {
        toast({
          title: "Copied!",
          description: "Referral link copied to clipboard",
        });

      },
      (err) => {
        toast({
          title: "Failed to copy",
          description: "Could not copy to clipboard",
          variant: "destructive",
        });
      },
    );
  };

  const shareReferralLink = async () => {
    if (!referralLink) {
      toast({
        title: "Error",
        description: "No referral link available to share",
        variant: "destructive",
      });
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join Nebrix",
          text: "Use my referral link to join Nebrix and earn crypto rewards!",
          url: referralLink,
        });
        toast({
          title: "Shared!",
          description: "Referral link shared successfully",
        });
      } catch (error) {
        toast({
          title: "Share failed",
          description: "Could not share link",
          variant: "destructive",
        });
      }
    } else {
      copyToClipboard(referralLink);
    }
  };

  // Format date to readable format
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
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

      <div className="px-4 space-y-6">
        {/* Upline Information Card */}
        <Card className="bg-black/20 backdrop-blur-md border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <User className="h-5 w-5" />
              My Upline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingUpline ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-[#4F9CF9]" />
              </div>
            ) : upline ? (
              <div className="flex items-center space-x-3 p-3 bg-[#4F9CF9]/10 rounded-lg border border-[#4F9CF9]/30">
                <div className="bg-[#4F9CF9] text-white w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold">
                  {upline.username.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[#4F9CF9] text-lg">
                    {upline.username}
                  </p>
                  <p className="text-sm text-gray-600">
                    Your referrer • Joined {new Date(upline.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                <User className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No upline found</p>
                <p className="text-xs text-gray-400">You joined directly without a referrer</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-gray-200" style={{ backgroundColor: 'rgba(2, 10, 77, 0.9)' }}>
          <CardHeader>
            <CardTitle className="text-white">{t('invite.totalEarnings')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              <p className="text-gray-400 text-sm">
                Your referral code can be used unlimited times. Earn commission
                from each referral when they make investments!
              </p>

              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-[#4F9CF9]/10 flex items-center justify-center mr-3">
                    <span className="text-[#4F9CF9] font-bold">1</span>
                  </div>
                  <span className="text-white">Commission Rate</span>
                </div>
                <span className="text-[#4F9CF9] font-bold">
                  5%
                </span>
              </div>

              <div className="bg-[#4F9CF9]/10 p-3 rounded-lg border border-[#4F9CF9]/30">
                <p className="text-[#4F9CF9] font-semibold mb-2">
                  Uni-Level Referral System
                </p>
                <div className="space-y-1 text-sm text-white">
                  <div className="flex justify-between">
                    <span>Level 1 (Direct):</span>
                    <span className="text-[#4F9CF9] font-medium">5%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Level 2:</span>
                    <span className="text-[#4F9CF9] font-medium">3%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Level 3:</span>
                    <span className="text-[#4F9CF9] font-medium">2%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Level 4:</span>
                    <span className="text-[#4F9CF9] font-medium">1%</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                <p className="text-blue-700 font-semibold mb-1">
                  💰 Daily Referral Withdrawals Available
                </p>
                <p className="text-sm text-blue-600">
                  Withdraw your referral bonuses anytime! No restrictions - available 24/7.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200" style={{ backgroundColor: 'rgba(2, 10, 77, 0.9)' }}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white">Your Referral Link</CardTitle>
            <Button
              onClick={generateInviteCode}
              disabled={isGeneratingCode}
              className="bg-[#4F9CF9] text-[#121212] hover:bg-[#E0B845]"
            >
              {isGeneratingCode ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('invite.copyCode')}
                </>
              )}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-gray-400 text-sm mb-2">
                {t('invite.step1')}
              </p>
              <div className="bg-black/10 border border-white/20 p-4 rounded-lg space-y-4">
                <div className="flex items-center justify-between bg-black/10 border border-white/20 p-3 rounded">
                  <input
                    type="text"
                    value={referralLink}
                    readOnly
                    className="bg-transparent text-[#4F9CF9] flex-1 mr-2 font-mono"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={() => copyToClipboard(referralLink)}
                      className="text-black hover:text-[#4F9CF9] transition-colors p-2 rounded"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => shareReferralLink()}
                      className="text-black hover:text-[#4F9CF9] transition-colors p-2 rounded"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/20 backdrop-blur-md border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="h-5 w-5" />
              My Team
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedLevel} onValueChange={handleLevelChange} className="w-full" >
              <TabsList className="grid w-full grid-cols-4 mb-4" style={{ backgroundColor: 'rgba(14, 26, 129, 0.9)' }}>
                <TabsTrigger value="1" className="flex flex-col items-center gap-1 py-3" >
                  <span className="font-medium">Level 1</span>
                  <Badge variant="secondary" className="text-xs">
                    {referralSummary.tier1}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="2" className="flex flex-col items-center gap-1 py-3">
                  <span className="font-medium">Level 2</span>
                  <Badge variant="secondary" className="text-xs">
                    {referralSummary.tier2}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="3" className="flex flex-col items-center gap-1 py-3">
                  <span className="font-medium">Level 3</span>
                  <Badge variant="secondary" className="text-xs">
                    {referralSummary.tier3}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="4" className="flex flex-col items-center gap-1 py-3">
                  <span className="font-medium">Level 4</span>
                  <Badge variant="secondary" className="text-xs">
                    {referralSummary.tier4}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="1" className="mt-4">
                <LevelReferralList level="1" referrals={levelReferrals} isLoading={isLoadingLevel} />
              </TabsContent>
              <TabsContent value="2" className="mt-4">
                <LevelReferralList level="2" referrals={levelReferrals} isLoading={isLoadingLevel} />
              </TabsContent>
              <TabsContent value="3" className="mt-4">
                <LevelReferralList level="3" referrals={levelReferrals} isLoading={isLoadingLevel} />
              </TabsContent>
              <TabsContent value="4" className="mt-4">
                <LevelReferralList level="4" referrals={levelReferrals} isLoading={isLoadingLevel} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
};

// Component to display referrals for a specific level
const LevelReferralList: React.FC<{
  level: string;
  referrals: ReferralDetail[];
  isLoading: boolean;
}> = ({ level, referrals, isLoading }) => {
  const levelPercentages: { [key: string]: number } = {
    "1": 5,
    "2": 3,
    "3": 2,
    "4": 1,
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-[#4F9CF9]" />
      </div>
    );
  }

  if (referrals.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p className="text-lg font-medium mb-2">No Level {level} Referrals Yet</p>
        <p className="text-sm">
          When users join through your Level {parseInt(level) - 1 || "direct"} referrals, they'll appear here.
        </p>
        <p className="text-xs text-[#4F9CF9] mt-2">
          Earn {levelPercentages[level]}% commission on their investments!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-600">
          Level {level} Referrals ({referrals.length}) - {levelPercentages[level]}% Commission
        </p>
      </div>
      
      {referrals.map((referral, index) => {
        const totalDeposits = Number(referral.totalDeposits || 0);
        const commissionAmount = totalDeposits * (levelPercentages[level] / 100);
        
        return (
          <div key={referral.id} className="bg-black/10 rounded-lg p-4 border border-white/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-[#4F9CF9] text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-white">
                      {referral.displayName || referral.username || `User${referral.referredId}`}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      Level {level}
                    </Badge>
                  </div>
                  <p className="text-sm text-white/80 mt-1">
                    Joined: {new Date(referral.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              
              <div className="text-right">
                <div className="flex items-center gap-2 mb-1">
                
                  <span className="font-semibold text-green-600">
                    ${commissionAmount.toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-white/60">
                  Deposited: ${totalDeposits.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default InvitePage;
