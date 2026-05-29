"use client";

import React, { useEffect, useState } from "react";
import { 
  Users, 
  Send, 
  Cpu, 
  HardDrive, 
  Wifi, 
  Activity, 
  AlertOctagon, 
  DollarSign 
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import LiveCharts from "@/components/LiveCharts";
import { useAdminStore } from "@/store/adminStore";

export default function AdminDashboardPage() {
  const { latestTelemetry, isConnected, token } = useAdminStore();
  const [prevPrices, setPrevPrices] = useState({ gold: 0, silver: 0 });
  const [flashClasses, setFlashClasses] = useState({ gold: "", silver: "" });

  // Custom Local Stream Telemetry Sync States
  const [localStreamingEnabled, setLocalStreamingEnabled] = useState<boolean | null>(null);
  const [isToggling, setIsToggling] = useState(false);

  // Custom Toast State Stack
  interface ToastMessage {
    id: string;
    message: string;
    type: "success" | "warning";
  }
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (message: string, type: "success" | "warning") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const getBackendUrl = () => {
    const envUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (envUrl) return envUrl;
    
    if (typeof window !== "undefined") {
      const origin = window.location.origin;
      if (origin.includes(":3000")) {
        return origin.replace(":3000", ":8000");
      }
      return origin;
    }
    return "";
  };

  const streamingEnabled = localStreamingEnabled !== null 
    ? localStreamingEnabled 
    : (latestTelemetry?.streaming_enabled ?? true);

  // Sync state dynamically when other admins push a websocket toggler update
  useEffect(() => {
    if (latestTelemetry?.streaming_enabled !== undefined) {
      setLocalStreamingEnabled(latestTelemetry.streaming_enabled);
    }
  }, [latestTelemetry?.streaming_enabled]);

  // Fetch initial stream status from REST API on page load
  useEffect(() => {
    const fetchStreamStatus = async () => {
      if (!token) return;
      try {
        const apiHost = getBackendUrl();
        const response = await fetch(`${apiHost}/api/admin/stream-status`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setLocalStreamingEnabled(data.enabled);
        }
      } catch (err) {
        console.error("Failed to retrieve price stream status:", err);
      }
    };

    fetchStreamStatus();
  }, [token]);

  // Handler to toggle active price broadcasting engine
  const handleToggleStreaming = async () => {
    if (isToggling || !token) return;
    setIsToggling(true);
    const targetState = !streamingEnabled;
    
    try {
      const apiHost = getBackendUrl();
      const response = await fetch(`${apiHost}/api/admin/toggle-stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ enabled: targetState })
      });
      
      if (response.ok) {
        const data = await response.json();
        setLocalStreamingEnabled(data.enabled);
        addToast(
          data.enabled ? "Streaming Engine Enabled" : "Streaming Engine Paused",
          data.enabled ? "success" : "warning"
        );
      } else {
        addToast("Failed to alter price streaming state", "warning");
      }
    } catch (err) {
      console.error("Error setting pricing stream status:", err);
      addToast("Network boundary connection error", "warning");
    } finally {
      setIsToggling(false);
    }
  };

  // Monitor price changes and apply micro green/red flash visual cues
  useEffect(() => {
    if (!latestTelemetry) return;
    const gold = latestTelemetry.cache.latest_payload?.gold_spot || 0;
    const silver = latestTelemetry.cache.latest_payload?.silver_spot || 0;

    let goldFlash = "";
    let silverFlash = "";

    if (prevPrices.gold > 0 && gold !== prevPrices.gold) {
      goldFlash = gold > prevPrices.gold ? "price-flash-up" : "price-flash-down";
    }
    if (prevPrices.silver > 0 && silver !== prevPrices.silver) {
      silverFlash = silver > prevPrices.silver ? "price-flash-up" : "price-flash-down";
    }

    if (goldFlash) {
      setFlashClasses(f => ({ ...f, gold: goldFlash }));
      const timer = setTimeout(() => setFlashClasses(f => ({ ...f, gold: "" })), 700);
      prevPrices.gold = gold;
    }
    if (silverFlash) {
      setFlashClasses(f => ({ ...f, silver: silverFlash }));
      const timer = setTimeout(() => setFlashClasses(f => ({ ...f, silver: "" })), 700);
      prevPrices.silver = silver;
    }

    if (prevPrices.gold === 0) prevPrices.gold = gold;
    if (prevPrices.silver === 0) prevPrices.silver = silver;

  }, [latestTelemetry, prevPrices]);

  // Helper formatter for data sizes
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // Resolve active telemetry metrics values
  const activeSockets = latestTelemetry?.websocket.active_connections ?? 0;
  const broadcastsSec = latestTelemetry?.websocket.broadcasts_per_sec ?? 0.0;
  const cpuPercent = latestTelemetry?.system.cpu_percent ?? 0.0;
  const ramPercent = latestTelemetry?.system.ram.percent ?? 0.0;
  const apiLatency = latestTelemetry?.api.latest_latency_ms ?? 0.0;
  const apiSuccessRate = latestTelemetry?.api.success_rate_percent ?? 100.0;
  const errorCount = latestTelemetry?.websocket.error_count ?? 0;
  
  const goldSpot = latestTelemetry?.cache.latest_payload?.gold_spot ?? 0.0;
  const silverSpot = latestTelemetry?.cache.latest_payload?.silver_spot ?? 0.0;
  const usdInr = latestTelemetry?.cache.latest_payload?.usd_inr ?? 0.0;

  const metricsList = [
    {
      title: "Active WebSockets",
      value: activeSockets,
      description: "Live connected client pool nodes",
      icon: Users,
      color: "text-gold-primary",
      bgGlow: "rgba(212, 175, 55, 0.05)"
    },
    {
      title: "Broadcast / Sec",
      value: `${broadcastsSec} msg/s`,
      description: "Realtime messaging throughput",
      icon: Send,
      color: "text-sky-400",
      bgGlow: "rgba(56, 189, 248, 0.05)"
    },
    {
      title: "Server CPU Load",
      value: `${cpuPercent}%`,
      description: "FastAPI processor core usage",
      icon: Cpu,
      color: "text-green-accent",
      bgGlow: "rgba(0, 255, 102, 0.05)"
    },
    {
      title: "Server RAM Usage",
      value: `${ramPercent}%`,
      description: `Process load: ${formatBytes(latestTelemetry?.system.process.memory_bytes || 0)}`,
      icon: HardDrive,
      color: "text-rose-500",
      bgGlow: "rgba(244, 63, 94, 0.05)"
    },
    {
      title: "DPGold Response",
      value: `${apiLatency} ms`,
      description: `API Uptime: ${apiSuccessRate}% success ratio`,
      icon: Wifi,
      color: "text-gold-light",
      bgGlow: "rgba(212, 175, 55, 0.05)"
    },
    {
      title: "System Error Rate",
      value: errorCount,
      description: "Outage triggers and reconnect attempts",
      icon: AlertOctagon,
      color: errorCount > 0 ? "text-red-accent" : "text-muted",
      bgGlow: errorCount > 0 ? "rgba(255, 59, 48, 0.05)" : "transparent"
    }
  ];

  return (
    <div className="flex flex-col gap-8 w-full">
      
      {/* 1. Page Title & Streaming Control Toggle */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex flex-col">
          <h1 className="text-xl md:text-3xl font-extrabold tracking-tight uppercase text-white leading-tight">
            Metrics Operations Console
          </h1>
          <p className="text-xs md:text-sm text-muted font-semibold tracking-wider mt-1 uppercase">
            Live Centralised distributed price statistics monitor
          </p>
        </div>

        {/* Glassmorphic Toggling Control Board */}
        <div className="flex items-center gap-4 bg-card/65 border border-border backdrop-blur-glass px-4 py-3 rounded-2xl flex-shrink-0 self-start md:self-auto shadow-xl transition-all duration-300 hover:border-white/10">
          
          {/* Animated Status Pulse Indicators */}
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                streamingEnabled ? "bg-[#00ff66]" : "bg-[#ff3b30]"
              }`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${
                streamingEnabled ? "bg-[#00ff66]" : "bg-[#ff3b30]"
              }`}></span>
            </span>
            <span className="text-[10px] md:text-xs font-black uppercase tracking-widest text-white font-mono">
              {streamingEnabled ? "STREAMING LIVE" : "STREAM PAUSED"}
            </span>
          </div>

          {/* Separation line */}
          <div className="h-5 w-px bg-border"></div>

          {/* Toggle Switch Button */}
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={streamingEnabled} 
              disabled={isToggling}
              onChange={handleToggleStreaming} 
              className="sr-only peer"
            />
            {/* The Switch slider bar */}
            <div className={`w-11 h-6 bg-white/10 rounded-full peer peer-focus:ring-0 outline-none transition-all duration-300 relative border border-white/5 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white/80 after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-amber-400 peer-checked:to-yellow-600 peer-checked:border-gold-primary ${
              isToggling ? "opacity-50 cursor-wait" : ""
            }`}>
              {isToggling && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="w-2.5 h-2.5 border-2 border-t-transparent border-white rounded-full animate-spin"></span>
                </span>
              )}
            </div>
          </label>

        </div>
      </div>

      {/* 2. Live Spot Pricing Accent Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 w-full">
        
        {/* Spot Gold */}
        <Card className="border-l-4 border-l-gold-primary bg-card/65 relative overflow-hidden">
          <CardHeader className="pb-1">
            <span className="text-[10px] text-muted font-bold tracking-widest uppercase">Spot Metal</span>
            <CardTitle className="text-xs">GOLD OUNCE SPOT</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between pt-2">
            <span className={`text-3xl font-black tracking-tight ${flashClasses.gold || "text-white"}`}>
              {goldSpot > 0 ? `$${goldSpot.toLocaleString()}` : "$--"}
            </span>
            <div className="w-10 h-10 rounded-xl bg-gold-primary/10 flex items-center justify-center border border-gold-primary/20">
              <DollarSign className="text-gold-primary w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Spot Silver */}
        <Card className="border-l-4 border-l-white/60 bg-card/65 relative overflow-hidden">
          <CardHeader className="pb-1">
            <span className="text-[10px] text-muted font-bold tracking-widest uppercase">Spot Metal</span>
            <CardTitle className="text-xs">SILVER OUNCE SPOT</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between pt-2">
            <span className={`text-3xl font-black tracking-tight ${flashClasses.silver || "text-white"}`}>
              {silverSpot > 0 ? `$${silverSpot.toLocaleString()}` : "$--"}
            </span>
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
              <DollarSign className="text-white/80 w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Currency Rates */}
        <Card className="border-l-4 border-l-teal-500 bg-card/65 relative overflow-hidden">
          <CardHeader className="pb-1">
            <span className="text-[10px] text-muted font-bold tracking-widest uppercase">Exchange Index</span>
            <CardTitle className="text-xs">USD / INR EXCHANGE RATE</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between pt-2">
            <span className="text-3xl font-black tracking-tight text-white">
              {usdInr > 0 ? usdInr.toFixed(2) : "--"}
            </span>
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20">
              <Activity className="text-teal-400 w-5 h-5" />
            </div>
          </CardContent>
        </Card>

      </div>

      {/* 3. System Overview metric cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 w-full">
        {metricsList.map((metric, index) => {
          const Icon = metric.icon;
          
          return (
            <Card 
              key={index}
              className="bg-card/45 backdrop-blur-glass relative overflow-hidden"
              style={{ shadow: `0 10px 30px ${metric.bgGlow}` } as any}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">
                  {metric.title}
                </span>
                <Icon className={`w-4 h-4 ${metric.color}`} />
              </CardHeader>
              <CardContent className="flex flex-col gap-1 pt-2">
                <span className="text-3xl font-black tracking-tight text-white font-mono">
                  {isConnected ? metric.value : "--"}
                </span>
                <span className="text-[11px] text-muted font-semibold mt-1">
                  {metric.description}
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 4. Live Charts grid layout */}
      <div className="w-full mt-2 min-w-0 overflow-hidden">
        <LiveCharts />
      </div>

      {/* 5. Custom Glassmorphic Toast Stack Overlay */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none max-w-sm w-full sm:w-auto">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 px-5 py-3.5 rounded-2xl border backdrop-blur-md shadow-2xl transition-all duration-500 transform translate-y-0 ease-out animate-in slide-in-from-bottom-5 fade-in ${
              toast.type === "success"
                ? "bg-[#00ff66]/10 border-[#00ff66]/20 text-[#00ff66]"
                : "bg-[#ff3b30]/10 border-[#ff3b30]/20 text-[#ff3b30]"
            }`}
          >
            <span className={`relative flex h-2 w-2 rounded-full ${
              toast.type === "success" ? "bg-[#00ff66]" : "bg-[#ff3b30]"
            }`}>
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                toast.type === "success" ? "bg-[#00ff66]" : "bg-[#ff3b30]"
              }`}></span>
            </span>
            <span className="text-[11px] font-black uppercase tracking-wider text-white font-sans">
              {toast.message}
            </span>
          </div>
        ))}
      </div>

    </div>
  );
}
