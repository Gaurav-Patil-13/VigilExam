import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config/api.js';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // 'connecting' | 'connected' | 'reconnecting' | 'offline'
  const [connectionError, setConnectionError] = useState(null);

  useEffect(() => {
    setConnectionStatus('connecting');
    setConnectionError(null);

    const socketInstance = io(SOCKET_URL, {
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
      timeout: 10000,
      transports: ['websocket', 'polling']
    });

    const onConnect = () => {
      console.log('[SocketContext] Connected to VigilExam Server:', socketInstance.id);
      setConnected(true);
      setConnectionStatus('connected');
      setConnectionError(null);
    };

    const onDisconnect = (reason) => {
      console.warn('[SocketContext] Disconnected from server:', reason);
      setConnected(false);
      setConnectionStatus('offline');
    };

    const onConnectError = (err) => {
      console.warn('[SocketContext] Connection error:', err.message);
      setConnected(false);
      setConnectionStatus('offline');
      setConnectionError(err.message);
    };

    const onReconnectAttempt = (attempt) => {
      console.log(`[SocketContext] Reconnecting attempt #${attempt}`);
      setConnectionStatus('reconnecting');
    };

    const onReconnectFailed = () => {
      console.error('[SocketContext] Reconnection failed');
      setConnected(false);
      setConnectionStatus('offline');
      setConnectionError('Failed to establish real-time socket connection.');
    };

    socketInstance.on('connect', onConnect);
    socketInstance.on('disconnect', onDisconnect);
    socketInstance.on('connect_error', onConnectError);
    socketInstance.io.on('reconnect_attempt', onReconnectAttempt);
    socketInstance.io.on('reconnect_failed', onReconnectFailed);

    setSocket(socketInstance);

    return () => {
      socketInstance.off('connect', onConnect);
      socketInstance.off('disconnect', onDisconnect);
      socketInstance.off('connect_error', onConnectError);
      socketInstance.io.off('reconnect_attempt', onReconnectAttempt);
      socketInstance.io.off('reconnect_failed', onReconnectFailed);
      socketInstance.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected,
        status: connectionStatus,
        connectionStatus,
        connectionError
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
