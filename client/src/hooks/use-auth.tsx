import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { User } from "@shared/schema";
import { apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Login data types for different authentication methods
type EmailLoginData = {
  method: "email";
  email: string;
  password: string;
};

type UsernameLoginData = {
  method: "username";
  username: string;
  password: string;
};

type PhoneLoginData = {
  method: "phone";
  phone: string;
  password: string;
};

type TelegramLoginData = {
  method: "telegram";
  telegram: string;
  password: string;
};

type LoginData =
  | EmailLoginData
  | UsernameLoginData
  | PhoneLoginData
  | TelegramLoginData;

type RegisterData = {
  username: string;
  email?: string;
  phone?: string;
  telegram?: string;
  password: string;
  securityPassword: string;
  inviteCode?: string;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<User, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<User, Error, RegisterData>;
};


export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<
    (User & { notifications?: any[]; transactions?: any[] }) | null,
    Error
  >({
    queryKey: ["/api/user"],
    queryFn: async () => {
      const [userRes, transactionsRes, accountRes] = await Promise.all([
        apiRequest("GET", "/api/user"),
        apiRequest("GET", "/api/transactions"),
        apiRequest("GET", "/api/account"),
      ]);

      if (!userRes.ok) {
        if (userRes.status === 401) return null;
        throw new Error("Failed to fetch user data");
      }

      const userData = await userRes.json();
      const txData = await transactionsRes.json();
      const accountData = await accountRes.json();

      // Use transactions directly from the user's transaction endpoint
      const userTransactions = txData.transactions || [];

      return {
        ...userData,
        notifications: accountData.user?.notifications || [],
        messages: accountData.user?.messages || [],
        transactions: userTransactions,
      };
    },
  });

  // Setup mutations with proper transaction filtering
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      let endpoint;
      let body;

      switch (credentials.method) {
        case "email":
          endpoint = "/api/login/email";
          body = { email: credentials.email, password: credentials.password };
          break;
        case "username":
          endpoint = "/api/login/username";
          body = {
            username: credentials.username,
            password: credentials.password,
          };
          break;
        case "phone":
          endpoint = "/api/login/phone";
          body = { phone: credentials.phone, password: credentials.password };
          break;
        case "telegram":
          endpoint = "/api/login/telegram";
          body = {
            telegram: credentials.telegram,
            password: credentials.password,
          };
          break;
      }

      const res = await apiRequest("POST", endpoint, body);
      return await res.json();
    },
    onSuccess: async (user: User) => {
      // After successful login, fetch transactions and notifications
      const [transactionsRes, accountRes] = await Promise.all([
        apiRequest("GET", "/api/transactions"),
        apiRequest("GET", "/api/account"),
      ]);

      const transactionsData = await transactionsRes.json();
      const accountData = await accountRes.json();

      // Use transactions directly from the user's transaction endpoint
      const userTransactions = transactionsData.transactions || [];

      // Update the query cache with complete user data including transactions and notifications
      queryClient.setQueryData(["/api/user"], {
        ...user,
        notifications: accountData.user?.notifications || [],
        transactions: userTransactions,
      });

      // Also update the account query cache to ensure notifications are available
      queryClient.setQueryData(["/api/account"], accountData);

      toast({
        title: "Login successful",
        description: `Welcome back, ${user.username}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (userData: RegisterData) => {
      const res = await apiRequest("POST", "/api/register", userData);
      return await res.json();
    },
    onSuccess: async (user: User) => {
      // After successful registration, fetch transactions (likely none for new users)
      const transactionsRes = await apiRequest("GET", "/api/transactions");
      const transactionsData = await transactionsRes.json();

      // Use transactions directly from the user's transaction endpoint
      const userTransactions = transactionsData.transactions || [];

      // Update the query cache with complete user data including transactions
      queryClient.setQueryData(["/api/user"], {
        ...user,
        notifications: [],
        transactions: userTransactions,
      });

      toast({
        title: "Registration successful",
        description: `Welcome to Nebrix, ${user.username}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message || "Could not create account",
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Logged out",
        description: "You have been successfully logged out",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
