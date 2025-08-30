import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Copy, QrCode, Wallet } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface BSCWallet {
  walletAddress: string;
  qrCode: string;
  network: string;
  tokenContract: string;
}

export const BSCDeposit: React.FC = () => {
  const [wallet, setWallet] = useState<BSCWallet | null>(null);
  const [txHash, setTxHash] = useState('');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchWalletAddress();
  }, []);

  const fetchWalletAddress = async () => {
    try {
      setIsLoading(true);
      const response = await apiRequest('GET', '/api/bsc/wallet');
      const data = await response.json();
      setWallet(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load wallet address',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: 'Address copied to clipboard'
    });
  };

  const processDeposit = async () => {
    if (!txHash || !amount) {
      toast({
        title: 'Error',
        description: 'Please enter transaction hash and amount',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsProcessing(true);
      const response = await apiRequest('POST', '/api/bsc/deposit', {
        txHash,
        amount: parseFloat(amount)
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Deposit Successful!',
          description: `$${data.amount} deposited successfully. Fee: $${data.fee}`
        });
        setTxHash('');
        setAmount('');
      } else {
        const error = await response.json();
        toast({
          title: 'Deposit Failed',
          description: error.error || 'Failed to process deposit',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to process deposit',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading wallet...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Wallet Address Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Your BSC Deposit Address
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {wallet && (
            <>
              <div className="bg-gray-50 p-4 rounded-lg">
                <Label className="text-sm font-medium">Wallet Address</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={wallet.walletAddress}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(wallet.walletAddress)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="text-center">
                <img
                  src={wallet.qrCode}
                  alt="Wallet QR Code"
                  className="mx-auto border rounded-lg"
                />
                <p className="text-sm text-gray-600 mt-2">
                  Scan QR code or copy address above
                </p>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Important Instructions:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Send USDT (BEP-20) to the address above</li>
                  <li>• Network: {wallet.network}</li>
                  <li>• 5% processing fee will be deducted</li>
                  <li>• Minimum deposit: $5 USDT</li>
                  <li>• Copy transaction hash after sending</li>
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Deposit Processing Card */}
      <Card>
        <CardHeader>
          <CardTitle>Process Your Deposit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="txHash">Transaction Hash</Label>
            <Input
              id="txHash"
              placeholder="Enter transaction hash from your wallet"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              className="font-mono"
            />
          </div>

          <div>
            <Label htmlFor="amount">Amount (USDT)</Label>
            <Input
              id="amount"
              type="number"
              placeholder="Enter deposit amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="5"
              step="0.01"
            />
          </div>

          <Button
            onClick={processDeposit}
            disabled={isProcessing || !txHash || !amount}
            className="w-full"
          >
            {isProcessing ? 'Processing...' : 'Confirm Deposit'}
          </Button>

          <div className="text-xs text-gray-600">
            <p>• Deposits are processed automatically after verification</p>
            <p>• Processing fee: 2% of deposit amount</p>
            <p>• Funds will appear in your account within 5-10 minutes</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
