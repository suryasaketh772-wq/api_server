"use client";

import React, { useEffect, useRef, useState } from "react";
import { Terminal, Shield, RefreshCw, Trash2, ArrowDown } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { useAdminStore, LogLevel, LogEntry } from "@/store/adminStore";

export default function LogsPanel() {
  const {
    logs,
    logFilterLevel,
    logSearchQuery,
    setLogFilterLevel,
    setLogSearchQuery
  } = useAdminStore();

  const [autoScroll, setAutoScroll] = useState(true);
  const [localLogs, setLocalLogs] = useState<LogEntry[]>([]);
  const consoleBottomRef = useRef<HTMLDivElement>(null);

  // Synchronise local listing or support clearing
  useEffect(() => {
    setLocalLogs(logs);
  }, [logs]);

  // Handle auto-scroll lock triggers
  useEffect(() => {
    if (autoScroll && consoleBottomRef.current) {
      consoleBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [localLogs, autoScroll]);

  const filteredLogs = localLogs.filter((log) => {
    // 1. Level check
    if (logFilterLevel !== "ALL" && log.level !== logFilterLevel) return false;
    
    // 2. Search check
    if (logSearchQuery.trim() !== "") {
      const q = logSearchQuery.toLowerCase();
      const messageMatch = log.message.toLowerCase().includes(q);
      const loggerMatch = log.logger.toLowerCase().includes(q);
      return messageMatch || loggerMatch;
    }
    
    return true;
  });

  const clearConsole = () => {
    setLocalLogs([]);
  };

  const getSeverityStyles = (level: LogLevel) => {
    switch (level) {
      case "ERROR":
        return "text-red-accent bg-red-accent/10 border-red-accent/20";
      case "WARNING":
        return "text-gold-primary bg-gold-primary/10 border-gold-primary/20";
      case "DEBUG":
        return "text-muted bg-white/5 border-white/10";
      default:
        return "text-cyan-400 bg-cyan-950/20 border-cyan-800/20";
    }
  };

  return (
    <Card className="flex flex-col h-[640px] bg-card border border-border">
      
      {/* Console Header Controllers */}
      <CardHeader className="flex flex-col md:flex-row md:items-center justify-between border-b border-border gap-4 pb-4">
        <div className="flex items-center gap-2">
          <Terminal className="text-gold-primary w-5 h-5 animate-pulse" />
          <CardTitle className="text-sm font-extrabold">Streaming Event Log Terminal</CardTitle>
        </div>
        
        {/* Dashboard controllers */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Level Filter Dropdown */}
          <div className="flex items-center bg-white/5 border border-border rounded-xl px-3 py-1">
            <Shield className="w-3.5 h-3.5 text-muted mr-2" />
            <select
              value={logFilterLevel}
              onChange={(e) => setLogFilterLevel(e.target.value as any)}
              className="bg-transparent border-0 text-xs font-semibold text-foreground focus:ring-0 focus:outline-none cursor-pointer"
            >
              <option value="ALL">ALL LEVELS</option>
              <option value="INFO">INFO</option>
              <option value="WARNING">WARNING</option>
              <option value="ERROR">ERROR</option>
              <option value="DEBUG">DEBUG</option>
            </select>
          </div>

          {/* Search Term Filter Input */}
          <input
            type="text"
            placeholder="Filter logs by message..."
            value={logSearchQuery}
            onChange={(e) => setLogSearchQuery(e.target.value)}
            className="bg-white/5 border border-border text-xs rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-gold-primary/60 w-44 placeholder-muted font-medium transition-all"
          />

          {/* Toggle Auto-Scroll lock */}
          <Button
            variant={autoScroll ? "outline" : "secondary"}
            size="sm"
            onClick={() => setAutoScroll(!autoScroll)}
            title="Toggle Auto-Scroll lock"
            className="flex items-center gap-1.5"
          >
            <ArrowDown className={`w-3.5 h-3.5 ${autoScroll ? "text-gold-primary" : "text-muted"}`} />
            <span className="text-[10px] tracking-wider uppercase">Scroll Lock</span>
          </Button>

          {/* Clear Logs */}
          <Button variant="danger" size="sm" onClick={clearConsole} className="flex items-center gap-1.5">
            <Trash2 className="w-3.5 h-3.5" />
            <span className="text-[10px] tracking-wider uppercase">Clear Console</span>
          </Button>
        </div>
      </CardHeader>

      {/*Monospace Terminal Stream screen */}
      <CardContent className="flex-1 bg-black/60 font-mono text-xs overflow-y-auto p-4 flex flex-col gap-2 rounded-b-2xl h-96 select-text">
        {filteredLogs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted gap-2 select-none">
            <RefreshCw className="w-6 h-6 animate-spin text-gold-primary/40" />
            <span className="text-[10px] font-bold tracking-widest uppercase">Awaiting telemetry logs stream...</span>
          </div>
        ) : (
          filteredLogs.map((log, index) => {
            const dateStr = new Date(log.timestamp * 1000).toISOString().split("T")[1].slice(0, -1);
            
            return (
              <div key={index} className="flex items-start gap-3 hover:bg-white/5 py-1 px-2 rounded transition-all duration-150">
                {/* Timestamp */}
                <span className="text-muted/65 font-bold select-none">{dateStr}</span>
                
                {/* Level Capsule Badge */}
                <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold border uppercase select-none ${getSeverityStyles(log.level)}`}>
                  {log.level}
                </span>

                {/* Logger module namespace */}
                <span className="text-gold-primary/70 font-semibold select-none">[{log.logger}]</span>

                {/* Log formatted content */}
                <span className="text-foreground/95 break-all flex-1 whitespace-pre-wrap">{log.message}</span>
              </div>
            );
          })
        )}
        
        {/* Scroll pin anchor target */}
        <div ref={consoleBottomRef} />
      </CardContent>

    </Card>
  );
}
