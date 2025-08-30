import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, Wallet, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BSCWallet {
  walletAddress: string;
  qrCode: string;
  network: string;
  tokenContract: string;
}

interface TransactionResult {
  success: boolean;
  message: string;
  amount?: number;
  fee?: number;
  txHash?: string;
  netAmount?: number;
}

export default function BSCPage() {
  const [wallet, setWallet] = useState<BSCWallet | null>(null);
  const [loading, setLoading] = useState(false);
  const [walletLoading, setWalletLoading] = useState(true);
  const [depositForm, setDepositForm] = useState({ txHash: "", amount: "" });
  const [withdrawForm, setWithdrawForm] = useState({ amount: "", walletAddress: "" });
  const { toast } = useToast();

  useEffect(() => {
    fetchWallet();
  }, []);

  const fetchWallet = async () => {
    setWalletLoading(true);
    try {
      const response = await fetch("/api/bsc/wallet", {
        credentials: 'include'
      });
      
      console.log("BSC wallet response status:", response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log("BSC wallet data:", data);
        setWallet(data);
      } else {
        const errorText = await response.text();
        console.error("BSC wallet error:", response.status, errorText);
        toast({
          title: "Error",
          description: `Failed to load wallet: ${errorText}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching wallet:", error);
      toast({
        title: "Error",
        description: "Failed to connect to BSC service",
        variant: "destructive",
      });
    } finally {
      setWalletLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Address copied to clipboard",
    });
  };

  const handleDeposit = async () => {
    if (!depositForm.txHash || !depositForm.amount) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/bsc/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(depositForm),
      });

      const result: TransactionResult = await response.json();

      if (result.success) {
        toast({
          title: "Deposit Successful!",
          description: `$${result.amount} credited to your account (Fee: $${result.fee})`,
        });
        setDepositForm({ txHash: "", amount: "" });
      } else {
        toast({
          title: "Deposit Failed",
          description: result.message || "Unknown error occurred",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process deposit",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawForm.amount || !withdrawForm.walletAddress) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/bsc/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withdrawForm),
      });

      const result: TransactionResult = await response.json();

      if (result.success) {
        toast({
          title: "Withdrawal Successful!",
          description: `$${result.netAmount} sent to your wallet (Fee: $${result.fee})`,
        });
        setWithdrawForm({ amount: "", walletAddress: "" });
      } else {
        toast({
          title: "Withdrawal Failed",
          description: result.message || "Unknown error occurred",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process withdrawal",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openBSCExplorer = (address: string) => {
    window.open(`https://testnet.bscscan.com/address/${address}`, "_blank");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Wallet className="h-6 w-6" />
        <h1 className="text-2xl font-bold">BSC Blockchain Payments</h1>
        <Badge variant="secondary">Testnet</Badge>
      </div>

      {walletLoading ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Loading BSC Wallet...
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          </CardContent>
        </Card>
      ) : wallet ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Your BSC Wallet
            </CardTitle>
            <CardDescription>
              Your unique wallet address for BSC deposits
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Label>Wallet Address:</Label>
              <code className="bg-muted px-2 py-1 rounded text-sm flex-1">
                {wallet.walletAddress}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(wallet.walletAddress)}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openBSCExplorer(wallet.walletAddress)}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <Label>Network:</Label>
              <Badge variant="outline">{wallet.network}</Badge>
            </div>

            <div className="flex items-center gap-2">
              <Label>USDT Contract:</Label>
              <code className="bg-muted px-2 py-1 rounded text-sm flex-1">
                {wallet.tokenContract}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(wallet.tokenContract)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex justify-center">
              <img src={wallet.qrCode} alt="Wallet QR Code" className="w-48 h-48" />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              BSC Wallet Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Unable to load your BSC wallet. This could be due to:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground mb-4">
              <li>Server not running or BSC service not initialized</li>
              <li>Authentication issues</li>
              <li>Database connection problems</li>
              <li>Missing environment variables</li>
            </ul>
            <Button onClick={fetchWallet} variant="outline">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="deposit" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="deposit" className="flex items-center gap-2">
            <ArrowDownToLine className="h-4 w-4" />
            Deposit
          </TabsTrigger>
          <TabsTrigger value="withdraw" className="flex items-center gap-2">
            <ArrowUpFromLine className="h-4 w-4" />
            Withdraw
          </TabsTrigger>
        </TabsList>

        <TabsContent value="deposit">
          <Card>
            <CardHeader>
              <CardTitle>Deposit USDT</CardTitle>
              <CardDescription>
                Send USDT to your wallet address and provide the transaction hash
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="txHash">Transaction Hash</Label>
                <Input
                  id="txHash"
                  placeholder="0x..."
                  value={depositForm.txHash}
                  onChange={(e) =>
                    setDepositForm({ ...depositForm, txHash: e.target.value })
                  }
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (USDT)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="100"
                  value={depositForm.amount}
                  onChange={(e) =>
                    setDepositForm({ ...depositForm, amount: e.target.value })
                  }
                />
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-2">Deposit Process:</h4>
                <ol className="text-sm space-y-1 list-decimal list-inside">
                  <li>Send USDT to your wallet address above</li>
                  <li>Copy the transaction hash from BSC explorer</li>
                  <li>Paste the hash and amount here</li>
                  <li>5% fee will be deducted automatically</li>
                  <li>95% will be credited to your account</li>
                </ol>
              </div>

              <Button
                onClick={handleDeposit}
                disabled={loading}
                className="w-full"
              >
                {loading ? "Processing..." : "Process Deposit"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="withdraw">
          <Card>
            <CardHeader>
              <CardTitle>Withdraw USDT</CardTitle>
              <CardDescription>
                Send USDT from your account to any BSC wallet
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="withdrawAmount">Amount (USDT)</Label>
                <Input
                  id="withdrawAmount"
                  type="number"
                  placeholder="50"
                  value={withdrawForm.amount}
                  onChange={(e) =>
                    setWithdrawForm({ ...withdrawForm, amount: e.target.value })
                  }
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="walletAddress">Destination Wallet</Label>
                <Input
                  id="walletAddress"
                  placeholder="0x..."
                  value={withdrawForm.walletAddress}
                  onChange={(e) =>
                    setWithdrawForm({ ...withdrawForm, walletAddress: e.target.value })
                  }
                />
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-2">Withdrawal Process:</h4>
                <ol className="text-sm space-y-1 list-decimal list-inside">
                  <li>Enter amount and destination wallet</li>
                  <li>5% fee will be deducted automatically</li>
                  <li>95% will be sent to destination wallet</li>
                  <li>Transaction will be processed immediately</li>
                </ol>
              </div>

              <Button
                onClick={handleWithdraw}
                disabled={loading}
                className="w-full"
              >
                {loading ? "Processing..." : "Process Withdrawal"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
