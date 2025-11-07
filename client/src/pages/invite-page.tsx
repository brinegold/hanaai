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
          title: "Join Hana",
          text: "Use my referral link to join Hana and earn crypto rewards!",
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
                  <p className="font-semibold text-black text-lg">
                    {upline.username}
                  </p>
                  <p className="text-sm text-black">
                    Your referrer • Joined {new Date(upline.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-white">
                <User className="h-12 w-12 mx-auto mb-2 text-white" />
                <strong className="text-sm">No upline found</strong><br></br>
                <strong className="text-xs text-white">You joined directly without a referrer</strong>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-gray-200" style={{ backgroundColor: 'rgba(45, 27, 105, 0.9)' }}>
          <CardHeader>
            <CardTitle className="text-white">{t('invite.totalEarnings')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              <p className="text-white text-sm">
                Your referral code can be used unlimited times. Earn $10 bonus
                for every 3 friends who deposit $12 each!
              </p>

              <div className="bg-[#4F9CF9]/10 p-4 rounded-lg border border-[#4F9CF9]/30">
                <p className="text-[#4F9CF9] font-semibold mb-3 text-lg">
                  💰 Simple Referral Bonus
                </p>
                <div className="space-y-3 text-white">
                  <div className="flex items-center gap-3">
                    <div className="bg-[#4F9CF9] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">
                      1
                    </div>
                    <span>Share your referral link with friends</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-[#4F9CF9] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">
                      2
                    </div>
                    <span>They deposit $12 ($10 to account + $2 fee)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-[#4F9CF9] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">
                      3
                    </div>
                    <span className="font-bold text-yellow-300">Every 3 referrals = $10 bonus for you!</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                <p className="text-blue-700 font-semibold mb-1">
                  ✅ Instant Withdrawals Available
                </p>
                <p className="text-sm text-blue-600">
                  Withdraw your referral bonuses anytime! No restrictions - available 24/7.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200" style={{ backgroundColor: 'rgba(45, 27, 105, 0.9)' }}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white">Your Referral Link</CardTitle>
    
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-white text-sm mb-2">
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
                      className="text-yellow-500 hover:text-yellow-500 transition-colors p-2 rounded"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => shareReferralLink()}
                      className="text-yellow-500 hover:text-yellow-500 transition-colors p-2 rounded"
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
            <CardTitle className="text-black flex items-center gap-2">
              <Users className="h-5 w-5" />
              My Direct Referrals
            </CardTitle>
            <p className="text-sm text-white mt-2">
              Total Referrals: <span className="font-bold text-[#4F9CF9]">{referralSummary.tier1}</span>
              {" • "}
              Bonuses Earned: <span className="font-bold text-yellow-300">${Math.floor(referralSummary.tier1 / 3) * 10}</span>
            </p>
          </CardHeader>
          <CardContent>
            <LevelReferralList level="1" referrals={levelReferrals} isLoading={isLoadingLevel} />
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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  
  const levelPercentages: { [key: string]: number } = {
    "1": 10,
    "2": 5,
    "3": 3,
    "4": 2,
  };

  // Reset to first page when level changes or referrals change
  useEffect(() => {
    setCurrentPage(1);
  }, [level, referrals.length]);

  // Calculate pagination
  const totalPages = Math.ceil(referrals.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentReferrals = referrals.slice(startIndex, endIndex);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
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
      <div className="text-center py-8 text-black">
        <Users className="h-12 w-12 mx-auto mb-4 text-black" />
        <p className="text-lg font-medium mb-2">No Direct Referrals Yet</p>
        <p className="text-sm">
          Share your referral link with friends to start earning!
        </p>
        <p className="text-xs text-white mt-2">
          Earn $10 for every 3 friends who deposit $12!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {currentReferrals.map((referral, index) => {
          const totalDeposits = Number(referral.totalDeposits || 0);
          const hasDeposited = totalDeposits >= 10; // Check if they deposited $12 (which shows as $10 after fee)
          const globalIndex = startIndex + index + 1;
          
          return (
            <div key={referral.id} className="bg-black/10 rounded-lg p-4 border border-white/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="bg-[#4F9CF9] text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium">
                    {globalIndex}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-white">
                        {referral.displayName || referral.username || `User${referral.referredId}`}
                      </p>
                      {hasDeposited ? (
                        <Badge variant="outline" className="text-xs bg-green-500/20 border-green-500 text-green-400">
                          ✓ Qualified
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-yellow-500/20 border-yellow-500 text-yellow-400">
                          Pending Deposit
                        </Badge>
                      )}
                    </div>
                    <strong className="text-sm text-yellow-300 mt-1">
                      Joined: {new Date(referral.createdAt).toLocaleDateString()}
                    </strong>
                  </div>
                </div>
                
                <div className="text-right">
                  {hasDeposited ? (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#66ff00]">
                        ✓ $10
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400">
                      No deposit yet
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/20">
          <div className="text-sm text-white">
            Showing {startIndex + 1}-{Math.min(endIndex, referrals.length)} of {referrals.length} referrals
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className="bg-black/20 border-white/20 text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </Button>
            <span className="text-sm text-white px-3">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="bg-black/20 border-white/20 text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next Page
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvitePage;
