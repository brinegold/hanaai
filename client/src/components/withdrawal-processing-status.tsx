import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { useWithdrawalStatus } from "@/hooks/use-withdrawal-status";

export const WithdrawalProcessingStatus: React.FC = () => {
  const { data: withdrawalStatus, isLoading } = useWithdrawalStatus();

  if (isLoading || !withdrawalStatus?.hasPendingWithdrawal) {
    return null;
  }

  const { pendingWithdrawal } = withdrawalStatus;
  if (!pendingWithdrawal) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const totalFees = pendingWithdrawal.relatedFees.reduce(
    (sum, fee) => sum + parseFloat(fee.amount),
    0
  );

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-orange-800">
          <Clock className="h-5 w-5 animate-pulse" />
          Withdrawal Processing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
          <div className="space-y-2">
            <p className="text-sm text-orange-800 font-medium">
              Your withdrawal request is being processed by our admin team.
            </p>
            <p className="text-xs text-orange-700">
              You cannot submit new withdrawal requests until this one is completed.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-orange-200">
          <h4 className="font-medium text-gray-900 mb-3">Withdrawal Details</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Amount:</span>
              <span className="font-medium">${parseFloat(pendingWithdrawal.amount).toFixed(2)} USDT</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Destination:</span>
              <span className="font-mono text-xs break-all">
                {pendingWithdrawal.address}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Fees:</span>
              <span className="font-medium text-red-600">
                ${totalFees.toFixed(2)} USDT
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Requested:</span>
              <span className="font-medium">{formatDate(pendingWithdrawal.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className="font-medium text-orange-600 capitalize">
                {pendingWithdrawal.status}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">Processing Steps</span>
          </div>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>✓ Withdrawal request submitted</li>
            <li>⏳ Admin review and approval</li>
            <li>⏳ Blockchain transaction processing</li>
            <li>⏳ Funds sent to your wallet</li>
          </ul>
        </div>

        <div className="text-xs text-gray-600 bg-gray-50 rounded p-3">
          <p className="font-medium mb-1">Processing Time:</p>
          <p>Withdrawals are typically processed within 24-48 hours during business days. 
          You will receive an email notification once your withdrawal is completed.</p>
        </div>
      </CardContent>
    </Card>
  );
};
