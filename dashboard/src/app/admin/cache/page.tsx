"use client";

import React from "react";
import { Database, RefreshCw, Layers, ShieldCheck, Zap } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useAdminStore } from "@/store/adminStore";

export default function AdminCachePage() {
  const { latestTelemetry, isConnected } = useAdminStore();

  const cache = latestTelemetry?.cache;
  const payload = cache?.latest_payload || {};
  const cacheAge = cache?.cache_age_seconds ?? 0.0;
  const sizeBytes = cache?.estimated_size_bytes ?? 0;
  const interval = cache?.refresh_interval_seconds ?? 2.0;
  const cacheStatus = cache?.status || "stale";

  // Helper formatters
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    return `${bytes} Bytes`;
  };

  const getStatusBadgeStyles = (status: string) => {
    if (status === "fresh") {
      return "bg-green-accent/10 border-green-accent/20 text-green-accent";
    }
    return "bg-red-accent/10 border-red-accent/20 text-red-accent";
  };

  return (
    <div className="flex flex-col gap-8 w-full">
      
      {/* Page Title */}
      <div className="flex flex-col">
        <h1 className="text-3xl font-extrabold tracking-tight uppercase text-white">
          Bullion Cache Inspector
        </h1>
        <p className="text-sm text-muted font-semibold tracking-wider mt-1 uppercase">
          In-memory atomic database caches and payload inspections
        </p>
      </div>

      {/* Main Grid: Diagnostics & Cache Properties */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
        
        {/* Cache Diagnostics Card */}
        <Card className="bg-card/45 backdrop-blur-glass border border-border lg:col-span-1">
          <CardHeader className="border-b border-border pb-4">
            <div className="flex items-center gap-2">
              <Database className="text-gold-primary w-5 h-5 animate-pulse" />
              <CardTitle className="text-sm font-extrabold">Cache Diagnostics</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-6 pt-6">
            
            {/* Cache Status Pill */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted font-bold uppercase tracking-wider">Database Status</span>
              <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold border uppercase tracking-wider ${getStatusBadgeStyles(cacheStatus)}`}>
                {isConnected ? cacheStatus : "offline"}
              </span>
            </div>

            {/* Cache Age */}
            <div className="flex items-center justify-between border-t border-border/40 pt-4">
              <span className="text-xs text-muted font-bold uppercase tracking-wider">Cache Lifespan Age</span>
              <span className="text-sm font-bold text-white font-mono">{isConnected ? `${cacheAge} secs` : "--"}</span>
            </div>

            {/* Refresh Interval */}
            <div className="flex items-center justify-between border-t border-border/40 pt-4">
              <span className="text-xs text-muted font-bold uppercase tracking-wider">Polling Interval</span>
              <span className="text-sm font-bold text-white font-mono">{isConnected ? `${interval} secs` : "--"}</span>
            </div>

            {/* Payload Size */}
            <div className="flex items-center justify-between border-t border-border/40 pt-4">
              <span className="text-xs text-muted font-bold uppercase tracking-wider">Estimated Object Size</span>
              <span className="text-sm font-bold text-white font-mono">{isConnected ? formatBytes(sizeBytes) : "--"}</span>
            </div>

          </CardContent>
        </Card>

        {/* Live Cached Payload Inspection */}
        <Card className="bg-card/45 backdrop-blur-glass border border-border lg:col-span-2 flex flex-col h-[400px]">
          <CardHeader className="border-b border-border pb-4">
            <div className="flex items-center gap-2">
              <Layers className="text-gold-primary w-5 h-5" />
              <CardTitle className="text-sm font-extrabold">Pretty JSON Inspector</CardTitle>
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 bg-black/60 font-mono text-xs overflow-y-auto p-4 rounded-b-2xl select-text">
            {isConnected && Object.keys(payload).length > 0 ? (
              <pre className="text-gold-light whitespace-pre">{JSON.stringify(payload, null, 2)}</pre>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted gap-2 select-none">
                <RefreshCw className="w-6 h-6 animate-spin text-gold-primary/40" />
                <span className="text-[10px] font-bold tracking-widest uppercase">Fetching cached dataset...</span>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Cache Security details alert box */}
      <div className="bg-gold-primary/5 border border-gold-primary/15 rounded-2xl p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-gold-primary/10 flex items-center justify-center border border-gold-primary/20 shrink-0">
          <Zap className="text-gold-primary w-5 h-5 animate-bounce" />
        </div>
        <div className="flex flex-col gap-1 leading-relaxed">
          <span className="text-sm font-bold text-white uppercase tracking-wider">Real-Time Lock-Free Caching Policy</span>
          <span className="text-xs text-muted font-medium">
            This administrative cache is updated reactively by the <code className="text-gold-primary font-mono bg-white/5 px-1 py-0.5 rounded">BullionPollingService</code> loop. REST clients reading from <code className="text-gold-primary font-mono bg-white/5 px-1 py-0.5 rounded">/api/latest</code> receive this in-memory atomic record instantly without hitting DPGold rate limit allocations, shielding host latency overheads to sub-milliseconds.
          </span>
        </div>
      </div>

    </div>
  );
}
