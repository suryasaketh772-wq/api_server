"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Cpu, RefreshCw, Wifi, Clock, Menu } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { useAdminStore } from "@/store/adminStore";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const {
    isAuthenticated,
    initializeAuth,
    connectWS,
    disconnectWS,
    isConnected,
    isConnecting,
    latestTelemetry
  } = useAdminStore();

  const [timeStr, setTimeStr] = useState("00:00:00");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Verify auth session details on mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Handle unauthenticated routes deflection
  useEffect(() => {
    // Timeout check to let local state initialisation resolve first
    const timer = setTimeout(() => {
      if (!useAdminStore.getState().isAuthenticated) {
        router.push("/");
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [isAuthenticated, router]);

  // Connect WebSocket when authenticated and active
  useEffect(() => {
    if (isAuthenticated) {
      const apiHost = process.env.NEXT_PUBLIC_BACKEND_URL || "";
      connectWS(apiHost);
    }
    return () => {
      disconnectWS();
    };
  }, [isAuthenticated, connectWS, disconnectWS]);

  // Standard runtime uptime ticking clock resolver
  useEffect(() => {
    if (!latestTelemetry) return;
    
    const interval = setInterval(() => {
      const start = Date.now() - (latestTelemetry.uptime_seconds * 1000);
      const totalSecs = Math.floor((Date.now() - start) / 1000);
      
      const d = Math.floor(totalSecs / 86400);
      const h = Math.floor((totalSecs % 86400) / 3600);
      const m = Math.floor((totalSecs % 3600) / 60);
      const s = totalSecs % 60;
      
      const formatted = `${d > 0 ? `${d}d ` : ""}${h.toString().padStart(2, "0")}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
      setTimeStr(formatted);
    }, 1000);

    return () => clearInterval(interval);
  }, [latestTelemetry]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-gold-primary" />
      </div>
    );
  }

  // Resolve API health indicator states
  const apiStatus = latestTelemetry?.api.status || "offline";
  const apiLatency = latestTelemetry?.api.latest_latency_ms || 0.0;

  return (
    <div className="flex bg-background text-foreground min-h-screen relative z-10">
      
      {/* Sidebar Navigation */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Container screen */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Dynamic Telemetry status Header */}
        <header className="h-16 md:h-20 border-b border-border bg-card/15 backdrop-blur-glass flex items-center justify-between px-4 md:px-8 shrink-0 gap-3">
          
          {/* Left section: Hamburger (mobile) + Status Pill */}
          <div className="flex items-center gap-3 min-w-0">

            {/* Hamburger — mobile only */}
            <button
              className="md:hidden flex-shrink-0 p-2 rounded-lg text-muted hover:text-foreground hover:bg-white/5 transition-all duration-200"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Service Status Pill */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold transition-all duration-300 flex-shrink-0 ${
              isConnected 
                ? "bg-green-accent/10 border-green-accent/20 text-green-accent" 
                : isConnecting 
                  ? "bg-sky-500/10 border-sky-500/20 text-sky-400"
                  : "bg-red-accent/10 border-red-accent/20 text-red-accent"
            }`}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                isConnected 
                  ? "bg-green-accent shadow-[0_0_8px_hsl(140,80%,48%)] animate-status-pulse" 
                  : isConnecting 
                    ? "bg-sky-400 animate-status-blink"
                    : "bg-red-accent shadow-[0_0_8px_hsl(355,80%,55%)]"
              }`} />
              <span className="uppercase tracking-widest text-[9px] whitespace-nowrap">
                {isConnected 
                  ? "Console Sync Active" 
                  : isConnecting 
                    ? "Re-connecting..." 
                    : "Console Offline"}
              </span>
            </div>
            
            {/* Live Client count — hidden on mobile */}
            {isConnected && latestTelemetry && (
              <span className="hidden lg:block text-[10px] text-muted font-extrabold uppercase tracking-widest truncate">
                Active Client Node Pools: {latestTelemetry.websocket.active_connections}
              </span>
            )}
          </div>

          {/* Right section: System Telemetry pills — hidden on mobile */}
          <div className="hidden md:flex items-center gap-6 flex-shrink-0">
            
            {/* Uptime clock */}
            <div className="flex items-center gap-2 text-xs font-semibold text-muted">
              <Clock className="w-4 h-4 text-gold-primary" />
              <span className="uppercase tracking-wider text-[10px]">Uptime:</span>
              <span className="text-foreground font-mono">{timeStr}</span>
            </div>

            {/* DPGold API state indicator */}
            <div className="flex items-center gap-2 text-xs font-semibold text-muted border-l border-border pl-6">
              <Wifi className={`w-4 h-4 ${
                apiStatus === "online" 
                  ? "text-green-accent" 
                  : apiStatus === "degraded"
                    ? "text-gold-primary"
                    : "text-red-accent"
              }`} />
              <span className="uppercase tracking-wider text-[10px]">DPGold API:</span>
              <span className={`font-bold ${
                apiStatus === "online" 
                  ? "text-green-accent" 
                  : apiStatus === "degraded"
                    ? "text-gold-primary"
                    : "text-red-accent"
              }`}>
                {apiStatus === "online" 
                  ? `ONLINE (${apiLatency}ms)` 
                  : apiStatus === "degraded"
                    ? "DEGRADED"
                    : "OUTAGE"}
              </span>
            </div>
            
          </div>
        </header>

        {/* Client screen Viewport */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 min-h-0">
          {children}
        </main>
        
      </div>
    </div>
  );
}
