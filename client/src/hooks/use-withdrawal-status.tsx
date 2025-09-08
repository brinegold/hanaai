import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface PendingWithdrawal {
  id: number;
  amount: string;
  address: string;
  createdAt: string;
  status: string;
  relatedFees: Array<{
    type: string;
    amount: string;
  }>;
}

interface WithdrawalStatusResponse {
  hasPendingWithdrawal: boolean;
  pendingWithdrawal: PendingWithdrawal | null;
}

export function useWithdrawalStatus() {
  return useQuery<WithdrawalStatusResponse>({
    queryKey: ["/api/withdrawal/status"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/withdrawal/status");
      if (!response.ok) {
        throw new Error("Failed to fetch withdrawal status");
      }
      return response.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds to keep status updated
    staleTime: 10000, // Consider data stale after 10 seconds
  });
}
