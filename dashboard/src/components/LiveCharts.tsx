"use client";

import React, { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { useAdminStore } from "@/store/adminStore";

export default function LiveCharts() {
  const [mounted, setMounted] = useState(false);
  const metricsHistory = useAdminStore((state) => state.metricsHistory);

  // Prevents Next.js SSR hydration mismatch anomalies during SVG computations
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="h-80 w-full animate-pulse bg-white/5 flex items-center justify-center">
            <span className="text-sm text-muted font-semibold tracking-wider">Initialising live canvas charts...</span>
          </Card>
        ))}
      </div>
    );
  }

  // Inject defaults if history buffer is empty
  const chartData = metricsHistory.length > 0 ? metricsHistory : [
    { time: "00:00:00", connections: 0, broadcastsSec: 0, cpu: 0, ram: 0, networkSentKb: 0, networkRecvKb: 0, apiLatency: 0, goldSpot: 0, silverSpot: 0 }
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full">
      
      {/* 1. WebSocket Throughput Chart */}
      <Card className="h-[360px] bg-card border border-border">
        <CardHeader>
          <CardTitle>WebSocket Analytics</CardTitle>
        </CardHeader>
        <CardContent className="h-64 pr-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorWS" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(45, 60%, 55%)" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="hsl(45, 60%, 55%)" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorSpeed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(195, 80%, 50%)" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="hsl(195, 80%, 50%)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis dataKey="time" stroke="#666" fontSize={10} tickLine={false} />
              <YAxis stroke="#666" fontSize={10} tickLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: "#111317", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "12px" }}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" />
              <Area name="Active Sockets" type="monotone" dataKey="connections" stroke="hsl(45, 60%, 55%)" fillOpacity={1} fill="url(#colorWS)" strokeWidth={2} />
              <Area name="Broadcasts / Sec" type="monotone" dataKey="broadcastsSec" stroke="hsl(195, 80%, 50%)" fillOpacity={1} fill="url(#colorSpeed)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 2. DPGold API Latency Chart */}
      <Card className="h-[360px] bg-card border border-border">
        <CardHeader>
          <CardTitle>DPGold API Latency Response</CardTitle>
        </CardHeader>
        <CardContent className="h-64 pr-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis dataKey="time" stroke="#666" fontSize={10} tickLine={false} />
              <YAxis stroke="#666" fontSize={10} tickLine={false} unit="ms" />
              <Tooltip 
                contentStyle={{ backgroundColor: "#111317", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "12px" }}
                formatter={(value) => [`${value} ms`, "API Latency"]}
              />
              <Bar name="Latency (ms)" dataKey="apiLatency" fill="hsl(45, 60%, 55%)" radius={[4, 4, 0, 0]} maxBarSize={16}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.apiLatency > 400 ? "hsl(355, 80%, 55%)" : "hsl(45, 60%, 55%)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 3. Server System Resource Chart */}
      <Card className="h-[360px] bg-card border border-border">
        <CardHeader>
          <CardTitle>Server Resource Usage</CardTitle>
        </CardHeader>
        <CardContent className="h-64 pr-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorCPU" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(140, 80%, 48%)" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="hsl(140, 80%, 48%)" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorRAM" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(355, 80%, 55%)" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="hsl(355, 80%, 55%)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis dataKey="time" stroke="#666" fontSize={10} tickLine={false} />
              <YAxis stroke="#666" fontSize={10} tickLine={false} unit="%" />
              <Tooltip 
                contentStyle={{ backgroundColor: "#111317", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "12px" }}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" />
              <Area name="CPU load" type="monotone" dataKey="cpu" stroke="hsl(140, 80%, 48%)" fillOpacity={1} fill="url(#colorCPU)" strokeWidth={2} />
              <Area name="RAM usage" type="monotone" dataKey="ram" stroke="hsl(355, 80%, 55%)" fillOpacity={1} fill="url(#colorRAM)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 4. Bullion Spot Prices Trend */}
      <Card className="h-[360px] bg-card border border-border">
        <CardHeader>
          <CardTitle>Bullion Live Spots Trend</CardTitle>
        </CardHeader>
        <CardContent className="h-64 pr-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis dataKey="time" stroke="#666" fontSize={10} tickLine={false} />
              <YAxis stroke="#666" fontSize={10} tickLine={false} domain={["auto", "auto"]} />
              <Tooltip 
                contentStyle={{ backgroundColor: "#111317", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "12px" }}
                formatter={(value) => [`$${value}`, ""]}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" />
              <Line name="Gold Spot (oz)" type="monotone" dataKey="goldSpot" stroke="hsl(45, 60%, 55%)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line name="Silver Spot (oz)" type="monotone" dataKey="silverSpot" stroke="hsl(0, 0%, 85%)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

    </div>
  );
}
