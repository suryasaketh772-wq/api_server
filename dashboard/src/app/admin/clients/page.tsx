"use client";

import React, { useState } from "react";
import { Users, Search, Filter, ShieldAlert, Cpu, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { useAdminStore } from "@/store/adminStore";

export default function ConnectedClientsPage() {
  const {
    latestTelemetry,
    clientSearchQuery,
    clientPlatformFilter,
    setClientSearchQuery,
    setClientPlatformFilter
  } = useAdminStore();

  const [sortField, setSortField] = useState<"duration" | "latency">("duration");
  const [sortAsc, setSortAsc] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Retrieve active clients list safely
  const clients = latestTelemetry?.websocket.clients || [];

  // 1. Apply active client filters
  const filteredClients = clients.filter((client) => {
    // Platform search filter
    if (clientPlatformFilter !== "ALL" && client.platform !== clientPlatformFilter) return false;

    // Substring searches for ID or IP address
    if (clientSearchQuery.trim() !== "") {
      const q = clientSearchQuery.toLowerCase();
      const idMatch = client.client_id.toLowerCase().includes(q);
      const ipMatch = client.ip_address.toLowerCase().includes(q);
      return idMatch || ipMatch;
    }

    return true;
  });

  // 2. Apply active sort matrices
  const sortedClients = [...filteredClients].sort((a, b) => {
    let diff = 0;
    if (sortField === "duration") {
      diff = a.duration_seconds - b.duration_seconds;
    } else if (sortField === "latency") {
      diff = a.latency_ms - b.latency_ms;
    }
    return sortAsc ? diff : -diff;
  });

  // 3. Paginate
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const paginatedClients = sortedClients.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(sortedClients.length / itemsPerPage) || 1;

  const toggleSort = (field: "duration" | "latency") => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
    setCurrentPage(1);
  };

  // Helper formatters
  const formatDuration = (totalSecs: number): string => {
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = Math.floor(totalSecs % 60);
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const getLatencyStyles = (latency: number) => {
    if (latency <= 0) return "text-muted font-normal";
    if (latency <= 45) return "text-green-accent font-bold";
    if (latency <= 120) return "text-gold-primary font-bold";
    return "text-red-accent font-bold";
  };

  const getPlatformBadge = (platform: string) => {
    switch (platform) {
      case "Flutter App":
        return "bg-sky-500/10 border-sky-500/20 text-sky-400";
      case "Android Widget":
      case "iOS Widget":
        return "bg-gold-primary/10 border-gold-primary/20 text-gold-primary";
      default:
        return "bg-white/5 border-white/10 text-muted";
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full">
      
      {/* Page Title */}
      <div className="flex flex-col">
        <h1 className="text-3xl font-extrabold tracking-tight uppercase text-white">
          Active Socket Connections
        </h1>
        <p className="text-sm text-muted font-semibold tracking-wider mt-1 uppercase">
          Realtime client registries, platforms and latency indices
        </p>
      </div>

      {/* Grid Filtering options */}
      <Card className="bg-card/45 backdrop-blur-glass border border-border">
        <CardContent className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4 pt-4">
          <div className="flex items-center gap-2">
            <Users className="text-gold-primary w-5 h-5 animate-pulse" />
            <span className="text-sm font-bold uppercase tracking-wider text-white">
              Connected Client Registry list ({filteredClients.length})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search Client ID or IP..."
                value={clientSearchQuery}
                onChange={(e) => {
                  setClientSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-white/5 border border-border text-xs rounded-xl pl-9 pr-3 py-2.5 text-foreground focus:outline-none focus:border-gold-primary/60 w-52 placeholder-muted font-semibold transition-all"
              />
            </div>

            {/* Platform selection filters dropdown */}
            <div className="flex items-center bg-white/5 border border-border rounded-xl px-3 py-1.5">
              <Filter className="w-3.5 h-3.5 text-muted mr-2" />
              <select
                value={clientPlatformFilter}
                onChange={(e) => {
                  setClientPlatformFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent border-0 text-xs font-semibold text-foreground focus:ring-0 focus:outline-none cursor-pointer"
              >
                <option value="ALL">ALL PLATFORMS</option>
                <option value="Flutter App">Flutter App</option>
                <option value="Android Widget">Android Widget</option>
                <option value="iOS Widget">iOS Widget</option>
                <option value="Chrome Browser">Chrome Browser</option>
                <option value="Firefox Browser">Firefox Browser</option>
                <option value="Safari Browser">Safari Browser</option>
              </select>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Main Table card */}
      <Card className="bg-card/45 backdrop-blur-glass border border-border">
        <CardContent className="p-0">
          {paginatedClients.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-muted gap-2">
              <ShieldAlert className="w-8 h-8 text-gold-primary/40 animate-pulse" />
              <span className="text-[10px] font-bold tracking-widest uppercase">No matching clients found in active pools.</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Client ID</TableHead>
                  <TableHead className="w-36">Platform</TableHead>
                  <TableHead className="w-36">IP Address</TableHead>
                  <TableHead className="w-28 cursor-pointer hover:text-white transition-colors" onClick={() => toggleSort("latency")}>
                    <div className="flex items-center gap-1">
                      WS Latency
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </TableHead>
                  <TableHead className="w-36 cursor-pointer hover:text-white transition-colors" onClick={() => toggleSort("duration")}>
                    <div className="flex items-center gap-1">
                      Active Session
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </TableHead>
                  <TableHead className="w-24">Retries</TableHead>
                  <TableHead className="w-24">State</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedClients.map((client) => (
                  <TableRow key={client.client_id}>
                    
                    {/* ID */}
                    <TableCell className="font-mono text-xs text-white">
                      {client.client_id}
                    </TableCell>
                    
                    {/* Platform Badge */}
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold border uppercase ${getPlatformBadge(client.platform)}`}>
                        {client.platform}
                      </span>
                    </TableCell>
                    
                    {/* IP Address */}
                    <TableCell className="font-mono text-xs text-muted/95">
                      {client.ip_address}
                    </TableCell>
                    
                    {/* Latency */}
                    <TableCell className={getLatencyStyles(client.latency_ms)}>
                      {client.latency_ms > 0 ? `${client.latency_ms} ms` : "--"}
                    </TableCell>
                    
                    {/* Active duration */}
                    <TableCell className="font-mono text-xs text-foreground/95">
                      {formatDuration(client.duration_seconds)}
                    </TableCell>

                    {/* Reconnect rate count */}
                    <TableCell className="font-mono text-xs text-muted/90">
                      {client.reconnect_count}
                    </TableCell>
                    
                    {/* Status Pill */}
                    <TableCell>
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-green-accent/10 border border-green-accent/20 text-green-accent uppercase tracking-wider">
                        {client.status}
                      </span>
                    </TableCell>

                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination control buttons */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-3 mt-1">
          <Button
            variant="secondary"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(c => Math.max(1, c - 1))}
          >
            Previous Page
          </Button>
          <span className="text-xs text-muted font-bold uppercase tracking-wider">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(c => Math.min(totalPages, c + 1))}
          >
            Next Page
          </Button>
        </div>
      )}

    </div>
  );
}
