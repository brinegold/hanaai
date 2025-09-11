import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Redirect } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [notificationMessage, setNotificationMessage] = useState('');

  if (!user || !user.isAdmin) {
    return <Redirect to="/" />;
  }

  const { data: platformStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/stats");
      if (!res.ok) throw new Error("Failed to fetch platform stats");
      return res.json();
    }
  });

  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    }
  });

  const { data: pendingTransactions, isLoading: isLoadingTransactions } = useQuery({
    queryKey: ["admin", "transactions", "pending"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/transactions/pending");
      if (!res.ok) throw new Error("Failed to fetch pending transactions");
      return res.json();
    }
  });

  const handleApprove = async (txId: number) => {
    try {
      const res = await apiRequest("POST", `/api/admin/transactions/${txId}/approve`);
      if (!res.ok) throw new Error("Failed to approve transaction");

      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast({
        title: "Success",
        description: "Transaction approved successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to approve transaction",
        variant: "destructive",
      });
    }
  };

  const handleReject = async (txId: number) => {
    try {
      const res = await apiRequest("POST", `/api/admin/transactions/${txId}/reject`);
      if (!res.ok) throw new Error("Failed to reject transaction");

      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast({
        title: "Success",
        description: "Transaction rejected successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reject transaction",
        variant: "destructive",
      });
    }
  };

  if (isLoadingStats || isLoadingUsers || isLoadingTransactions) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

      {/* Mass Messaging */}
      <Card>
        <CardHeader>
          <CardTitle>Mass Messaging</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            placeholder="Enter message to send to all users..."
            className="w-full p-2 bg-white border border-gray-200 rounded text-gray-900 mb-4"
            value={notificationMessage}
            onChange={(e) => setNotificationMessage(e.target.value)}
          />
          <Button 
            className="w-full bg-[#4F9CF9] hover:bg-[#E0B83C] text-black"
            onClick={async () => {
              if (!notificationMessage.trim()) {
                toast({
                  title: "Error",
                  description: "Please enter a message",
                  variant: "destructive"
                });
                return;
              }
              try {
                await apiRequest("POST", "/api/admin/notifications/mass", { message: notificationMessage });
                setNotificationMessage('');
                toast({
                  title: "Success",
                  description: "Message sent to all users"
                });
              } catch (error) {
                toast({
                  title: "Error",
                  description: "Failed to send message",
                  variant: "destructive"
                });
              }
            }}
          >
            Send to All Users
          </Button>
        </CardContent>
      </Card>

      {/* Token Collection */}
      <Card>
        <CardHeader>
          <CardTitle>Token Collection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* USDT Collection */}
            <div>
              <h3 className="text-lg font-semibold mb-2">USDT Collection</h3>
              <p className="text-sm text-gray-600 mb-4">
                Collect USDT tokens from user wallets to admin wallets
              </p>
              <div className="flex gap-4">
                <Button 
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={async () => {
                    try {
                      const res = await apiRequest("POST", "/api/bsc/collect-usdt");
                      if (!res.ok) throw new Error("Failed to collect USDT");
                      
                      const result = await res.json();
                      toast({
                        title: "Success",
                        description: result.message || "USDT collection completed successfully"
                      });
                      
                      // Refresh admin data
                      queryClient.invalidateQueries({ queryKey: ["admin"] });
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to collect USDT from user wallets",
                        variant: "destructive"
                      });
                    }
                  }}
                >
                  Collect All USDT
                </Button>
                
                <Button 
                  variant="outline"
                  className="border-blue-600 text-blue-600 hover:bg-blue-50"
                  onClick={async () => {
                    const userIds = prompt("Enter user IDs separated by commas (e.g., 1,2,3):");
                    if (!userIds?.trim()) return;
                    
                    try {
                      const userIdArray = userIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
                      if (userIdArray.length === 0) {
                        toast({
                          title: "Error",
                          description: "Please enter valid user IDs",
                          variant: "destructive"
                        });
                        return;
                      }
                      
                      const res = await apiRequest("POST", "/api/bsc/collect-usdt", { userIds: userIdArray });
                      if (!res.ok) throw new Error("Failed to collect USDT");
                      
                      const result = await res.json();
                      toast({
                        title: "Success",
                        description: result.message || `USDT collection completed for ${userIdArray.length} users`
                      });
                      
                      // Refresh admin data
                      queryClient.invalidateQueries({ queryKey: ["admin"] });
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to collect USDT from specified users",
                        variant: "destructive"
                      });
                    }
                  }}
                >
                  Collect USDT from Specific Users
                </Button>
              </div>
            </div>

            {/* BNB Collection */}
            <div>
              <h3 className="text-lg font-semibold mb-2">BNB Collection</h3>
              <p className="text-sm text-gray-600 mb-4">
                Collect BNB from user wallets to admin wallets (leaves 0.001 BNB for gas)
              </p>
              <div className="flex gap-4">
                <Button 
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                  onClick={async () => {
                    try {
                      const res = await apiRequest("POST", "/api/bsc/collect-bnb");
                      if (!res.ok) throw new Error("Failed to collect BNB");
                      
                      const result = await res.json();
                      toast({
                        title: "Success",
                        description: result.message || "BNB collection completed successfully"
                      });
                      
                      // Refresh admin data
                      queryClient.invalidateQueries({ queryKey: ["admin"] });
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to collect BNB from user wallets",
                        variant: "destructive"
                      });
                    }
                  }}
                >
                  Collect All BNB
                </Button>
                
                <Button 
                  variant="outline"
                  className="border-orange-600 text-orange-600 hover:bg-orange-50"
                  onClick={async () => {
                    const userIds = prompt("Enter user IDs separated by commas (e.g., 1,2,3):");
                    if (!userIds?.trim()) return;
                    
                    try {
                      const userIdArray = userIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
                      if (userIdArray.length === 0) {
                        toast({
                          title: "Error",
                          description: "Please enter valid user IDs",
                          variant: "destructive"
                        });
                        return;
                      }
                      
                      const res = await apiRequest("POST", "/api/bsc/collect-bnb", { userIds: userIdArray });
                      if (!res.ok) throw new Error("Failed to collect BNB");
                      
                      const result = await res.json();
                      toast({
                        title: "Success",
                        description: result.message || `BNB collection completed for ${userIdArray.length} users`
                      });
                      
                      // Refresh admin data
                      queryClient.invalidateQueries({ queryKey: ["admin"] });
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to collect BNB from specified users",
                        variant: "destructive"
                      });
                    }
                  }}
                >
                  Collect BNB from Specific Users
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Platform Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Platform Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Total Users:</span>
                <span>{platformStats?.totalUsers}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Deposits:</span>
                <span>{formatCurrency(platformStats?.totalDeposits)}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Withdrawals:</span>
                <span>{formatCurrency(platformStats?.totalWithdrawals)}</span>
              </div>
              <div className="flex justify-between">
                <span>Active Investments:</span>
                <span>{formatCurrency(platformStats?.totalInvestments)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-4">
            <input
              type="text"
              placeholder="Search by Username or ID..."
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              onChange={(e) => {
                const search = e.target.value.toLowerCase();
                const filtered = users?.filter(user => 
                  user.username.toLowerCase().includes(search) || 
                  user.id.toString().includes(search)
                );
                setFilteredUsers(filtered || []);
              }}
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Upline</TableHead>
                <TableHead>Rank</TableHead>
                <TableHead>Direct Volume</TableHead>
                <TableHead>Indirect Volume</TableHead>
                <TableHead>Total Assets</TableHead>
                <TableHead>Withdrawable</TableHead>
                <TableHead>Total Deposit</TableHead>
                <TableHead>Created At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(filteredUsers.length > 0 ? filteredUsers : users)?.map((user: any) => (
                <TableRow key={user.id}>
                  <TableCell>{user.id}</TableCell>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.uplineUsername || '-'}</TableCell>
                  <TableCell>{user.rank || 'Bronze'}</TableCell>
                  <TableCell>{formatCurrency(user.directVolume || 0)}</TableCell>
                  <TableCell>{formatCurrency(user.indirectVolume || 0)}</TableCell>
                  <TableCell>{formatCurrency(user.totalAssets)}</TableCell>
                  <TableCell>{formatCurrency(user.withdrawableAmount)}</TableCell>
                  <TableCell>{formatCurrency(user.rechargeAmount)}</TableCell>
                  <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const amount = prompt("Enter deposit amount:");
                          if (amount && !isNaN(parseFloat(amount))) {
                            apiRequest("POST", `/api/admin/users/${user.id}/deposit`, { amount: parseFloat(amount) })
                              .then(() => {
                                queryClient.invalidateQueries({ queryKey: ["admin"] });
                                toast({
                                  title: "Success",
                                  description: "Manual deposit added successfully",
                                });
                              })
                              .catch(() => {
                                toast({
                                  title: "Error",
                                  description: "Failed to add manual deposit",
                                  variant: "destructive",
                                });
                              });
                          }
                        }}
                        className="bg-green-500 text-white px-2 py-1 rounded text-sm mr-2"
                      >
                        Add Deposit
                      </button>
                      <button
                        onClick={() => {
                          const amount = prompt("Enter withdrawable amount to add:");
                          if (amount && !isNaN(parseFloat(amount))) {
                            apiRequest("POST", `/api/admin/users/${user.id}/add-withdrawable`, { amount: parseFloat(amount) })
                              .then(() => {
                                queryClient.invalidateQueries({ queryKey: ["admin"] });
                                toast({
                                  title: "Success",
                                  description: "Withdrawable amount added successfully",
                                });
                              })
                              .catch(() => {
                                toast({
                                  title: "Error",
                                  description: "Failed to add withdrawable amount",
                                  variant: "destructive",
                                });
                              });
                          }
                        }}
                        className="bg-purple-500 text-white px-2 py-1 rounded text-sm mr-2"
                      >
                        Add Withdrawable
                      </button>
                      <button
                        onClick={() => {
                          const amount = prompt("Enter withdrawable amount to deduct:");
                          if (amount && !isNaN(parseFloat(amount))) {
                            apiRequest("POST", `/api/admin/users/${user.id}/deduct-withdrawable`, { amount: parseFloat(amount) })
                              .then(() => {
                                queryClient.invalidateQueries({ queryKey: ["admin"] });
                                toast({
                                  title: "Success",
                                  description: "Withdrawable amount deducted successfully",
                                });
                              })
                              .catch((error) => {
                                toast({
                                  title: "Error",
                                  description: error.message || "Failed to deduct withdrawable amount",
                                  variant: "destructive",
                                });
                              });
                          }
                        }}
                        className="bg-red-500 text-white px-2 py-1 rounded text-sm mr-2"
                      >
                        Deduct Withdrawable
                      </button>
                      <button
                        onClick={() => {
                          const amount = prompt("Enter deposit amount to deduct:");
                          const reason = prompt("Enter reason for deposit reversal (optional):");
                          if (amount && !isNaN(parseFloat(amount))) {
                            apiRequest("POST", `/api/admin/users/${user.id}/deduct-deposit`, { 
                              amount: parseFloat(amount),
                              reason: reason || "Admin deposit reversal"
                            })
                              .then(() => {
                                queryClient.invalidateQueries({ queryKey: ["admin"] });
                                toast({
                                  title: "Success",
                                  description: "Deposit amount deducted successfully",
                                });
                              })
                              .catch((error) => {
                                toast({
                                  title: "Error",
                                  description: error.message || "Failed to deduct deposit amount",
                                  variant: "destructive",
                                });
                              });
                          }
                        }}
                        className="bg-orange-500 text-white px-2 py-1 rounded text-sm mr-2"
                      >
                        Deduct Deposit
                      </button>
                      {!user.isCountryRep && (
                        <button
                          onClick={async () => {
                            try {
                              await apiRequest("POST", `/api/admin/users/${user.id}/approve-country-rep`);
                              queryClient.invalidateQueries({ queryKey: ["admin"] });
                              toast({
                                title: "Success",
                                description: "User upgraded to Country Representative",
                              });
                            } catch (error) {
                              toast({
                                title: "Error",
                                description: "Failed to upgrade to Country Representative",
                                variant: "destructive",
                              });
                            }
                          }}
                          className="bg-yellow-500 text-white px-2 py-1 rounded text-sm mr-2"
                        >
                          Make C.Rep
                        </button>
                      )}
                      {user.verificationStatus !== "verified" && (
                        <button
                          onClick={() => {
                            apiRequest("POST", `/api/admin/users/${user.id}/verify`)
                              .then(() => {
                                queryClient.invalidateQueries({ queryKey: ["admin"] });
                                toast({
                                  title: "Success",
                                  description: "User verified successfully",
                                });
                              })
                              .catch(() => {
                                toast({
                                  title: "Error",
                                  description: "Failed to verify user",
                                  variant: "destructive",
                                });
                              });
                          }}
                          className="bg-blue-500 text-white px-2 py-1 rounded text-sm"
                        >
                          Verify
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          try {
                            const endpoint = `/api/admin/users/${user.id}/${user.isBanned ? 'unban' : 'ban'}`;
                            const response = await apiRequest("POST", endpoint);

                            if (!response.ok) {
                              throw new Error("Failed to update ban status");
                            }

                            queryClient.invalidateQueries({ queryKey: ["admin"] });
                            toast({
                              title: "Success", 
                              description: `User ${user.isBanned ? 'unbanned' : 'banned'} successfully`
                            });
                          } catch (error) {
                            toast({
                              title: "Error",
                              description: `Failed to ${user.isBanned ? 'unban' : 'ban'} user`,
                              variant: "destructive"
                            });
                          }
                        }}
                        className={`${user.isBanned ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'} text-white px-3 py-1.5 rounded text-sm mr-2 font-medium transition-colors flex items-center gap-2`}
                      >
                        {user.isBanned ? (
                          <>
                            <span className="text-lg">✓</span>
                            <span>Unban User</span>
                          </>
                        ) : (
                          <>
                            <span className="text-lg">⚠</span>
                            <span>Ban User</span>
                          </>
                        )}
                      </button>
                      <button
                        className="bg-blue-500 text-white px-2 py-1 rounded text-sm mr-2"
                        onClick={async () => {
                          const message = prompt("Enter message for user:");
                          if (message?.trim()) {
                            try {
                              await apiRequest("POST", `/api/admin/messages/private/${user.id}`, { message });
                              toast({
                                title: "Success",
                                description: "Message sent to user"
                              });
                            } catch (error) {
                              toast({
                                title: "Error",
                                description: "Failed to send message",
                                variant: "destructive"
                              });
                            }
                          }
                        }}
                      >
                        Message
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this user?")) {
                            apiRequest("DELETE", `/api/admin/users/${user.id}`)
                              .then(() => {
                                queryClient.invalidateQueries({ queryKey: ["admin"] });
                                toast({
                                  title: "Success",
                                  description: "User deleted successfully",
                                });
                              })
                              .catch(() => {
                                toast({
                                  title: "Error",
                                  description: "Failed to delete user",
                                  variant: "destructive",
                                });
                              });
                          }
                        }}
                        className="bg-red-500 text-white px-2 py-1 rounded text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* All Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>TX Hash</TableHead>
                <TableHead>Created At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!platformStats?.transactions ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    No transactions found
                  </TableCell>
                </TableRow>
              ) : (
                platformStats.transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{tx.userId}</TableCell>
                    <TableCell>{tx.type}</TableCell>
                    <TableCell>${parseFloat(tx.amount).toFixed(2)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded ${
                        tx.status === 'Completed' ? 'bg-green-500' :
                        tx.status === 'Failed' ? 'bg-red-500' :
                        'bg-yellow-500'
                      } text-white`}>
                        {tx.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      {tx.txHash ? (
                        <a 
                          href={`https://testnet.bscscan.com/tx/${tx.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          {tx.txHash.slice(0, 8)}...{tx.txHash.slice(-6)}
                        </a>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell>{new Date(tx.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pending Transactions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Pending Withdrawal Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User ID</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Destination Address</TableHead>
                <TableHead>TX Hash</TableHead>
                <TableHead>Requested At</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!pendingTransactions || pendingTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">
                    No pending withdrawal requests
                  </TableCell>
                </TableRow>
              ) : (
                pendingTransactions.map((tx: any) => (
                  <TableRow key={tx.id}>
                    <TableCell>{tx.userId}</TableCell>
                    <TableCell>{tx.username || tx.userEmail || `User${tx.userId}`}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs ${
                        tx.type === 'Withdrawal' ? 'bg-blue-100 text-blue-800' :
                        tx.type === 'Withdrawal Fee' ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {tx.type}
                      </span>
                    </TableCell>
                    <TableCell>{formatCurrency(tx.amount)}</TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">
                        {tx.address ? `${tx.address.slice(0, 6)}...${tx.address.slice(-4)}` : '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {tx.txHash ? (
                        <a 
                          href={`https://testnet.bscscan.com/tx/${tx.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          {tx.txHash.slice(0, 8)}...{tx.txHash.slice(-6)}
                        </a>
                      ) : (
                        <span className="text-gray-400 text-xs">Pending</span>
                      )}
                    </TableCell>
                    <TableCell>{new Date(tx.createdAt).toLocaleString()}</TableCell>
                    <TableCell>
                      {tx.type === 'Withdrawal' && (
                        <div className="flex gap-2">
                          <button 
                            className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                            onClick={() => handleApprove(tx.id)}
                          >
                            ✓ Approve
                          </button>
                          <button 
                            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                            onClick={() => handleReject(tx.id)}
                          >
                            ✗ Reject
                          </button>
                        </div>
                      )}
                      {tx.type !== 'Withdrawal' && (
                        <span className="text-gray-500 text-sm">Auto-processed with main withdrawal</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}