/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useContext, useState, useEffect, useRef } from 'react';
import WebSocketContext from './Provider';

/**
 * Hook to access WebSocket client and connection state
 * @returns {Object|null}
 */
export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    // Return safe defaults when used during SSR or outside provider
    return null;
  }
  return context;
}

/**
 * Hook to subscribe to a WebSocket channel
 * @param {string} channelName - Channel name to subscribe to
 * @returns {Array} Messages received on the channel
 */
export function useChannel(channelName) {
  const client = useContext(WebSocketContext);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!client || !channelName) return undefined;
    client.subscribe(channelName);
    const handler = data => setMessages(prev => [...prev, data]);
    client.on(`channel:${channelName}`, handler);
    return () => {
      client.off(`channel:${channelName}`, handler);
      client.unsubscribe(channelName);
    };
  }, [client, channelName]);

  return messages;
}

/**
 * Hook to subscribe to a specific WebSocket message type
 * @param {string} messageType - Message type to listen for
 * @param {Function} [handler] - Optional callback handler for messages
 * @returns {*} Last received message data
 */
export function useWebSocketMessage(messageType, handler) {
  const client = useContext(WebSocketContext);
  const [lastMessage, setLastMessage] = useState(null);
  const handlerRef = useRef(handler);

  // Keep handler ref updated without triggering effect
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!client || !messageType) return undefined;

    const onMessage = data => {
      setLastMessage(data);
      if (typeof handlerRef.current === 'function') {
        handlerRef.current(data);
      }
    };

    client.on(messageType, onMessage);
    return () => {
      client.off(messageType, onMessage);
    };
  }, [client, messageType]);

  return lastMessage;
}
