/**
 * VigilExam - useNetworkMonitor Hook
 * 
 * Periodically measures real backend health, round-trip latency (ms),
 * and Socket.io connectivity.
 */

import { useState, useEffect, useCallback } from 'react';
import { networkMonitor } from '../security/networkMonitor';
import { useSocket } from '../context/SocketContext';

export const useNetworkMonitor = () => {
  const { socket, connected: socketConnected } = useSocket();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [backendHealthy, setBackendHealthy] = useState(false);
  const [latencyMs, setLatencyMs] = useState(0);

  const checkNetwork = useCallback(async () => {
    const res = await networkMonitor.checkHealth(socket);
    setIsOnline(res.isOnline);
    setBackendHealthy(res.backendHealthy);
    setLatencyMs(res.latencyMs);
    return res;
  }, [socket]);

  useEffect(() => {
    checkNetwork();
    const timer = setInterval(() => {
      checkNetwork();
    }, 4000);

    return () => clearInterval(timer);
  }, [checkNetwork]);

  return {
    isOnline,
    backendHealthy,
    socketConnected,
    latencyMs,
    checkNetwork
  };
};
