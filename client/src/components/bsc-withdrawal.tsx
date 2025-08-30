import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Send, AlertCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

export const BSCWithdrawal: React.FC = () => {
  const [walletAddress, setWalletAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const processWithdrawal = async () => {
    if (!walletAddress || !amount) {
      toast({
        title: 'Error',
        description: 'Please enter wallet address and amount',
        variant: 'destructive'
      });
      return;
    }

    // Validate BSC wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      toast({
        title: 'Invalid Address',
        description: 'Please enter a valid BSC wallet address',
        variant: 'destructive'
      });
      return;
    }

    const withdrawAmount = parseFloat(amount);
    const userBalance = parseFloat(user?.withdrawableAmount?.toString() || '0');

    if (withdrawAmount > userBalance) {
      toast({
        title: 'Insufficient Balance',
        description: 'Withdrawal amount exceeds available balance',
        variant: 'destructive'
      });
      return;
    }

    if (withdrawAmount < 1) {
      toast({
        title: 'Minimum Withdrawal',
        description: 'Minimum withdrawal amount is $1 USDT',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsProcessing(true);
      const response = await apiRequest('POST', '/api/bsc/withdraw', {
        walletAddress,
        amount: withdrawAmount
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Withdrawal Successful!',
          description: `$${data.netAmount} sent to your wallet. Fee: $${data.fee}`
        });
        setWalletAddress('');
        setAmount('');
      } else {
        const error = await response.json();
        toast({
          title: 'Withdrawal Failed',
          description: error.error || 'Failed to process withdrawal',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to process withdrawal',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const calculateFee = () => {
    const withdrawAmount = parseFloat(amount || '0');
    return {
      fee: withdrawAmount * 0.05,
      netAmount: withdrawAmount * 0.95
    };
  };

  const { fee, netAmount } = calculateFee();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          BSC Withdrawal
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-blue-900">Available Balance</span>
          </div>
          <p className="text-2xl font-bold text-blue-900">
            ${user?.withdrawableAmount ? parseFloat(user.withdrawableAmount.toString()).toFixed(2) : '0.00'} USDT
          </p>
        </div>

        <div>
          <Label htmlFor="walletAddress">BSC Wallet Address</Label>
          <Input
            id="walletAddress"
            placeholder="0x... (BSC/BEP-20 compatible wallet)"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            className="font-mono"
          />
          <p className="text-xs text-gray-600 mt-1">
            Enter your BSC wallet address (MetaMask, Trust Wallet, etc.)
          </p>
        </div>

        <div>
          <Label htmlFor="amount">Withdrawal Amount (USDT)</Label>
          <Input
            id="amount"
            type="number"
            placeholder="Enter amount to withdraw"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="1"
            max={user?.withdrawableAmount?.toString() || '0'}
            step="0.01"
          />
        </div>

        {amount && parseFloat(amount) > 0 && (
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span>Withdrawal Amount:</span>
              <span>${parseFloat(amount).toFixed(2)} USDT</span>
            </div>
            <div className="flex justify-between text-sm text-red-600">
              <span>Processing Fee (5%):</span>
              <span>-${fee.toFixed(2)} USDT</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-medium">
              <span>You will receive:</span>
              <span className="text-green-600">${netAmount.toFixed(2)} USDT</span>
            </div>
          </div>
        )}

        <Button
          onClick={processWithdrawal}
          disabled={isProcessing || !walletAddress || !amount}
          className="w-full"
        >
          {isProcessing ? 'Processing Withdrawal...' : 'Withdraw to BSC'}
        </Button>

        <div className="bg-yellow-50 p-4 rounded-lg">
          <h4 className="font-medium text-yellow-900 mb-2">Important Notes:</h4>
          <ul className="text-sm text-yellow-800 space-y-1">
            <li>• 5% processing fee will be deducted</li>
            <li>• Minimum withdrawal: $1 USDT</li>
            <li>• Funds sent to BSC network (BEP-20)</li>
            <li>• Processing time: 5-15 minutes</li>
            <li>• Gas fees paid from processing fee</li>
            <li>• Double-check wallet address before confirming</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
