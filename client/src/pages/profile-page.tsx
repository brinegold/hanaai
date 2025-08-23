import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  MessageSquare,
  Wallet,
  RefreshCcw,
  History,
  ShieldCheck,
  Book,
  Newspaper,
  Globe,
  HelpCircle,
  Info,
  Download,
  ArrowLeft,
  Crown,
} from "lucide-react";
import Logo from "@/components/logo";
import BottomNav from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLanguage } from "@/hooks/use-language";
import RechargeDialog from "@/components/recharge-dialog";
import WithdrawDialog from "@/components/withdraw-dialog";
import SecurityCenterDialog from "@/components/security-center-dialog";
import ComingSoonDialog from "@/components/coming-soon-dialog";
import LanguageSettingsDialog from "@/components/language-settings-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useUser } from "../hooks/useUser";
import { format } from "date-fns";

const ProfilePage: React.FC = () => {
  const { user, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();

  // State for dialogs
  const [rechargeDialogOpen, setRechargeDialogOpen] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [aboutDialogOpen, setAboutDialogOpen] = useState(false);
  const [tutorialDialogOpen, setTutorialDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [notificationsDialogOpen, setNotificationsDialogOpen] = useState(false);
  const [messagesDialogOpen, setMessagesDialogOpen] = useState(false);
  const [securityCenterOpen, setSecurityCenterOpen] = useState(false);
  const [comingSoonOpen, setComingSoonOpen] = useState(false);
  const [comingSoonTitle, setComingSoonTitle] = useState("");
  const [languageSettingsOpen, setLanguageSettingsOpen] = useState(false);
  const [showTibankInfo, setShowTibankInfo] = useState(false);

  // Fetch notifications when component mounts or user changes
  useEffect(() => {
    const fetchNotifications = async () => {
      if (user) {
        try {
          await queryClient.invalidateQueries({ queryKey: ["/api/account"] });
          await queryClient.refetchQueries({ queryKey: ["/api/account"] });
        } catch (error) {
          console.error("Error fetching notifications:", error);
        }
      }
    };

    fetchNotifications();
  }, [user]);

  const unreadNotificationsCount =
    user?.notifications?.filter((notification: any) => !notification.isRead)
      .length || 0;

  // Calculate unread messages count
  const unreadMessagesCount =
    user?.messages?.filter((message: any) => !message.isRead).length || 0;

  // Additional dialogs for notifications and messages

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    setLocation("/auth");
  };

  const handleRechargeClick = () => {
    setRechargeDialogOpen(true);
  };

  const handleWithdrawClick = () => {
    setWithdrawDialogOpen(true);
  };

  const handleAboutClick = () => {
    // Open the about.pdf file
    window.open("/src/about.pdf", "_blank");
  };

  // Handler for Quantization Tutorial click
  const handleTutorialClick = () => {
    // Open the Nebrix AI Trading dialog
    setShowTibankInfo(true);
  };

  // Handler for Security Center click
  const handleSecurityCenterClick = () => {
    setSecurityCenterOpen(true);
  };

  // Handler for Language Settings click
  const handleLanguageSettingsClick = () => {
    setLanguageSettingsOpen(true);
  };

  // Handler for Coming Soon items
  const handleComingSoonClick = (title: string) => {
    setComingSoonTitle(title);
    setComingSoonOpen(true);
  };
  // Mark all notifications as read when opening notifications dialog
  const handleOpenNotifications = () => {
    setNotificationsDialogOpen(true);
    // In a real app, you would call an API to mark notifications as read
  };

  // Mark all messages as read when opening messages dialog
  const handleOpenMessages = () => {
    setMessagesDialogOpen(true);
    // In a real app, you would call an API to mark messages as read
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-white pb-24">
        <header className="bg-white border-b border-gray-200 p-4 mb-4">
          <Skeleton className="h-10 w-full" />
        </header>
        <div className="space-y-4 px-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-60 w-full" />
        </div>
      </div>
    );
  }

  // Function to format addresses for display
  const formatAddress = (address: string | undefined) => {
    if (!address) return "-";
    return address.length > 12
      ? `${address.slice(0, 6)}...${address.slice(-6)}`
      : address;
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Verification Alert */}
      {user && user.verificationStatus === "unverified" && (
        <div className="bg-blue-900/20 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="h-5 w-5 text-blue-500" />
              <p className="text-blue-500">
                Please verify your identity to unlock all features
              </p>
            </div>
            <Button
              variant="outline"
              className="text-blue-500 border-blue-500 hover:bg-blue-900/20"
              onClick={() => setLocation("/verify")}
            >
              Verify Now
            </Button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Logo size="small" />
            <h1 className="text-xl font-semibold text-gray-900">
              {t('profile.welcome')}
            </h1>
          </div>
          <div className="flex items-center space-x-3"></div>
        </div>
      </header>

      {/* User Account Info */}
      <div className="bg-white border border-gray-200 rounded-lg mx-4 mb-6 p-4">
        <div className="flex items-center mb-4">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-[#4F9CF9]/20 flex items-center justify-center mr-3">
              <User className="h-5 w-5 text-[#4F9CF9]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-gray-900 font-medium">{user.username}</span>
                {user.isCountryRep ? (
                  <span className="px-1.5 py-0.5 rounded-full bg-yellow-900/20 text-yellow-500 text-xs flex items-center gap-1">
                    <Crown className="h-3 w-3" /> Country Representative
                  </span>
                ) : user.verificationStatus === "verified" ? (
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded-full bg-green-900/20 text-green-500 text-xs">
                      Verified
                    </span>
                    {user.countryRepStatus === "pending" && (
                      <span className="text-xs text-blue-500">
                        C.Rep Application Pending
                      </span>
                    )}
                  </div>
                ) : user.verificationStatus === "pending" ? (
                  <span className="px-1.5 py-0.5 rounded-full bg-blue-900/20 text-blue-500 text-xs">
                    Pending
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded-full bg-blue-900/20 text-blue-500 text-xs">
                    Unverified
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-400">Copy</div>
            </div>
          </div>
        </div>

        {/* Assets Overview */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <div className="text-gray-400 text-sm">{t('profile.totalAssets')}</div>
            <div className="text-gray-900 font-medium">
              {parseFloat(user.totalAssets.toString()).toFixed(2)}
            </div>
          </div>
          <div className="flex justify-between items-center">
            <div className="text-gray-400 text-sm">{t('profile.profitAssets')}</div>
            <div className="text-gray-900 font-medium">
              {parseFloat(user.profitAssets.toString()).toFixed(2)}
            </div>
          </div>
          <div className="flex justify-between items-center">
            <div className="text-gray-400 text-sm">{t('profile.depositAmount')}</div>
            <div className="text-gray-900 font-medium">
              {parseFloat(user.rechargeAmount.toString()).toFixed(2)}
            </div>
          </div>
          <div className="flex justify-between items-center">
            <div className="text-gray-400 text-sm">{t('profile.withdrawable')}</div>
            <div className="text-gray-900 font-medium">
              {parseFloat(user.withdrawableAmount.toString()).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-around mt-6">
          <button
            className="flex flex-col items-center"
            onClick={handleRechargeClick}
          >
            <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-1 text-blue-500">
              <Wallet className="h-5 w-5" />
            </div>
            <span className="text-xs text-gray-300">{t('profile.deposit')}</span>
          </button>
          <button
            className="flex flex-col items-center"
            onClick={handleWithdrawClick}
          >
            <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-1 text-blue-500">
              <RefreshCcw className="h-5 w-5" />
            </div>
            <span className="text-xs text-gray-300">{t('profile.withdraw')}</span>
          </button>
          <button
            className="flex flex-col items-center"
            onClick={() => setHistoryDialogOpen(true)}
          >
            <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-1 text-blue-500">
              <History className="h-5 w-5" />
            </div>
            <span className="text-xs text-gray-300">{t('profile.detail')}</span>
          </button>

          {/* History Dialog - Made Responsive */}
          <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
            <DialogContent className="bg-white text-gray-900 border-gray-200 max-w-2xl w-[90vw] p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle className="text-gray-900">
                  Account Details
                </DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="transactions" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger
                    value="transactions"
                    className="text-xs sm:text-sm"
                  >
                    Transactions
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="transactions">
                  <ScrollArea className="h-[60vh] sm:h-[50vh]">
                    <div className="overflow-x-auto">
                      {/* Mobile View (List View) */}
                      <div className="block sm:hidden">
                        {user?.transactions?.length > 0 ? (
                          <div className="space-y-4">
                            {user.transactions.map((tx: any) => (
                              <div
                                key={tx.id}
                                className="bg-gray-50 p-3 rounded-lg"
                              >
                                <div className="flex justify-between items-center mb-2">
                                  <span className="font-medium">{tx.type}</span>
                                  <span
                                    className={
                                      tx.type === "Withdrawal"
                                        ? "text-red-500"
                                        : "text-green-500"
                                    }
                                  >
                                    {tx.type === "Withdrawal" ? "-" : "+"}$
                                    {parseFloat(tx.amount).toFixed(2)}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div>
                                    <p className="text-gray-400">Status</p>
                                    <p
                                      className={`px-2 py-1 rounded text-xs inline-block mt-1 ${
                                        tx.status === "Completed"
                                          ? "bg-green-500/20 text-green-500"
                                          : tx.status === "Failed"
                                            ? "bg-red-500/20 text-red-500"
                                            : "bg-yellow-500/20 text-yellow-500"
                                      }`}
                                    >
                                      {tx.status}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-gray-400">Network</p>
                                    <p>{tx.network || "-"}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-400">Address</p>
                                    <p className="truncate">
                                      {formatAddress(tx.address)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-gray-400">Date</p>
                                    <p>
                                      {new Date(
                                        tx.createdAt,
                                      ).toLocaleDateString()}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-gray-400">
                            No transactions found
                          </div>
                        )}
                      </div>

                      {/* Desktop View (Table) */}
                      <div className="hidden sm:block">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Type</TableHead>
                              <TableHead>Amount</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Address</TableHead>
                              <TableHead>Network</TableHead>
                              <TableHead>Date</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {user?.transactions?.length > 0 ? (
                              user.transactions.map((tx: any) => (
                                <TableRow key={tx.id}>
                                  <TableCell>{tx.type}</TableCell>
                                  <TableCell>
                                    <span
                                      className={
                                        tx.type === "Withdrawal"
                                          ? "text-red-500"
                                          : "text-green-500"
                                      }
                                    >
                                      {tx.type === "Withdrawal" ? "-" : "+"}$
                                      {parseFloat(tx.amount).toFixed(2)}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <span
                                      className={`px-2 py-1 rounded ${
                                        tx.status === "Completed"
                                          ? "bg-green-500/20 text-green-500"
                                          : tx.status === "Failed"
                                            ? "bg-red-500/20 text-red-500"
                                            : "bg-yellow-500/20 text-yellow-500"
                                      } text-black`}
                                    >
                                      {tx.status}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    {formatAddress(tx.address)}
                                  </TableCell>
                                  <TableCell>{tx.network || "-"}</TableCell>
                                  <TableCell>
                                    {new Date(tx.createdAt).toLocaleString()}
                                  </TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center">
                                  No transactions found
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Verification Banner */}
      <div className="bg-white border border-gray-200 rounded-lg mx-4 mb-6 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={`w-10 h-10 rounded-full ${user.verificationStatus === "verified" ? "bg-green-500/20" : "bg-blue-500/20"} flex items-center justify-center`}
            >
              <ShieldCheck
                className={`h-5 w-5 ${user.verificationStatus === "verified" ? "text-green-500" : "text-blue-500"}`}
              />
            </div>
            <div>
              <div className="text-gray-900 font-medium">Account Status</div>
              <div className="text-sm text-gray-400">
                Verification required for full access
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            className={`${user.verificationStatus === "verified" ? "text-green-500 border-green-500" : "text-blue-500 border-blue-500"}`}
            onClick={() =>
              user.verificationStatus !== "verified" && setLocation("/verify")
            }
          >
            {user.verificationStatus === "verified" ? "Verified" : "Verify Now"}
          </Button>
        </div>
      </div>

      {/* Total Revenue */}
      <div className="bg-white border border-gray-200 rounded-lg mx-4 mb-6 p-4">
        <div className="text-gray-900 font-medium mb-4">Total Revenue</div>
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col items-center">
            <div className="text-gray-400 text-xs mb-1">Commission Today</div>
            <div className="text-gray-900 font-medium">
              {parseFloat(user.commissionToday.toString()).toFixed(2)}
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-gray-400 text-xs mb-1">Today's Earnings</div>
            <div className="text-gray-900 font-medium">
              {parseFloat(user.todayEarnings.toString()).toFixed(2)}
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-gray-400 text-xs mb-1">
              Yesterday's Earnings
            </div>
            <div className="text-gray-900 font-medium">
              {parseFloat(user.yesterdayEarnings.toString()).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Invitation Section */}
      <div className="bg-white border border-gray-200 rounded-lg mx-4 mb-6 p-4">
        <div className="text-gray-900 font-medium">Subordinate Invitation</div>
      </div>

      {/* Menu Options */}
      <div className="bg-white border border-gray-200 rounded-lg mx-4 mb-6">
        <button
          onClick={handleSecurityCenterClick}
          className="flex items-center justify-between p-4 border-b border-[#333333] w-full text-left"
        >
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center mr-3 text-blue-500">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <span className="text-gray-900">{t('profile.securityCenter')}</span>
          </div>
          <ArrowLeft className="h-4 w-4 text-gray-500 transform rotate-180" />
        </button>

        {/* Replace Quantization Tutorial <a> with a button */}
        <button
          onClick={handleTutorialClick}
          className="flex items-center justify-between p-4 border-b border-[#333333] w-full text-left"
        >
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center mr-3 text-blue-500">
              <Book className="h-4 w-4" />
            </div>
            <span className="text-black">{t('profile.quantizationTutorial')}</span>
          </div>
          <ArrowLeft className="h-4 w-4 text-gray-500 transform rotate-180" />
        </button>

        <button
          onClick={() => handleComingSoonClick("News")}
          className="flex items-center justify-between p-4 border-b border-[#333333] w-full text-left"
        >
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center mr-3 text-blue-500">
              <Newspaper className="h-4 w-4" />
            </div>
            <span className="text-black">{t('profile.news')}</span>
          </div>
          <ArrowLeft className="h-4 w-4 text-gray-500 transform rotate-180" />
        </button>

        <button
          onClick={handleLanguageSettingsClick}
          className="flex items-center justify-between p-4 border-b border-[#333333] w-full text-left"
        >
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center mr-3 text-blue-500">
              <Globe className="h-4 w-4" />
            </div>
            <span className="text-black">{t('profile.languageSettings')}</span>
          </div>
          <ArrowLeft className="h-4 w-4 text-gray-500 transform rotate-180" />
        </button>

        <button
          onClick={() => handleComingSoonClick("Common Problem")}
          className="flex items-center justify-between p-4 border-b border-[#333333] w-full text-left"
        >
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center mr-3 text-blue-500">
              <HelpCircle className="h-4 w-4" />
            </div>
            <span className="text-black">{t('profile.commonProblem')}</span>
          </div>
          <ArrowLeft className="h-4 w-4 text-gray-500 transform rotate-180" />
        </button>

        <button
          onClick={handleAboutClick}
          className="flex items-center justify-between p-4 border-b border-[#333333] w-full text-left"
        >
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center mr-3 text-blue-500">
              <Info className="h-4 w-4" />
            </div>
            <span className="text-black">{t('profile.aboutUs')}</span>
          </div>
          <ArrowLeft className="h-4 w-4 text-gray-500 transform rotate-180" />
        </button>

        <button
          onClick={() => handleComingSoonClick("Download APP")}
          className="flex items-center justify-between p-4 w-full text-left"
        >
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center mr-3 text-blue-500">
              <Download className="h-4 w-4" />
            </div>
            <span className="text-black">{t('profile.downloadApp')}</span>
          </div>
          <ArrowLeft className="h-4 w-4 text-gray-500 transform rotate-180" />
        </button>
      </div>

      {/* Logout Button */}
      <div className="mx-4 mb-20">
        <Button
          className="w-full py-6 rounded-lg font-medium bg-gradient-to-r from-[#4F9CF9] to-[#FFCB8E] text-[#121212] hover:opacity-90 transition-opacity"
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
        >
          {logoutMutation.isPending ? "Signing out..." : t('profile.signOut')}
        </Button>
      </div>

      {/* Floating Messages Button */}
      <button
        onClick={() => setMessagesDialogOpen(true)}
        className="fixed bottom-20 right-4 w-12 h-12 rounded-full bg-[#4F9CF9] flex items-center justify-center shadow-lg hover:bg-[#E0B83C] transition-colors"
      >
        <div className="relative">
          <MessageSquare className="h-6 w-6 text-black" />
          {(unreadMessagesCount > 0 || unreadNotificationsCount > 0) && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-black text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {unreadMessagesCount + unreadNotificationsCount}
            </span>
          )}
        </div>
      </button>

      {/* Messages Dialog */}
      <Dialog open={messagesDialogOpen} onOpenChange={setMessagesDialogOpen}>
        <DialogContent className="bg-white text-gray-900 border-gray-200 max-w-2xl w-[90vw]">
          <DialogHeader>
            <DialogTitle>Messages & Notifications</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="notifications" className="w-full">
            <TabsList className="w-full mb-4">
              <TabsTrigger value="notifications" className="flex-1">
                Notifications{" "}
                {unreadNotificationsCount > 0 &&
                  `(${unreadNotificationsCount})`}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="notifications">
              <ScrollArea className="h-[60vh]">
                <div className="space-y-4">
                  {user?.notifications?.map((notification: any) => (
                    <div
                      key={notification.id}
                      className="bg-gray-50 p-3 rounded-lg"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <div className="text-sm text-gray-400">
                          {new Date(notification.createdAt).toLocaleString()}
                        </div>
                        <Badge
                          variant={
                            notification.type === "success"
                              ? "success"
                              : notification.type === "warning"
                                ? "warning"
                                : "default"
                          }
                        >
                          {notification.type || "Info"}
                        </Badge>
                      </div>
                      <div className="text-black">{notification.message}</div>
                      {!notification.isRead && (
                        <div className="mt-2">
                          <Badge variant="secondary">Unread</Badge>
                        </div>
                      )}
                      <div className="flex gap-2 mt-4">
                        {!notification.isRead && (
                          <Button
                            className="flex-1"
                            onClick={async () => {
                              try {
                                await apiRequest(
                                  "POST",
                                  `/api/notifications/${notification.id}/read`,
                                );

                                // Invalidate and refetch the account data
                                await queryClient.invalidateQueries({
                                  queryKey: ["/api/account"],
                                });
                                await queryClient.refetchQueries({
                                  queryKey: ["/api/account"],
                                });

                                toast({
                                  title: "Success",
                                  description: "Notification marked as read",
                                });
                              } catch (error) {
                                toast({
                                  title: "Error",
                                  description:
                                    "Failed to mark notification as read",
                                  variant: "destructive",
                                });
                              }
                            }}
                          >
                            Mark as Read
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          className="flex-1"
                          onClick={async () => {
                            try {
                              await apiRequest(
                                "DELETE",
                                `/api/notifications/${notification.id}`,
                              );
                              await queryClient.invalidateQueries({
                                queryKey: ["/api/account"],
                              });
                              toast({
                                title: "Success",
                                description: "Notification deleted",
                              });
                            } catch (error) {
                              toast({
                                title: "Error",
                                description: "Failed to delete notification",
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                  {(!user?.notifications ||
                    user.notifications.length === 0) && (
                    <div className="text-gray-400 text-center py-4">
                      No notifications yet
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Security Center Dialog */}
      <SecurityCenterDialog
        open={securityCenterOpen}
        onOpenChange={setSecurityCenterOpen}
      />

      {/* Coming Soon Dialog */}
      <ComingSoonDialog
        open={comingSoonOpen}
        onOpenChange={setComingSoonOpen}
        title={comingSoonTitle}
      />

      {/* Language Settings Dialog */}
      <LanguageSettingsDialog
        open={languageSettingsOpen}
        onOpenChange={setLanguageSettingsOpen}
      />

      {/* Recharge Dialog */}
      <RechargeDialog
        open={rechargeDialogOpen}
        onOpenChange={setRechargeDialogOpen}
      />

      {/* Withdraw Dialog */}
      <WithdrawDialog
        open={withdrawDialogOpen}
        onOpenChange={setWithdrawDialogOpen}
      />

      {/* Nebrix Info Dialog */}
      <Dialog open={showTibankInfo} onOpenChange={setShowTibankInfo}>
        <DialogContent className="bg-white border-gray-200 text-gray-900 max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center text-black mb-4">
              Welcome To Nebrix Ai Trading
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <p>
            Nebrix is an advanced AI-powered quantitative trading ecosystem designed to transform the way investors interact with the digital economy. By integrating Hermetic AI, a proprietary trading engine, Nebrix delivers consistent and sustainable returns through adaptive strategies that thrive in the fast-paced crypto market.
            </p>

            <h3 className="text-[#4F9CF9] font-medium mt-4">
              Nebrix automatic Ai money-making function
            </h3>
            <p>
              Nebrix can buy Bitcoin at a low price from Exchange A within 1
              second, and sell it at a high price on Exchange B to make a
              profit.
            </p>
            
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg mt-3">
              <p className="text-blue-700 font-medium text-sm">
                📅 Trading Schedule: Monday to Friday only
              </p>
              <p className="text-blue-600 text-xs mt-1">
                Daily returns are generated on weekdays. No trading activity on weekends.
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
                <p className="text-gray-700">
                  Nebrix executes trades with unparalleled speed and accuracy,
                  operating 24/7 through automated algorithms.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">2. Emotion-Free Trading</h4>
                <p className="text-gray-700">
                  Nebrix uses computer programs and algorithms to ensure
                  consistent trading results without emotional bias.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">3. Advanced Backtesting</h4>
                <p className="text-gray-700">
                  Uses historical market data to customize and optimize trading
                  models for maximum profit.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">4. Strict Discipline</h4>
                <p className="text-gray-700">
                  Helps investors stick to established trading plans and avoid
                  human errors in volatile markets.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">5. Market Trend Analysis</h4>
                <p className="text-gray-700">
                  Real-time analysis of market prospects across multiple
                  cryptocurrency categories.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">6. Decentralized Trading</h4>
                <p className="text-gray-700">
                  Enables diversified trading across multiple exchanges and
                  trading types automatically.
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-600/20 to-blue-500/20 p-4 rounded-lg mt-6">
              <p className="text-center">
                Nebrix has undergone its fourth transformation, expanding
                functionality while simplifying investor transactions. Profits
                can be realized with just one click and waiting for 1-2 minutes.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
};

export default ProfilePage;

// User icon component for profile
function User({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  );
}
