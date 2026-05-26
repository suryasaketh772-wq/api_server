"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shield, RefreshCw, Cpu, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useAdminStore } from "@/store/adminStore";

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, initializeAuth } = useAdminStore();

  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Initialize auth credentials on mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Redirect instantly if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push("/admin");
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput || !passwordInput) {
      setErrorMsg("Please provide all credential fields.");
      return;
    }

    setIsLoading(true);
    setErrorMsg("");

    // In local dev, points to localhost:8000; in production, queries relative Nginx proxy
    const apiHost = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

    try {
      const response = await fetch(`${apiHost}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput, password: passwordInput })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Unauthorised access credentials.");
      }

      const data = await response.json();
      login(data.token, data.username);
      router.push("/admin");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed connecting to api_server authentication.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <Card className="border border-gold-primary/30 shadow-[0_0_50px_rgba(212,175,55,0.1)] relative overflow-hidden bg-card/65 backdrop-blur-glass">
          
          {/* Accent Gold highlight bar on top */}
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-gold-light via-gold-primary to-gold-dark" />

          <CardHeader className="text-center pt-8">
            <div className="mx-auto bg-gold-primary/10 w-12 h-12 rounded-2xl flex items-center justify-center border border-gold-primary/25 mb-4 animate-pulse">
              <Cpu className="text-gold-primary w-6 h-6" />
            </div>
            <CardTitle className="text-2xl font-black tracking-tight text-white uppercase">
              api_server
            </CardTitle>
            <CardDescription className="text-xs font-semibold text-muted uppercase mt-1 tracking-widest">
              Access Protected Monitoring Panel
            </CardDescription>
          </CardHeader>

          <CardContent className="px-6 pb-8">
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              
              {/* Username Input */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-muted font-bold uppercase tracking-wider">
                  Admin Username
                </label>
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="Enter administrator ID..."
                  disabled={isLoading}
                  className="bg-white/5 border border-border text-sm rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-gold-primary/60 placeholder-muted font-medium transition-all"
                />
              </div>

              {/* Password Input */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-muted font-bold uppercase tracking-wider">
                  Security Password
                </label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter security credentials..."
                  disabled={isLoading}
                  className="bg-white/5 border border-border text-sm rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-gold-primary/60 placeholder-muted font-medium transition-all"
                />
              </div>

              {/* Alert Message */}
              <AnimatePresence>
                {errorMsg && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-red-accent/10 border border-red-accent/20 rounded-xl p-3 flex items-start gap-2.5 text-xs text-red-accent font-semibold leading-relaxed">
                      <AlertTriangle className="w-4 h-4 text-red-accent shrink-0 mt-0.5" />
                      <span>{errorMsg}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="py-3.5 text-sm uppercase tracking-wider font-extrabold flex items-center justify-center gap-2 mt-2"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-black" />
                    Validating Claims...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 text-black" />
                    Authorise Session
                  </>
                )}
              </Button>

            </form>
          </CardContent>

        </Card>
      </motion.div>
    </main>
  );
}
