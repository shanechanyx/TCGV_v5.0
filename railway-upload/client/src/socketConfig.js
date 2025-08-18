// Socket.io server URL - automatically detect production vs development
export const SOCKET_SERVER_URL = process.env.NODE_ENV === 'production' 
  ? window.location.origin 
  : 'http://localhost:3001';

// Socket.io connection options
export const SOCKET_OPTIONS = {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 20000,
  autoConnect: true,
  forceNew: true,
  path: '/socket.io/',
  query: {},
  extraHeaders: {}
}; 