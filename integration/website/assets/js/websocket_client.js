/**
 * Ultra-resilient WebSocket Client with Automatic REST Fallback Polling.
 * Handles automatic reconnects, active heartbeats, and transparently degrades
 * to GET /api/latest if WebSocket connections fail, re-promoting when connection heals.
 */
class BullionWebSocketClient {
    /**
     * @param {string} baseUrl - Base HTTP URL of the server (e.g., 'http://localhost:8000')
     * @param {Object} callbacks - Object containing event callbacks
     * @param {Function} callbacks.onPriceUpdate - Called when new pricing data is received
     * @param {Function} callbacks.onStateChange - Called with connection state strings
     */
    constructor(baseUrl, callbacks = {}) {
        // Normalise URLs to support HTTP/WS protocols correctly
        this.baseUrl = baseUrl.replace(/\/$/, '');
        
        // Generate or retrieve persistent client_id from localStorage
        let id = null;
        if (typeof window !== 'undefined' && window.localStorage) {
            id = window.localStorage.getItem('bullion_ws_client_id');
            if (!id) {
                if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
                    id = crypto.randomUUID();
                } else {
                    id = 'web_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
                }
                window.localStorage.setItem('bullion_ws_client_id', id);
            }
        }
        this.clientId = id || ('temp_' + Math.random().toString(36).substring(2, 15));
        this.platform = 'web';
        
        this.wsUrl = this.baseUrl.replace(/^http/, 'ws') + `/ws/prices?client_id=${this.clientId}&platform=${this.platform}`;
        
        this.onPriceUpdate = callbacks.onPriceUpdate || (() => {});
        this.onStateChange = callbacks.onStateChange || (() => {});
        
        this.socket = null;
        this.fallbackTimer = null;
        this.heartbeatTimer = null;
        this.reconnectTimer = null;
        
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000; // Starts at 1s
        this.isFallbackActive = false;
        this.isWebSocketEnabled = true; // Manual control override state
        
        this.state = 'DISCONNECTED';
        this._updateState('DISCONNECTED');
    }

    _updateState(newState) {
        this.state = newState;
        this.onStateChange(newState);
        console.log(`[BullionClient] Connection state: ${newState}`);
    }

    /**
     * Enables WebSocket connection and initiates connection.
     */
    enableWebSocket() {
        if (this.isWebSocketEnabled) return;
        this.isWebSocketEnabled = true;
        console.log('[BullionClient] WebSocket enabled manually.');
        
        // Disable REST Fallback polling loop if running
        this._stopRESTFallback();
        
        // Trigger reconnection sequence
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.connect();
    }

    /**
     * Disables WebSocket connection, cleanly closes active socket, and activates REST polling.
     */
    disableWebSocket() {
        if (!this.isWebSocketEnabled) return;
        this.isWebSocketEnabled = false;
        console.log('[BullionClient] WebSocket disabled manually.');
        
        // Cleanup socket connection and connection timers
        this._cleanupTimers();
        if (this.socket) {
            // Nullify event handlers to avoid triggering auto-disconnect/fallback loops again
            this.socket.onclose = null;
            this.socket.onerror = null;
            this.socket.close();
            this.socket = null;
        }
        
        this._updateState('DISCONNECTED');
        
        // Immediately engage REST fallback polling so updates continue
        this._startRESTFallback();
    }

    /**
     * Commences active connection attempts.
     */
    connect() {
        if (!this.isWebSocketEnabled) {
            console.log('[BullionClient] WS connection blocked (WebSocket disabled).');
            return;
        }
        if (this.socket && (this.socket.readyState === WebSocket.CONNECTING || this.socket.readyState === WebSocket.OPEN)) {
            return;
        }

        this._updateState('CONNECTING');
        this._cleanupTimers();

        try {
            this.socket = new WebSocket(this.wsUrl);
            
            this.socket.onopen = () => {
                this._updateState('CONNECTED');
                this.reconnectAttempts = 0;
                this.reconnectDelay = 1000;
                
                // If we were using the fallback polling loop, shut it down
                if (this.isFallbackActive) {
                    this._stopRESTFallback();
                }
                
                this._startHeartbeat();
            };

            this.socket.onmessage = (event) => {
                this._handleMessage(event.data);
            };

            this.socket.onerror = (error) => {
                console.error('[BullionClient] WebSocket error occurred:', error);
            };

            this.socket.onclose = (event) => {
                this._handleDisconnect();
            };
        } catch (e) {
            console.error('[BullionClient] Connection creation failed:', e);
            this._handleDisconnect();
        }
    }

    _handleMessage(rawData) {
        // Intercept ping frames (mostly server-side, but good for custom architectures)
        if (rawData === 'ping') {
            this.socket.send('pong');
            return;
        }
        
        try {
            const data = JSON.parse(rawData);
            this.onPriceUpdate(data);
        } catch (e) {
            console.warn('[BullionClient] Failed parsing WebSocket JSON:', rawData);
        }
    }

    _handleDisconnect() {
        this._cleanupHeartbeat();
        this.socket = null;

        if (!this.isWebSocketEnabled) {
            return;
        }

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            // Reconnection exponential backoff routine
            this._updateState('RECONNECTING');
            console.log(`[BullionClient] WS disconnected. Retrying in ${this.reconnectDelay}ms...`);
            
            this.reconnectTimer = setTimeout(() => {
                this.reconnectAttempts++;
                this.reconnectDelay *= 2; // Double delay
                this.connect();
            }, this.reconnectDelay);
        } else {
            // Exceeded retry limit - Engage REST Fallback Polling!
            console.warn('[BullionClient] WebSocket reconnect limit reached. Activating REST fallback...');
            this._startRESTFallback();
        }
    }

    /**
     * Fallback loop: Fetches pricing from REST /api/latest every 5s.
     * Periodically attempts a background WebSocket reconnection in parallel.
     */
    _startRESTFallback() {
        if (this.isFallbackActive) return;
        
        this.isFallbackActive = true;
        this._updateState('FALLBACK_POLLING');
        
        const fetchPrices = async () => {
            try {
                const response = await fetch(`${this.baseUrl}/api/latest`);
                if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
                const data = await response.json();
                console.log('[BullionClient] Fetched live rates via fallback REST route.');
                this.onPriceUpdate(data);
            } catch (e) {
                console.error('[BullionClient] REST fallback fetch failed:', e);
            }
        };

        // Fire first fetch instantly
        fetchPrices();
        
        // Poll every 5 seconds
        this.fallbackTimer = setInterval(fetchPrices, 5000);

        // Periodically test WebSocket connection health every 30 seconds
        this.wsTestTimer = setInterval(() => {
            if (!this.isWebSocketEnabled) return;
            console.log('[BullionClient] Attempting background WebSocket reconnection...');
            this.reconnectAttempts = 0;
            this.reconnectDelay = 1000;
            this.connect();
        }, 30000);
    }

    _stopRESTFallback() {
        this.isFallbackActive = false;
        if (this.fallbackTimer) {
            clearInterval(this.fallbackTimer);
            this.fallbackTimer = null;
        }
        if (this.wsTestTimer) {
            clearInterval(this.wsTestTimer);
            this.wsTestTimer = null;
        }
        console.log('[BullionClient] REST fallback deactivated. Real-time WebSockets restored.');
    }

    _startHeartbeat() {
        this._cleanupHeartbeat();
        // Send a ping message to backend every 25 seconds to keep proxy tunnels open
        this.heartbeatTimer = setInterval(() => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send('ping');
            }
        }, 25000);
    }

    _cleanupHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    _cleanupTimers() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this._cleanupHeartbeat();
    }

    disconnect() {
        this._cleanupTimers();
        this._stopRESTFallback();
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this._updateState('DISCONNECTED');
    }
}

export default BullionWebSocketClient;
