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
  const { latestTelemetry, isConnected } = useAdminStore();
  const [prevPrices, setPrevPrices] = useState({ gold: 0, silver: 0 });
  const [flashClasses, setFlashClasses] = useState({ gold: "", silver: "" });

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
      
      {/* 1. Page Title */}
      <div className="flex flex-col">
        <h1 className="text-xl md:text-3xl font-extrabold tracking-tight uppercase text-white leading-tight">
          Metrics Operations Console
        </h1>
        <p className="text-xs md:text-sm text-muted font-semibold tracking-wider mt-1 uppercase">
          Live Centralised distributed price statistics monitor
        </p>
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

    </div>
  );
}
