import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { AlertTriangle } from "lucide-react";

interface WithdrawDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const WithdrawDialog: React.FC<WithdrawDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [network, setNetwork] = useState<"bsc">("bsc");
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [securityPassword, setSecurityPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Calculate maximum amount that can be withdrawn (total assets - 10% fee)
  const maxAmount = user
    ? Math.max(0, parseFloat(user.withdrawableAmount.toString()) * 0.9)
    : 0;

  const handleWithdraw = async () => {
    const amountNum = parseFloat(amount);

    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount to withdraw",
        variant: "destructive",
      });
      return;
    }

    // Withdrawals are available every day - no day restriction

    if (amountNum < 1) {
      toast({
        title: "Amount too small",
        description: "Minimum withdrawal amount is 1 USDT",
        variant: "destructive",
      });
      return;
    }

    if (amountNum > maxAmount) {
      toast({
        title: "Insufficient balance",
        description: `Maximum withdrawal amount is ${maxAmount.toFixed(2)} USDT (after 10% fee)`,
        variant: "destructive",
      });
      return;
    }

    if (!address) {
      toast({
        title: "Missing address",
        description: "Please enter your withdrawal address",
        variant: "destructive",
      });
      return;
    }

    if (!securityPassword) {
      toast({
        title: "Security verification required",
        description: "Please enter your security password",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      // First verify security password
      const verifyResponse = await apiRequest(
        "POST",
        "/api/verify-security-password",
        {
          securityPassword,
        },
      );

      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json();
        throw new Error(errorData.message || "Invalid security password");
      }

      // Create withdrawal transaction
      const response = await apiRequest("POST", "/api/transactions", {
        type: "Withdrawal",
        amount: amountNum,
        status: "Pending",
        network: network.toUpperCase(),
        address: address,
        fee: amountNum * 0.1, // 10% fee
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Withdrawal failed");
      }

      // Success
      toast({
        title: "Withdrawal Submitted",
        description:
          "Your withdrawal request has been received and is being processed.",
      });

      // Invalidate queries that might be affected
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });

      // Close dialog
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Withdrawal Failed",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetMaxAmount = () => {
    setAmount(maxAmount.toString());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white text-gray-900 border-gray-200 max-w-md w-[80%] sm:w-full max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-black">Withdraw USDT</DialogTitle>
          <DialogDescription className="text-gray-400">
            Withdraw funds from your account
          </DialogDescription>
        </DialogHeader>

        <div className="w-full">
          <div className="bg-[#4F9CF9] text-black text-center py-2 px-4 rounded-md mb-4">
            USDT-BEP20 (BSC)
          </div>

          <div className="mt-4">
            <div className="space-y-4">
              <div className="bg-white border border-gray-200 p-3 rounded-lg">
                <p className="text-sm text-gray-300 mb-2">
                  Withdrawal Information
                </p>
                <p className="text-xs text-gray-400">
                  USDT on Binance Smart Chain (BEP20)
                </p>
                <p className="text-xs text-gray-400">Min withdrawal: 1 USDT</p>
                <p className="text-xs text-gray-400">Fee: 10%</p>
                <p className="text-xs text-gray-400">
                  Available every day.
                </p>
                <p className="text-xs text-gray-400">
                  Note: 10% of your Referrals bonus can only be withdraw every Saturdays
                </p>
                <p className="text-xs text-gray-400">
                  Processing time: 6-24 hours
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="bsc-amount">Amount (USDT)</Label>
                  <button
                    type="button"
                    className="text-xs text-[#4F9CF9] hover:text-[#E0B83C]"
                    onClick={handleSetMaxAmount}
                  >
                    MAX
                  </button>
                </div>
                <Input
                  id="bsc-amount"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Minimum 1 USDT"
                  className="bg-white border-gray-200 text-gray-900"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <p className="text-xs text-gray-400 flex justify-between">
                  <span>
                    Available:{" "}
                    {parseFloat(user?.withdrawableAmount?.toString() || "0").toFixed(
                      2,
                    )}{" "}
                    USDT
                  </span>
                  <span>Fee: 10%</span>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bsc-address">BSC (BEP20) Address</Label>
                <Input
                  id="bsc-address"
                  placeholder="Enter your BSC wallet address"
                  className="bg-white border-gray-200 text-gray-900"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="security-password">Security Password</Label>
            <Input
              id="security-password"
              type="password"
              placeholder="Enter your security password"
              className="bg-white border-gray-200 text-gray-900"
              value={securityPassword}
              onChange={(e) => setSecurityPassword(e.target.value)}
            />
          </div>

          <div className="space-y-4">
            <div className="bg-blue-900/20 p-3 rounded-lg border border-blue-600/30 flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-blue-900 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm text-blue-900">Important:</p>
                <p className="text-xs text-blue-700">
                  Make sure the address is correct and supports BSC (BEP20) network.
                  Sending to the wrong network may result in permanent loss of
                  funds.
                </p>
              </div>
            </div>

            <div className="bg-red-900/20 p-3 rounded-lg border border-red-600/30">
              <p className="text-xs text-red-900">
                WARNING: The admin is not liable for any loss of funds due to
                incorrect wallet addresses. Double check your wallet address
                before submitting. This action cannot be undone.
              </p>
            </div>
          </div>

          <Button
            className="w-full bg-[#4F9CF9] hover:bg-[#E0B83C] text-black"
            onClick={handleWithdraw}
            disabled={submitting}
          >
            {submitting ? "Processing..." : "Withdraw"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WithdrawDialog;