import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { queryClient } from "./lib/queryClient";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import DashboardPage from "@/pages/dashboard-page";
import ProfilePage from "@/pages/profile-page";
import VerificationPage from "@/pages/verification-page";
import InvitePage from "@/pages/invite-page";
import QuantitativePage from "@/pages/quantitative-page";
import BSCPage from "@/pages/bsc-page";
import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "./hooks/use-auth";
import ResetPasswordPage from "./pages/reset-password-page";
import AdminPage from "./pages/admin-page";
import { GoogleTranslate } from "@/components/GoogleTranslate";
import { LanguageProvider } from "./hooks/use-language";

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/auth" component={AuthPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />{" "}
      {/* Updated reset password route */}
      {/* Protected routes */}
      <ProtectedRoute path="/" component={DashboardPage} />
      <ProtectedRoute path="/profile" component={ProfilePage} />
      <ProtectedRoute path="/verify" component={VerificationPage} />
      <ProtectedRoute path="/invite" component={InvitePage} />
      <ProtectedRoute path="/tradenow" component={QuantitativePage} />
      <ProtectedRoute path="/bsc" component={BSCPage} />
      <ProtectedRoute path="/admin" component={AdminPage} />
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LanguageProvider>
          <div className="min-h-screen bg-white text-gray-800">
            <Router />
            <Toaster />
            <GoogleTranslate />
          </div>
        </LanguageProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
