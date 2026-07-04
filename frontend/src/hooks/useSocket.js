import { useContext, useEffect, useState } from 'react';
import { SocketContext } from '../context/SocketContext';

export const useSocket = (eventName, callback) => {
  const { socket, isConnected } = useContext(SocketContext);
  const [lastMessage, setLastMessage] = useState(null);

  useEffect(() => {
    if (!socket || !isConnected || !eventName) return;

    const handler = (data) => {
      setLastMessage(data);
      if (callback) callback(data);
    };

    socket.on(eventName, handler);

    return () => {
      socket.off(eventName, handler);
    };
  }, [socket, isConnected, eventName, callback]);

  return { socket, isConnected, lastMessage };
};
