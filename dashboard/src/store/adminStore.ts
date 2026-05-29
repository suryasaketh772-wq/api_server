import { create } from "zustand";

export type LogLevel = "INFO" | "WARNING" | "ERROR" | "DEBUG";

export interface LogEntry {
  type: string;
  timestamp: number;
  level: LogLevel;
  logger: string;
  message: string;
}

export interface TelemetryPayload {
  timestamp: number;
  uptime_seconds: number;
  streaming_enabled?: boolean;
  system: {
    cpu_percent: number;
    ram: { total_bytes: number; used_bytes: number; percent: number };
    disk: { total_bytes: number; used_bytes: number; percent: number };
    network: { bytes_sent_per_sec: number; bytes_received_per_sec: number };
    process: { pid: number; memory_bytes: number };
    uptime_seconds: number;
  };
  websocket: {
    active_connections: number;
    broadcasts_per_sec: number;
    total_broadcasts: number;
    platform_distribution: Record<string, number>;
    clients: Array<{
      client_id: string;
      platform: string;
      ip_address: string;
      duration_seconds: number;
      latency_ms: number;
      reconnect_count: number;
      status: string;
    }>;
    error_count: number;
  };
  api: {
    status: string;
    latest_latency_ms: number;
    average_latency_ms: number;
    latency_history: number[];
    total_requests: number;
    successful_requests: number;
    failed_requests: number;
    success_rate_percent: number;
    last_success_timestamp: number;
  };
  cache: {
    latest_payload: Record<string, any>;
    cache_age_seconds: number;
    estimated_size_bytes: number;
    refresh_interval_seconds: number;
    status: string;
  };
  history: {
    gold: number[];
    silver: number[];
    timestamps: number[];
  };
}

export interface ChartDataPoint {
  time: string;
  connections: number;
  broadcastsSec: number;
  cpu: number;
  ram: number;
  networkSentKb: number;
  networkRecvKb: number;
  apiLatency: number;
  goldSpot: number;
  silverSpot: number;
}

interface AdminState {
  // Auth state
  token: string | null;
  username: string | null;
  isAuthenticated: boolean;
  
  // WS state
  socket: WebSocket | null;
  isConnected: boolean;
  isConnecting: boolean;
  
  // Dynamic metrics state
  latestTelemetry: TelemetryPayload | null;
  metricsHistory: ChartDataPoint[]; // stores last 30 data points for Recharts
  logs: LogEntry[];
  
  // UI filter controls
  logFilterLevel: "ALL" | LogLevel;
  logSearchQuery: string;
  clientSearchQuery: string;
  clientPlatformFilter: string;

  // Actions
  initializeAuth: () => void;
  login: (token: string, username: string) => void;
  logout: () => void;
  
  connectWS: (backendUrl: string) => void;
  disconnectWS: () => void;
  
  setLogFilterLevel: (level: "ALL" | LogLevel) => void;
  setLogSearchQuery: (query: string) => void;
  setClientSearchQuery: (query: string) => void;
  setClientPlatformFilter: (platform: string) => void;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  token: null,
  username: null,
  isAuthenticated: false,
  
  socket: null,
  isConnected: false,
  isConnecting: false,
  
  latestTelemetry: null,
  metricsHistory: [],
  logs: [],
  
  logFilterLevel: "ALL",
  logSearchQuery: "",
  clientSearchQuery: "",
  clientPlatformFilter: "ALL",

  initializeAuth: () => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("api_server_admin_token");
      const username = localStorage.getItem("api_server_admin_username");
      if (token && username) {
        set({ token, username, isAuthenticated: true });
      }
    }
  },

  login: (token, username) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("api_server_admin_token", token);
      localStorage.setItem("api_server_admin_username", username);
    }
    set({ token, username, isAuthenticated: true });
  },

  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("api_server_admin_token");
      localStorage.removeItem("api_server_admin_username");
    }
    get().disconnectWS();
    set({ token: null, username: null, isAuthenticated: false, logs: [], metricsHistory: [], latestTelemetry: null });
  },

  connectWS: (backendUrl) => {
    const { token, socket, isConnected, isConnecting } = get();
    if (!token || socket || isConnected || isConnecting) return;

    set({ isConnecting: true });

    // Resolve dynamic host URL without hardcoding localhost/127.0.0.1
    let baseHttpUrl = backendUrl;
    if (!baseHttpUrl && typeof window !== "undefined") {
      baseHttpUrl = window.location.origin;
    }
    
    // Dynamically translate dev frontend port 3000 to backend port 8000
    if (baseHttpUrl && baseHttpUrl.includes(":3000")) {
      baseHttpUrl = baseHttpUrl.replace(":3000", ":8000");
    }

    // Standardise websocket protocol URL from base HTTP host (converts http -> ws, https -> wss)
    const wsProto = baseHttpUrl.replace(/^http/, "ws");
    const wsUrl = `${wsProto}/ws/admin?token=${token}`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        set({ isConnected: true, isConnecting: false, socket: ws });
        console.log("[AdminStore] WebSocket connected to metrics engine.");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const nowTime = new Date().toLocaleTimeString();

          if (data.type === "telemetry") {
            const telemetry = data as TelemetryPayload;
            
            // Build Recharts compatible data snapshot points
            const newHistoryPoint: ChartDataPoint = {
              time: nowTime,
              connections: telemetry.websocket.active_connections,
              broadcastsSec: telemetry.websocket.broadcasts_per_sec,
              cpu: telemetry.system.cpu_percent,
              ram: telemetry.system.ram.percent,
              networkSentKb: roundDecimal(telemetry.system.network.bytes_sent_per_sec / 1024.0),
              networkRecvKb: roundDecimal(telemetry.system.network.bytes_received_per_sec / 1024.0),
              apiLatency: telemetry.api.latest_latency_ms,
              goldSpot: telemetry.cache.latest_payload?.gold_spot || 0.0,
              silverSpot: telemetry.cache.latest_payload?.silver_spot || 0.0,
            };

            set((state) => {
              const updatedHistory = [...state.metricsHistory, newHistoryPoint].slice(-30); // Maintain rolling 30 intervals
              return {
                latestTelemetry: telemetry,
                metricsHistory: updatedHistory
              };
            });
          } 
          
          else if (data.type === "stream_status_changed") {
            const enabled = data.enabled;
            set((state) => {
              if (state.latestTelemetry) {
                return {
                  latestTelemetry: {
                    ...state.latestTelemetry,
                    streaming_enabled: enabled
                  }
                };
              }
              return {};
            });
          }
          
          else if (data.type === "log_event") {
            const newLog = data as LogEntry;
            set((state) => {
              const updatedLogs = [newLog, ...state.logs].slice(0, 1000); // Caps live logs at 1000 items
              return { logs: updatedLogs };
            });
          } 
          
          else if (data.type === "log_history") {
            const historyData = data as { logs: LogEntry[] };
            // Logs history seeded inversely so newest appears at top
            const formattedLogs = [...historyData.logs].reverse();
            set({ logs: formattedLogs });
          }
        } catch (err) {
          console.warn("[AdminStore] Error parsing WebSocket frame:", err);
        }
      };

      ws.onerror = (err) => {
        console.error("[AdminStore] WebSocket encountered channel fault:", err);
      };

      ws.onclose = (event) => {
        set({ isConnected: false, isConnecting: false, socket: null });
        console.warn(`[AdminStore] WebSocket closed. Code: ${event.code}`);
        
        // Auto-reconnect loop on sudden network drops, ignoring voluntary exits (Code 1000/1001)
        if (event.code !== 1000 && event.code !== 1001 && get().isAuthenticated) {
          console.log("[AdminStore] Initiating scheduled auto-reconnect sequence in 5 seconds...");
          setTimeout(() => {
            if (get().isAuthenticated) {
              get().connectWS(backendUrl);
            }
          }, 5000);
        }
      };
    } catch (e) {
      set({ isConnecting: false, socket: null });
      console.error("[AdminStore] Error initializing WebSocket connection:", e);
    }
  },

  disconnectWS: () => {
    const { socket } = get();
    if (socket) {
      socket.close(1000, "User logged out");
      set({ socket: null, isConnected: false, isConnecting: false });
    }
  },

  setLogFilterLevel: (logFilterLevel) => set({ logFilterLevel }),
  setLogSearchQuery: (logSearchQuery) => set({ logSearchQuery }),
  setClientSearchQuery: (clientSearchQuery) => set({ clientSearchQuery }),
  setClientPlatformFilter: (clientPlatformFilter) => set({ clientPlatformFilter })
}));

function roundDecimal(val: number): number {
  return Math.round(val * 10) / 10;
}
