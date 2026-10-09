/**
 * VigilExam - Network & Realtime Health Monitor
 * 
 * Conducts real network health checks, round-trip latency measurements,
 * and tracks Socket.IO connection status.
 */

class NetworkMonitor {
  constructor() {
    this.isOnline = navigator.onLine;
    this.lastLatencyMs = 0;
    this.backendHealthy = false;
    this.socketConnected = false;
    this.listeners = new Set();
    this.checkTimer = null;
  }

  async checkHealth(socketInstance) {
    const isOnline = navigator.onLine;
    this.socketConnected = socketInstance?.connected || false;

    let latency = 0;
    let backendHealthy = false;

    if (isOnline) {
      try {
        const start = performance.now();
        const res = await fetch('http://localhost:4000/api/health', {
          method: 'GET',
          cache: 'no-store'
        });
        const elapsed = Math.round(performance.now() - start);
        if (res.ok) {
          backendHealthy = true;
          latency = elapsed;
        }
      } catch (e) {
        backendHealthy = false;
      }
    }

    const previousOnline = this.isOnline;
    this.isOnline = isOnline && backendHealthy;
    this.lastLatencyMs = latency;
    this.backendHealthy = backendHealthy;

    if (!this.isOnline && previousOnline) {
      this.emitEvent({
        type: 'NETWORK_DISCONNECTED',
        severity: 'low',
        message: 'Network or backend connection lost',
        timestamp: new Date().toISOString()
      });
    } else if (this.isOnline && !previousOnline) {
      this.emitEvent({
        type: 'NETWORK_RECONNECTED',
        severity: 'info',
        latencyMs: latency,
        message: `Network re-established (Latency: ${latency}ms)`,
        timestamp: new Date().toISOString()
      });
    }

    return {
      isOnline: this.isOnline,
      backendHealthy: this.backendHealthy,
      socketConnected: this.socketConnected,
      latencyMs: latency
    };
  }

  startPeriodicCheck(socketInstance, intervalMs = 4000, onEventCallback) {
    if (onEventCallback) this.listeners.add(onEventCallback);
    this.checkHealth(socketInstance);
    this.checkTimer = setInterval(() => {
      this.checkHealth(socketInstance);
    }, intervalMs);
  }

  stopPeriodicCheck() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  emitEvent(event) {
    for (const cb of this.listeners) {
      try {
        cb(event);
      } catch (e) {}
    }
  }
}

export const networkMonitor = new NetworkMonitor();
