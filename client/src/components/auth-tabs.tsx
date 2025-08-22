import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Eye,
  EyeOff,
  User,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { ForgotPasswordDialog } from "./forgot-password-dialog";

interface AuthTabsProps {
  mode: "login" | "register";
  onModeChange: (mode: "login" | "register") => void;
  referralCode?: string | null;
}

// Login Schema - Fixed to conditionally validate based on login method
const loginSchema = z.object({
  username: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  telegram: z.string().optional(),
  password: z.string().min(1, "Password is required"),
});

// Register Schema
const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  telegram: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  securityPassword: z
    .string()
    .min(6, "Security password must be at least 6 characters"),
  inviteCode: z.string().min(6, "Invite code must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

const AuthTabs: React.FC<AuthTabsProps> = ({
  mode,
  onModeChange,
  referralCode,
}) => {
  const [, setLocation] = useLocation();
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showSecurityPassword, setShowSecurityPassword] = useState(false);
  const [welcomeCode, setWelcomeCode] = useState<string>(referralCode || "");
  const { loginMutation, registerMutation } = useAuth();
  const [loginMethod, setLoginMethod] = useState<
    "username" | "email" | "phone" | "telegram"
  >("username");

  // Login form
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      email: "",
      phone: "",
      telegram: "",
      password: "",
    },
    mode: "onChange", // Enable onChange validation mode
  });

  // Register form
  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      phone: "",
      telegram: "",
      password: "",
      securityPassword: "",
      inviteCode: referralCode || "",
    },
  });

  // Reset form values when switching login methods
  useEffect(() => {
    // Reset all fields except password
    const currentPassword = loginForm.getValues("password");
    loginForm.reset({
      username:
        loginMethod === "username" ? loginForm.getValues("username") : "",
      email: loginMethod === "email" ? loginForm.getValues("email") : "",
      phone: loginMethod === "phone" ? loginForm.getValues("phone") : "",
      telegram:
        loginMethod === "telegram" ? loginForm.getValues("telegram") : "",
      password: currentPassword,
    });
  }, [loginMethod]);

  // Update invite code field when referralCode prop changes
  useEffect(() => {
    if (referralCode) {
      registerForm.setValue("inviteCode", referralCode);
    }
  }, [referralCode, registerForm]);

  // Use referral code from URL param or stored code
  useEffect(() => {
    // Check URL params first
    const params = new URLSearchParams(window.location.search);
    const refCode =
      params.get("ref") || params.get("referral") || params.get("invite");

    if (refCode) {
      registerForm.setValue("inviteCode", refCode);
    } else {
      const storedInviteCode = localStorage.getItem("inviteCode");
      if (storedInviteCode) {
        registerForm.setValue("inviteCode", storedInviteCode);
      }
    }
  }, [referralCode, registerForm]);

  const onLoginSubmit = async (data: LoginFormValues) => {
    if (!data.password) {
      toast({
        title: "Error",
        description: "Password is required",
        variant: "destructive",
      });
      return;
    }

    let loginData;

    // Get the current value directly for the active field
    const currentUsername = loginForm.getValues("username");
    const currentEmail = loginForm.getValues("email");
    const currentPhone = loginForm.getValues("phone");
    const currentTelegram = loginForm.getValues("telegram");

    if (loginMethod === "username" && currentUsername) {
      loginData = {
        method: "username",
        username: currentUsername,
        password: data.password,
      };
    } else if (loginMethod === "email" && currentEmail) {
      loginData = {
        method: "email",
        email: currentEmail,
        password: data.password,
      };
    } else if (loginMethod === "phone" && currentPhone) {
      loginData = {
        method: "phone",
        phone: currentPhone,
        password: data.password,
      };
    } else if (loginMethod === "telegram" && currentTelegram) {
      loginData = {
        method: "telegram",
        telegram: currentTelegram,
        password: data.password,
      };
    } else {
      toast({
        title: "Missing field",
        description: `Please enter your ${loginMethod}`,
        variant: "destructive",
      });
      return;
    }

    console.log("Submitting login:", loginData);
    loginMutation.mutate(loginData, {
      onSuccess: (_) => {
        console.log("Login successful");
        toast({
          title: "Login successful",
          description: "Welcome back to Nebrix!",
        });
        setLocation("/");
      },
      onError: (error) => {
        console.log("Login failed:", error);
        toast({
          title: "Login failed",
          description: error.message || "Invalid credentials",
          variant: "destructive",
        });
      },
    });
  };

  const onRegisterSubmit = async (data: RegisterFormValues) => {
    registerMutation.mutate(data, {
      onSuccess: (_) => {
        toast({
          title: "Registration successful",
          description: "Welcome to Nebrix!",
          variant: "default",
        });
        setLocation("/");
      },
      onError: (error) => {
        toast({
          title: "Registration failed",
          description:
            error.message || "Registration failed. Please try again.",
          variant: "destructive",
        });
      },
    });
  };

  // Handle login method change
  const handleLoginMethodChange = (
    method: "username" | "email" | "phone" | "telegram",
  ) => {
    setLoginMethod(method);
  };

  return (
    <>
      <Tabs
        defaultValue={mode}
        className="w-full"
        onValueChange={(value) => onModeChange(value as any)}
      >
        <TabsList className="grid w-full grid-cols-2 bg-white rounded-lg">
          <TabsTrigger
            value="login"
            className={`rounded-lg py-3 ${mode === "login" ? "text-black bg-[#4F9CF9]" : "text-gray-400"}`}
          >
            Login
          </TabsTrigger>
          <TabsTrigger
            value="register"
            className={`rounded-lg py-3 ${mode === "register" ? "text-black bg-[#4F9CF9]" : "text-gray-400"}`}
          >
            Register
          </TabsTrigger>
        </TabsList>

        {/* Login Form */}
        <TabsContent value="login" className="mt-6">
          <Form {...loginForm}>
            <form
              onSubmit={loginForm.handleSubmit(onLoginSubmit)}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4 mb-4">
                <button
                  type="button"
                  className={`py-2 rounded-lg ${loginMethod === "username" ? "bg-[#4F9CF9] text-black" : "bg-white text-gray-400"}`}
                  onClick={() => handleLoginMethodChange("username")}
                >
                  Username
                </button>
                <button
                  type="button"
                  className={`py-2 rounded-lg ${loginMethod === "email" ? "bg-[#4F9CF9] text-black" : "bg-white text-gray-400"}`}
                  onClick={() => handleLoginMethodChange("email")}
                >
                  Email
                </button>
              </div>

              {loginMethod === "username" && (
                <FormField
                  control={loginForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 h-5 w-5" />
                          <Input
                            placeholder="Username"
                            className="bg-white border-[#333333] pl-10 py-6 text-black focus:ring-[#4F9CF9]"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {loginMethod === "email" && (
                <FormField
                  control={loginForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 h-5 w-5" />
                          <Input
                            type="email"
                            placeholder="Email"
                            className="bg-white border-[#333333] pl-10 py-6 text-black focus:ring-[#4F9CF9]"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {loginMethod === "phone" && (
                <FormField
                  control={loginForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 h-5 w-5" />
                          <Input
                            type="tel"
                            placeholder="Phone Number"
                            className="bg-white border-[#333333] pl-10 py-6 text-black focus:ring-[#4F9CF9]"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {loginMethod === "telegram" && (
                <FormField
                  control={loginForm.control}
                  name="telegram"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 h-5 w-5" />
                          <Input
                            placeholder="Telegram username"
                            className="bg-white border-[#333333] pl-10 py-6 text-black focus:ring-[#4F9CF9]"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={loginForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 h-5 w-5" />
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Password"
                          className="bg-white border-[#333333] pl-10 pr-10 py-6 text-black focus:ring-[#4F9CF9]"
                          {...field}
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                    <button
                      type="button"
                      className="text-sm text-[#4F9CF9] hover:text-[#E0B83C] mt-2"
                      onClick={() => setForgotPasswordOpen(true)}
                    >
                      Forgot Password?
                    </button>
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full bg-[#4F9CF9] hover:bg-[#E0B83C] text-black py-6"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "Logging in..." : "Login"}
              </Button>
            </form>
          </Form>
        </TabsContent>

        {/* Register Form */}
        <TabsContent value="register" className="mt-6">
          <Form {...registerForm}>
            <form
              onSubmit={registerForm.handleSubmit(onRegisterSubmit)}
              className="space-y-4"
            >
              <FormField
                control={registerForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 h-5 w-5" />
                        <Input
                          placeholder="Username"
                          className="bg-white border-[#333333] pl-10 py-6 text-black focus:ring-[#4F9CF9]"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={registerForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 h-5 w-5" />
                        <Input
                          type="email"
                          placeholder="Email"
                          className="bg-white border-[#333333] pl-10 py-6 text-black focus:ring-[#4F9CF9]"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={registerForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 h-5 w-5" />
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Password"
                          className="bg-white border-[#333333] pl-10 pr-10 py-6 text-black focus:ring-[#4F9CF9]"
                          {...field}
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={registerForm.control}
                name="securityPassword"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400">
                        Security Password (used for transactions)
                      </span>
                      <span className="text-xs text-[#4F9CF9]">Important</span>
                    </div>
                    <FormControl>
                      <div className="relative">
                        <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 h-5 w-5" />
                        <Input
                          type={showSecurityPassword ? "text" : "password"}
                          placeholder="Security Password"
                          className="bg-white border-[#333333] pl-10 pr-10 py-6 text-black focus:ring-[#4F9CF9]"
                          {...field}
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black"
                          onClick={() =>
                            setShowSecurityPassword(!showSecurityPassword)
                          }
                        >
                          {showSecurityPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <p className="text-xs text-gray-500 mt-1">
                      This is your transaction security code. Required for
                      withdrawals and financial operations.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={registerForm.control}
                name="inviteCode"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="relative">
                        <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 h-5 w-5" />
                        <Input
                          placeholder="Invite Code"
                          className="bg-white border-[#333333] pl-10 py-6 text-black focus:ring-[#4F9CF9]"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <p className="text-xs text-gray-500 mt-1">
                      {welcomeCode
                        ? `Using invite code: ${welcomeCode}`
                        : "Enter the invite code from your referrer"}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full bg-[#4F9CF9] hover:bg-[#E0B83C] text-black py-6"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? "Registering..." : "Register"}
              </Button>
            </form>
          </Form>
        </TabsContent>
      </Tabs>
      <ForgotPasswordDialog
        open={forgotPasswordOpen}
        onOpenChange={setForgotPasswordOpen}
      />
    </>
  );
};

export default AuthTabs;
