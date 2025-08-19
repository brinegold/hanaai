import React, { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import Logo from "@/components/logo";
import AuthTabs from "@/components/auth-tabs";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, useLocation } from "wouter";

const AuthPage: React.FC = () => {
  const [mode, setMode] = useState<"login" | "register">("login");
  const { user, isLoading } = useAuth();
  const [location] = useLocation();
  const [referralCode, setReferralCode] = useState<string | null>(null);

  // Extract referral code from URL parameters
  useEffect(() => {
    // Parse URL parameters including hash and query  
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref') || params.get('referral') || params.get('invite');

    if (ref) {
      setReferralCode(ref);
      // Switch to register mode if we have a referral code
      setMode("register");
      // Store referral code in localStorage for persistence
      localStorage.setItem('referralCode', ref);
      // Set invite code in localStorage to be used by AuthTabs
      localStorage.setItem('inviteCode', ref);
      
      // Add ref code to invite codes table if it doesn't exist
      fetch('/api/invite-code/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: ref })
      }).catch(console.error);
    } else {
      // Check localStorage for saved referral code
      const savedRef = localStorage.getItem('referralCode');
      if (savedRef) {
        setReferralCode(savedRef);
        localStorage.setItem('inviteCode', savedRef);
      }
    }
  }, [location]);

  // Redirect if already logged in
  if (!isLoading && user) {
    return <Redirect to="/" />;
  }

  return (
    <div className="min-h-screen dark-pattern bg-white pb-10">
      <div className="max-w-md mx-auto pt-10 px-4">
        {/* Back Button */}
        <div className="flex justify-start items-center mb-6">
          <button 
            className="text-white opacity-80 hover:opacity-100"
            onClick={() => {
              if (mode === "register") {
                setMode("login");
              }
            }}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        </div>

        {/* Logo and Brand */}
        <div className="flex flex-col items-center mb-10">
          <Logo size="medium" />
        </div>

        {/* Auth Container */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-4">
          <AuthTabs mode={mode} onModeChange={setMode} referralCode={referralCode} />
        </div>
      </div>
    </div>
  );
};

export default AuthPage;