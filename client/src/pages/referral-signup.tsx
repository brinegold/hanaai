import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Users, Gift } from "lucide-react";
import Logo from "@/components/logo";

const ReferralSignupPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const referralCode = searchParams.get('ref') || '';
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    telegram: '',
    password: '',
    securityPassword: '',
    inviteCode: referralCode
  });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username || !formData.password || !formData.securityPassword || !formData.inviteCode) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 6 characters long",
        variant: "destructive"
      });
      return;
    }

    if (formData.securityPassword.length < 6) {
      toast({
        title: "Security Password Too Short", 
        description: "Security password must be at least 6 characters long",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const response = await apiRequest("POST", "/api/register", formData);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Registration failed");
      }

      toast({
        title: "Registration Successful!",
        description: "Welcome to Nebrix AI Trading! You can now start investing.",
      });

      navigate("/quantitative");
    } catch (error) {
      toast({
        title: "Registration Failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Logo className="h-12 w-12" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Join Nebrix AI Trading
          </CardTitle>
          {referralCode && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-4">
              <div className="flex items-center gap-2 text-green-800">
                <Gift className="h-4 w-4" />
                <span className="text-sm font-medium">Referral Bonus Available!</span>
              </div>
              <p className="text-xs text-green-600 mt-1">
                You're signing up with referral code: <strong>{referralCode}</strong>
              </p>
            </div>
          )}
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                name="username"
                type="text"
                value={formData.username}
                onChange={handleInputChange}
                placeholder="Enter your username"
                required
              />
            </div>

            <div>
              <Label htmlFor="email">Email (Optional)</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter your email"
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone (Optional)</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="Enter your phone number"
              />
            </div>

            <div>
              <Label htmlFor="telegram">Telegram ID (Optional)</Label>
              <Input
                id="telegram"
                name="telegram"
                type="text"
                value={formData.telegram}
                onChange={handleInputChange}
                placeholder="Enter your Telegram ID"
              />
            </div>

            <div>
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Enter your password"
                required
              />
            </div>

            <div>
              <Label htmlFor="securityPassword">Security Password *</Label>
              <Input
                id="securityPassword"
                name="securityPassword"
                type="password"
                value={formData.securityPassword}
                onChange={handleInputChange}
                placeholder="Enter your security password"
                required
              />
            </div>

            <div>
              <Label htmlFor="inviteCode">Referral Code *</Label>
              <Input
                id="inviteCode"
                name="inviteCode"
                type="text"
                value={formData.inviteCode}
                onChange={handleInputChange}
                placeholder="Enter referral code"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-[#4F9CF9] hover:bg-[#E0B83C] text-white"
              disabled={loading}
            >
              {loading ? "Creating Account..." : "Create Account"}
            </Button>

            <div className="text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="text-[#4F9CF9] hover:text-[#E0B83C] font-medium"
                >
                  Sign In
                </button>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReferralSignupPage;
