import React, { useState, useEffect } from "react";
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
import { Copy, CheckCircle, Clock, Wallet } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

interface AutoDepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AutoDepositDialog: React.FC<AutoDepositDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [userWallet, setUserWallet] = useState("");
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [depositStatus, setDepositStatus] = useState<"idle" | "pending" | "verified" | "failed">("idle");
  const [loading, setLoading] = useState(true);

  // Fetch user's unique BSC wallet address
  useEffect(() => {
    const fetchUserWallet = async () => {
      if (!open || !user) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const response = await apiRequest("GET", "/api/bsc/wallet");
        if (response.ok) {
          const data = await response.json();
          setUserWallet(data.address);
        } else {
          throw new Error("Failed to fetch wallet");
        }
      } catch (error) {
        console.error("Error fetching wallet:", error);
        toast({
          title: "Error",
          description: "Failed to load your deposit wallet",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      fetchUserWallet();
    } else {
      setLoading(false);
      setUserWallet("");
    }
  }, [open, user, toast]);

  const handleVerifyDeposit = async () => {
    if (!amount || parseFloat(amount) < 5) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount (minimum 5 USDT)",
        variant: "destructive",
      });
      return;
    }

    if (!txHash.trim()) {
      toast({
        title: "Transaction Hash Required",
        description: "Please enter your transaction hash",
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);
    setDepositStatus("pending");

    try {
      const response = await apiRequest("POST", "/api/bsc/deposit", {
        txHash: txHash.trim(),
        amount: amount,
      });

      if (response.ok) {
        const data = await response.json();
        setDepositStatus("verified");
        
        toast({
          title: "Deposit Verified!",
          description: `${data.amount} USDT has been added to your account (after 5% fee)`,
        });

        // Invalidate queries to refresh user balance
        queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });

        // Close dialog after 2 seconds
        setTimeout(() => {
          onOpenChange(false);
          resetDialog();
        }, 2000);
      } else {
        const errorData = await response.json();
        setDepositStatus("failed");
        toast({
          title: "Verification Failed",
          description: errorData.message || "Transaction could not be verified",
          variant: "destructive",
        });
      }
    } catch (error) {
      setDepositStatus("failed");
      toast({
        title: "Verification Error",
        description: "Failed to verify transaction. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address).then(
      () => {
        toast({
          title: "Copied!",
          description: "Wallet address copied to clipboard",
        });
      },
      (err) => {
        toast({
          title: "Failed to copy",
          description: "Could not copy address to clipboard",
          variant: "destructive",
        });
      },
    );
  };

  const resetDialog = () => {
    setAmount("");
    setTxHash("");
    setDepositStatus("idle");
    setIsVerifying(false);
    setUserWallet("");
    setLoading(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) resetDialog();
        onOpenChange(value);
      }}
    >
      <DialogContent className="bg-white text-black border-gray-200 max-w-md w-[80%] sm:w-full max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-black flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Automatic Deposit
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            Send USDT to your unique wallet address for automatic processing
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Clock className="h-6 w-6 animate-spin text-[#4F9CF9]" />
            <span className="ml-2 text-gray-600">Loading your wallet...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Wallet Address Section */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-3">
                <Wallet className="h-4 w-4 text-[#4F9CF9]" />
                <span className="text-sm font-medium text-gray-800">Your Unique Deposit Address</span>
              </div>
              
              <div className="flex items-center bg-white p-3 rounded-lg border">
                <code className="text-xs text-gray-800 flex-1 font-mono break-all">
                  {userWallet || "Loading..."}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-[#4F9CF9] hover:text-[#E0B83C] hover:bg-transparent ml-2"
                  onClick={() => copyAddress(userWallet)}
                  disabled={!userWallet}
                >
                  <Copy size={16} />
                </Button>
              </div>
            </div>

            {/* Network Information */}
            <div className="bg-white border border-gray-200 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-800 mb-3">Network Information</h3>
              <div className="space-y-2 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Network:</span>
                  <span className="font-medium">BSC (BEP20)</span>
                </div>
                <div className="flex justify-between">
                  <span>Token:</span>
                  <span className="font-medium">USDT</span>
                </div>
                <div className="flex justify-between">
                  <span>Min Deposit:</span>
                  <span className="font-medium">5 USDT</span>
                </div>
                <div className="flex justify-between">
                  <span>Platform Fee:</span>
                  <span className="font-medium">5%</span>
                </div>
                <div className="flex justify-between">
                  <span>Processing:</span>
                  <span className="font-medium text-green-600">Automatic</span>
                </div>
              </div>
            </div>

            {/* Amount Input */}
            <div className="space-y-3">
              <Label htmlFor="amount" className="text-sm font-medium">
                Deposit Amount (USDT)
              </Label>
              <Input
                id="amount"
                type="number"
                min="5"
                step="0.01"
                placeholder="Minimum 5 USDT"
                className="bg-white border-gray-200 text-gray-900"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              
              {/* Fee Calculation Display */}
              {amount && parseFloat(amount) > 0 && (
                <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                  <p className="text-red-600 font-medium text-sm">
                    Deposit Amount To Send = Fee(5%) + Deposit: <strong className='text-blue-600'>
                    {
                      (() => {
                        const depositAmount = parseFloat(amount);
                        const fee = depositAmount * 0.05;
                        const totalToSend = fee + depositAmount;
                        return `${fee.toFixed(2)} + ${depositAmount.toFixed(2)} = ${totalToSend.toFixed(2)} USDT`;
                      })()
                    }</strong> 
                  </p>
                </div>
              )}
              
              <p className="text-xs text-gray-500">
                Enter the amount you're depositing to your unique wallet address
              </p>
            </div>

            {/* Transaction Hash Input */}
            <div className="space-y-3">
              <Label htmlFor="tx-hash" className="text-sm font-medium">
                Transaction Hash (Required for verification)
              </Label>
              <Input
                id="tx-hash"
                placeholder="Enter transaction hash after sending USDT"
                className="bg-white border-gray-200 text-gray-900"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Paste the transaction hash from your wallet after sending USDT
              </p>
            </div>

            {/* Status Display */}
            {depositStatus !== "idle" && (
              <div className={`p-3 rounded-lg border ${
                depositStatus === "verified" 
                  ? "bg-green-50 border-green-200" 
                  : depositStatus === "failed"
                  ? "bg-red-50 border-red-200"
                  : "bg-blue-50 border-blue-200"
              }`}>
                <div className="flex items-center gap-2">
                  {depositStatus === "verified" && <CheckCircle className="h-4 w-4 text-green-600" />}
                  {depositStatus === "pending" && <Clock className="h-4 w-4 animate-spin text-blue-600" />}
                  {depositStatus === "failed" && <div className="h-4 w-4 rounded-full bg-red-600" />}
                  <span className={`text-sm font-medium ${
                    depositStatus === "verified" ? "text-green-800" :
                    depositStatus === "failed" ? "text-red-800" : "text-blue-800"
                  }`}>
                    {depositStatus === "verified" && "Deposit Verified!"}
                    {depositStatus === "pending" && "Verifying Transaction..."}
                    {depositStatus === "failed" && "Verification Failed"}
                  </span>
                </div>
              </div>
            )}

            {/* Action Button */}
            <Button
              className="w-full bg-[#4F9CF9] hover:bg-[#E0B83C] text-black"
              onClick={handleVerifyDeposit}
              disabled={isVerifying || !txHash.trim()}
            >
              {isVerifying ? "Verifying..." : "Verify Deposit"}
            </Button>

            {/* Important Notes */}
            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
              <p className="text-xs text-amber-800 font-medium mb-2">Important Notes:</p>
              <ul className="list-disc list-inside text-xs text-amber-700 space-y-1">
                <li>Only send USDT on BSC (BEP20) network to this address</li>
                <li>Deposits are processed automatically by smart contract</li>
                <li>5% platform fee is deducted automatically</li>
                <li>Your balance updates immediately after verification</li>
              </ul>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AutoDepositDialog;