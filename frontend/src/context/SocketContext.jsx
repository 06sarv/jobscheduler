import { createContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';

export const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const { token, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const newSocket = io('/', {
      auth: { token },
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity
    });

    newSocket.on('connect', () => setIsConnected(true));
    newSocket.on('disconnect', () => setIsConnected(false));
    
    // Mock events for UI demonstration if real backend isn't emitting them yet
    const mockInterval = setInterval(() => {
      if (!newSocket.connected) return;
      // Randomly update queue depth for visual effect
      newSocket.emit('queue:stats_updated', { 
        queueId: 'q-1', 
        depth: Math.floor(Math.random() * 100), 
        processing: Math.floor(Math.random() * 10) 
      });
    }, 5000);

    setSocket(newSocket);

    return () => {
      clearInterval(mockInterval);
      newSocket.disconnect();
    };
  }, [isAuthenticated, token]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
