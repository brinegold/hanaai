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
import { Copy } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

interface RechargeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RechargeDialog: React.FC<RechargeDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [network, setNetwork] = useState<"bsc">("bsc");
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<"amount" | "address">("amount");
  const [address, setAddress] = useState("");
  const [txId, setTxId] = useState(""); // Added state for transaction ID

  // These would typically come from your backend in a real implementation
  const addresses = {
    tron: "TBMnamBQLj3Cy9aC1eZm2hfBT8u7odsgfr",
    bsc: "0xf0d3b31fe7dddf2cde60497e8e94b8187a68cbe2",
  };

  const handleRecharge = async () => {
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount to deposit",
        variant: "destructive",
      });
      return;
    }

    setStep("address");

    // In a real implementation, you would create a transaction record on your backend
    try {
      await apiRequest("POST", "/api/transactions", {
        type: "Deposit",
        amount: parseFloat(amount),
        status: "Pending",
        network: network.toUpperCase(),
        address: address,
        txHash: txId || null,
      });

      // Invalidate queries that might be affected
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
    } catch (error) {
      console.error("Error creating transaction record:", error);
    }
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address).then(
      () => {
        toast({
          title: "Copied!",
          description: "Address copied to clipboard",
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
    setStep("amount");
    setAmount("");
    setTxId(""); // Reset txId on reset
    setAddress(""); //Reset Address on reset
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) resetDialog();
        onOpenChange(value);
      }}
    >
      <DialogContent className="bg-white text-black border-[#333333] max-w-md w-[80%] sm:w-full max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-black">Deposit USDT</DialogTitle>
          <DialogDescription className="text-gray-400">
            Add funds to your account using USDT
          </DialogDescription>
        </DialogHeader>

        {step === "amount" ? (
          <>
            <div className="w-full">
              <div className="bg-[#4F9CF9] text-black text-center py-2 px-4 rounded-lg font-medium">
                USDT-BEP20 (BSC)
              </div>

              <div className="mt-4">
                <div className="space-y-4">
                  <div className="bg-white border border-gray-200 p-3 rounded-lg">
                    <p className="text-sm text-black mb-2 font-medium">
                      Network Information
                    </p>
                    <p className="text-xs font-bold text-black">
                      Address: {addresses.bsc}
                    </p>
                    <p className="text-xs text-black">
                      USDT on Binance Smart Chain (BEP20)
                    </p>
                    <p className="text-xs text-black">
                      Min deposit: 5 USDT
                    </p>
                    <p className="text-xs text-black">
                      Platform fee: 5% (95% will reflect in your dashboard)
                    </p>
                    <p className="text-xs text-black">
                      Processing time: Immediate via smart contract
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bsc-amount">Enter Amount (USDT)</Label>
                    <Input
                      id="bsc-amount"
                      type="number"
                      min="50"
                      step="1"
                      placeholder="Minimum 5USDT"
                      className="bg-white border-gray-200 text-gray-900"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wallet-address">
                Your Deposit Wallet Address
              </Label>
              <Input
                id="wallet-address"
                placeholder="Enter the wallet address you're sending from"
                className="bg-white border-[#333333] text-black"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tx-id">Transaction ID/Hash</Label>
              <Input
                id="tx-id"
                placeholder="Enter the transaction ID after sending"
                className="bg-white border-[#333333] text-black"
                value={txId}
                onChange={(e) => setTxId(e.target.value)} //Added onChange handler
              />
            </div>

            <div className="bg-red-900/20 p-3 rounded-lg border border-red-600/30 mt-4">
              <p className="text-xs text-red-800">
                WARNING: Providing fake deposit details will result in an
                immediate permanent ban from the platform.
              </p>
            </div>

            <Button
              className="w-full bg-[#4F9CF9] hover:bg-[#E0B83C] text-black mt-4"
              onClick={() => {
                if (!amount || parseFloat(amount) < 10) {
                  toast({
                    title: "Invalid amount",
                    description: "Minimum deposit amount is $10",
                    variant: "destructive",
                  });
                  return;
                }
                handleRecharge();
              }}
            >
              Continue
            </Button>
          </>
        ) : (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg text-center">
              <p className="text-sm text-gray-300 mb-2">Send exactly</p>
              <p className="text-2xl font-bold text-[#4F9CF9] mb-2">
                {amount} USDT
              </p>
              <p className="text-xs text-gray-400">
                on BSC (BEP20) network
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">To this address:</Label>
              <div className="flex items-center bg-white p-3 rounded-lg">
                <p className="text-xs text-gray-300 flex-1 font-mono break-all">
                  {addresses.bsc}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-[#4F9CF9] hover:text-[#E0B83C] hover:bg-transparent ml-2"
                  onClick={() =>
                    copyAddress(addresses.bsc)
                  }
                >
                  <Copy size={16} />
                </Button>
              </div>
            </div>

            <div className="space-y-2 bg-blue-900/20 p-3 rounded-lg border border-blue-600/30">
              <p className="text-sm text-amber-300">Important:</p>
              <ul className="list-disc list-inside text-xs text-amber-200 space-y-1">
                <li>
                  Only send USDT on the BSC (BEP20) network
                </li>
                <li>Sending any other token may result in permanent loss</li>
                <li>
                  Include your user ID: {user?.id} in the memo/description if
                  possible
                </li>
              </ul>
            </div>

            <Button
              className="w-full bg-[#4F9CF9] hover:bg-[#E0B83C] text-black"
              onClick={() => onOpenChange(false)}
            >
              I've made the payment
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RechargeDialog;
