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

// Define types for referrals
interface ReferredUser {
  id: number;
  username: string;
  createdAt: string;
}

interface ReferralDetail {
  id: number;
  level: number;
  commission: number;
  referredUser: ReferredUser;
}

interface ProfileResponse {
  profile: any;
  referrals: ReferralDetail[];
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

  // Fetch user's invites and profile data when component mounts
  useEffect(() => {
    if (user) {
      fetchInviteCodes();
      fetchProfileData();

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

  // Fetch profile data including referrals
  const fetchProfileData = async () => {
    try {
      setIsLoadingReferrals(true);
      const res = await apiRequest("GET", "/api/profile");
      const data: ProfileResponse = await res.json();
      setReferrals(data.referrals || []);
    } catch (error) {
      console.error("Error fetching profile data:", error);
      toast({
        title: "Error",
        description: "Failed to load team information",
        variant: "destructive",
      });
    } finally {
      setIsLoadingReferrals(false);
    }
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

        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-black">Your Referral Link</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-gray-400 text-sm">
                Share your referral link and earn multi-level commission when your
                referrals make investments!
              </p>

              <div className="bg-white border border-gray-200 p-3 rounded-lg flex items-center justify-between">
                <input
                  type="text"
                  value={referralLink}
                  readOnly
                  className="bg-transparent text-[#4F9CF9] flex-1 mr-2 overflow-hidden text-ellipsis"
                />
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      copyToClipboard(referralLink);
                      setLinkCopied(true);
                      setTimeout(() => setLinkCopied(false), 2000);
                    }}
                    className="text-black hover:text-[#4F9CF9] transition-colors"
                  >
                    {linkCopied ? (
                      <span className="text-green-500">Copied!</span>
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => shareReferralLink()}
                    className="text-black hover:text-[#4F9CF9] transition-colors"
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {qrCodeUrl && (
                <div className="flex justify-center mt-4">
                  <img
                    src={qrCodeUrl}
                    alt="Referral QR Code"
                    className="w-32 h-32"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>;
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
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Logo size="small" />
          </div>
        </div>
      </header>

      <div className="px-4 space-y-6">
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-black">{t('invite.totalEarnings')}</CardTitle>
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
                  <span className="text-black">Commission Rate</span>
                </div>
                <span className="text-[#4F9CF9] font-bold">
                  5%
                </span>
              </div>

              <div className="bg-[#4F9CF9]/10 p-3 rounded-lg border border-[#4F9CF9]/30">
                <p className="text-[#4F9CF9] font-semibold mb-2">
                  Multi-Level Referral System
                </p>
                <div className="space-y-1 text-sm text-black">
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
              
              <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                <p className="text-green-700 font-semibold mb-1">
                  💰 Weekly Salary Bonus
                </p>
                <p className="text-sm text-green-600">
                  Earn 10% of your total referral income (Mon-Fri) as salary every Saturday!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-black">Your Referral Link</CardTitle>
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
              <div className="bg-white border border-gray-200 p-4 rounded-lg space-y-4">
                <div className="flex items-center justify-between bg-white border border-gray-200 p-3 rounded">
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

        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-black">My Team</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingReferrals ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-[#4F9CF9]" />
              </div>
            ) : referrals.length > 0 ? (
              <div className="space-y-4">
                <p className="text-gray-400 text-sm">
                  Referral Earnings - Commission from your team investments
                </p>
                
                {(() => {
                  const totalPages = Math.ceil(referrals.length / itemsPerPage);
                  const startIndex = (currentPage - 1) * itemsPerPage;
                  const endIndex = startIndex + itemsPerPage;
                  const currentReferrals = referrals.slice(startIndex, endIndex);
                  
                  return (
                    <>
                      <div className="space-y-2">
                        {currentReferrals.map((referral, index) => {
                          // Calculate commission based on tier percentages
                          const tierPercentages = [5, 3, 2, 1]; // Tier 1: 5%, Tier 2: 3%, etc.
                          const tierPercentage = tierPercentages[referral.level - 1] || 0;
                          const commissionAmount = (referral.totalDeposits || 0) * (tierPercentage / 100);
                          
                          return (
                            <div key={referral.id} className="flex items-center justify-between py-2 border-b border-gray-700">
                              <div className="flex items-center space-x-3">
                                <span className="text-gray-400 text-sm w-8">
                                  {startIndex + index + 1})
                                </span>
                                <div className="bg-gray-50 w-8 h-8 rounded-full flex items-center justify-center">
                                  <User className="h-4 w-4 text-[#4F9CF9]" />
                                </div>
                                <div>
                                  <p className="text-black font-medium">
                                    {referral.referredUser.username}(${commissionAmount.toFixed(2)}) Tier {referral.level}
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    Deposited: ${referral.totalDeposits || 0}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      {totalPages > 1 && (
                        <div className="flex justify-center items-center space-x-2 mt-4">
                          <button
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1 bg-gray-700 text-black rounded disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Previous
                          </button>
                          <span className="text-gray-400 text-sm">
                            Page {currentPage} of {totalPages}
                          </span>
                          <button
                            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1 bg-gray-700 text-black rounded disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <p>You haven't invited anyone yet</p>
                <p className="mt-2 text-sm">
                  Share your invite code with unlimited friends to earn
                  commissions!{" "}
                  {user?.isCountryRep
                    ? "Multi-level referral system: 5% + 3% + 2% + 1%!"
                    : ""}
                </p>
                <p className="mt-2 text-sm text-[#4F9CF9]">
                  Generational bonuses: 5% (Tier 1), 3% (Tier 2), 2% (Tier 3), 1% (Tier 4)
                  instantly.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
};

export default InvitePage;
