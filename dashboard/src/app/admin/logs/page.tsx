"use client";

import React from "react";
import LogsPanel from "@/components/LogsPanel";

export default function AdminLogsPage() {
  return (
    <div className="flex flex-col gap-8 w-full">
      
      {/* Page Title */}
      <div className="flex flex-col">
        <h1 className="text-3xl font-extrabold tracking-tight uppercase text-white">
          Realtime Logging Center
        </h1>
        <p className="text-sm text-muted font-semibold tracking-wider mt-1 uppercase">
          Live streaming logs, error reports and event audits
        </p>
      </div>

      {/* Monospace console stream */}
      <div className="w-full">
        <LogsPanel />
      </div>

    </div>
  );
}
