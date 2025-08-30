import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { AlertTriangle, ArrowDownLeft, CheckCircle, Clock } from "lucide-react";

interface AutoWithdrawDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AutoWithdrawDialog: React.FC<AutoWithdrawDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [securityPassword, setSecurityPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [withdrawStatus, setWithdrawStatus] = useState<"idle" | "processing" | "completed" | "failed">("idle");

  // Calculate available balance and fees
  const availableBalance = user ? parseFloat(user.withdrawableAmount?.toString() || "0") : 0;
  const withdrawalFee = 0.05; // 5% fee
  const maxWithdrawable = Math.max(0, availableBalance * (1 - withdrawalFee));

  const handleWithdraw = async () => {
    const amountNum = parseFloat(amount);

    // Validation
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount to withdraw",
        variant: "destructive",
      });
      return;
    }

    if (amountNum < 1) {
      toast({
        title: "Amount too small",
        description: "Minimum withdrawal amount is 5 USDT",
        variant: "destructive",
      });
      return;
    }

    if (amountNum > availableBalance) {
      toast({
        title: "Insufficient balance",
        description: `Maximum available: ${availableBalance.toFixed(2)} USDT`,
        variant: "destructive",
      });
      return;
    }

    if (!address || address.length < 10) {
      toast({
        title: "Invalid address",
        description: "Please enter a valid BSC wallet address",
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
    setWithdrawStatus("processing");

    try {
      // Submit withdrawal request for admin approval
      const response = await apiRequest("POST", "/api/bsc/withdraw", {
        amount: amountNum,
        walletAddress: address,
        securityPassword: securityPassword,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Withdrawal request failed");
      }

      const data = await response.json();
      setWithdrawStatus("completed");

      toast({
        title: "Withdrawal Request Submitted!",
        description: `Your withdrawal request for ${data.netAmount} USDT has been submitted and is awaiting admin approval.`,
      });

      // Invalidate queries to refresh user balance and transactions
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });

      // Close dialog after 3 seconds
      setTimeout(() => {
        onOpenChange(false);
        resetDialog();
      }, 3000);

    } catch (error) {
      setWithdrawStatus("failed");
      toast({
        title: "Withdrawal Request Failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetMaxAmount = () => {
    setAmount(availableBalance.toString());
  };

  const resetDialog = () => {
    setAmount("");
    setAddress("");
    setSecurityPassword("");
    setWithdrawStatus("idle");
    setSubmitting(false);
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={(value) => {
        if (!value) resetDialog();
        onOpenChange(value);
      }}
    >
      <DialogContent className="bg-white text-gray-900 border-gray-200 max-w-md w-[80%] sm:w-full max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-black flex items-center gap-2">
            <ArrowDownLeft className="h-5 w-5" />
            Withdrawal Request
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            Submit withdrawal request for admin approval
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Balance Information */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
            <h3 className="text-sm font-medium text-gray-800 mb-3">Withdrawal Information</h3>
            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Withdrawables:</span>
                <span className="font-medium text-green-600 text-sm">${availableBalance.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Withdrawal Fee:</span>
                <span className="font-medium text-red-600">5%</span>
              </div>
              <div className="flex justify-between">
                <span>Network:</span>
                <span className="font-medium">BSC (BEP20)</span>
              </div>
              <div className="flex justify-between">
                <span>Processing:</span>
                <span className="font-medium text-orange-600">Admin Approval Required</span>
              </div>
              <div className="flex justify-between">
                <span>Gas Fee:</span>
                <span className="font-medium text-red-600">$1</span>
              </div>
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label htmlFor="amount" className="text-sm font-medium">
                Withdrawal Amount (USDT)
              </Label>
              <button
                type="button"
                className="text-xs text-[#4F9CF9] hover:text-[#E0B83C] font-medium"
                onClick={handleSetMaxAmount}
              >
                MAX
              </button>
            </div>
            <Input
              id="amount"
              type="number"
              min="1"
              step="0.01"
              placeholder="Minimum 5 USDT"
              className="bg-white border-gray-200 text-gray-900"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {amount && (
              <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                <div className="text-xs text-red-600 space-y-1">
                  <div className="flex justify-between">
                    <span>Withdrawal Fee (5%):</span>
                    <span className="font-medium">{(parseFloat(amount) * 0.05).toFixed(2)} USDT</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Gas Fee:</span>
                    <span className="font-medium">1.00 USDT</span>
                  </div>
                  <div className="flex justify-between border-t border-red-200 pt-1">
                    <span className="font-medium text-green-600">You'll receive:</span>
                    <span className="font-bold">{Math.max(0, parseFloat(amount) - (parseFloat(amount) * 0.05) - 1).toFixed(2)} USDT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Deducted from balance:</span>
                    <span className="font-bold">{parseFloat(amount).toFixed(2)} USDT</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Destination Address */}
          <div className="space-y-3">
            <Label htmlFor="address" className="text-sm font-medium">
              Destination BSC Address
            </Label>
            <Input
              id="address"
              placeholder="0x... (BSC/BEP20 wallet address)"
              className="bg-white border-gray-200 text-gray-900 font-mono text-sm"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          {/* Security Password */}
          <div className="space-y-3">
            <Label htmlFor="security-password" className="text-sm font-medium">
              Security Password
            </Label>
            <Input
              id="security-password"
              type="password"
              placeholder="Enter your security password"
              className="bg-white border-gray-200 text-gray-900"
              value={securityPassword}
              onChange={(e) => setSecurityPassword(e.target.value)}
            />
          </div>

          {/* Status Display */}
          {withdrawStatus !== "idle" && (
            <div className={`p-3 rounded-lg border ${
              withdrawStatus === "completed" 
                ? "bg-green-50 border-green-200" 
                : withdrawStatus === "failed"
                ? "bg-red-50 border-red-200"
                : "bg-blue-50 border-blue-200"
            }`}>
              <div className="flex items-center gap-2">
                {withdrawStatus === "completed" && <CheckCircle className="h-4 w-4 text-green-600" />}
                {withdrawStatus === "processing" && <Clock className="h-4 w-4 animate-spin text-blue-600" />}
                {withdrawStatus === "failed" && <div className="h-4 w-4 rounded-full bg-red-600" />}
                <span className={`text-sm font-medium ${
                  withdrawStatus === "completed" ? "text-green-800" :
                  withdrawStatus === "failed" ? "text-red-800" : "text-blue-800"
                }`}>
                  {withdrawStatus === "completed" && "Withdrawal Completed!"}
                  {withdrawStatus === "processing" && "Processing Withdrawal..."}
                  {withdrawStatus === "failed" && "Withdrawal Failed"}
                </span>
              </div>
            </div>
          )}

          {/* Action Button */}
          <Button
            className="w-full bg-[#4F9CF9] hover:bg-[#E0B83C] text-black"
            onClick={handleWithdraw}
            disabled={submitting || !amount || !address || !securityPassword}
          >
            {submitting ? "Submitting Request..." : "Submit Withdrawal Request"}
          </Button>

          {/* Warning */}
          <div className="bg-red-50 p-3 rounded-lg border border-red-200 flex items-start space-x-3">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs text-red-800 font-medium">Important Warning:</p>
              <p className="text-xs text-red-700">
                Double-check your BSC wallet address. Your withdrawal request will be reviewed by an admin before processing. 
                Incorrect addresses will result in permanent loss of funds once approved.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AutoWithdrawDialog;