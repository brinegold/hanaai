import React, { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import Logo from "@/components/logo";
import AuthTabs from "@/components/auth-tabs";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, useLocation } from "wouter";

const AuthPage: React.FC = () => {
  const [mode, setMode] = useState<"login" | "register">("register");
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
    <div className="gradient-bg-auth">
      <div className="max-w-md mx-auto pt-10 px-4 pb-10">
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
        {/* Welcome Text */}
        <div className="text-center mb-8">
          <h1 className="text-white text-3xl font-bold mb-2">
            {mode === "login" ? "Welcome Back" : "Join Pay TenTen"}
          </h1>
          <p className="text-white/80 text-base">
            {mode === "login" 
              ? "Login to your account to continue" 
              : "Create your account to get started"
            }
          </p>
        </div>

        {/* Logo */}
        <div className="rounded-md flex flex-col items-center mb-8">
          <Logo size="medium" />
        </div>

        {/* Pay TenTen Description */}
        <div className="text-center mb-8 px-4">
          <div className="text-white/90 text-sm leading-relaxed space-y-2">
            <p>Pay TenTen is an advanced crypto earning platform </p>
            <p>where users earn 3% daily while also making $10 reward on every 3 referrals who invest $10</p>
          </div>
        </div>
       

        {/* Auth Container */}
        <div className="auth-card rounded-2xl p-6 mb-8">
          <AuthTabs mode={mode} onModeChange={setMode} referralCode={referralCode} />
        </div>

        {/* Social Media Links */}
        <div className="flex justify-center space-x-4 mt-8">
          <a href="https://t.me/PayTenTen" className="social-link social-telegram">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
          </a>
          <a href="paytentenupport@atomicmail.io" className="social-link social-email">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;