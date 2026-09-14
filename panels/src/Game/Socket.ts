import { getSocketUrl } from './Backend';

type MessageHandler = (message: any) => void;
const listeners = new Set<MessageHandler>();
type StateType = 'user_data' | 'ship_selection' | 'input';
const latestState = new Map<StateType, Record<string, unknown>>();
let isConnected = false;
let playerId = localStorage.getItem('playerId');
let token = localStorage.getItem('token');
let socket: WebSocket;
let socketUrl = getSocketUrl();
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let lastConnection: { type: 'connected'; id: string; token: string } | undefined;

function scheduleReconnect(delay = 1000) {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => { reconnectTimer = undefined; connect(socketUrl); }, delay);
}

function deliver(handler: MessageHandler, message: any) {
  try { handler(message); }
  catch (error) { console.error('[socket] message handler failed:', error); }
}

export function connect(url: string = socketUrl): WebSocket {
  socketUrl = url;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return socket;
  clearTimeout(reconnectTimer);
  isConnected = false;
  lastConnection = undefined;
  const current = new WebSocket(socketUrl);
  socket = current;
  current.addEventListener('open', () => {
    if (socket === current) current.send(JSON.stringify({ type: 'handshake', id: playerId, token }));
  });
  current.addEventListener('message', event => {
    if (socket !== current) return;
    let message;
    try { message = JSON.parse(event.data); }
    catch { console.warn('[socket] invalid JSON'); return; }
    if (!message || typeof message !== 'object') return;
    if (message.type === 'rejection') { forceReconnect(); return; }
    if (message.type === 'connected') {
      if (typeof message.id !== 'string' || typeof message.token !== 'string') return;
      playerId = message.id;
      token = message.token;
      localStorage.setItem('playerId', message.id);
      localStorage.setItem('token', message.token);
      isConnected = true;
      lastConnection = message;
      for (const type of ['user_data', 'ship_selection', 'input'] as const) {
        const data = latestState.get(type);
        if (data) send(data);
      }
    }
    for (const handler of listeners) deliver(handler, message);
  });
  current.addEventListener('close', () => {
    if (socket !== current) return;
    isConnected = false;
    lastConnection = undefined;
    scheduleReconnect();
  });
  current.addEventListener('error', () => { if (socket === current) current.close(); });
  return current;
}

export function listen(handler: MessageHandler): () => void {
  listeners.add(handler);
  // A scene may finish loading after the handshake has already arrived.
  if (isConnected && lastConnection) deliver(handler, lastConnection);
  return () => { listeners.delete(handler); };
}

export function send(data: any): boolean {
  if (!socket || socket.readyState !== WebSocket.OPEN || !isConnected) return false;
  try { socket.send(JSON.stringify(data)); return true; }
  catch { return false; }
}

export function forceReconnect() {
  isConnected = false;
  lastConnection = undefined;
  localStorage.removeItem('playerId');
  localStorage.removeItem('token');
  playerId = null;
  token = null;
  socket?.close();
  scheduleReconnect(100);
}

// Keep only the newest state, so a reconnect never replays old key presses.
export function sendLatest(type: StateType, data: Record<string, unknown> | null) {
  if (data === null) {
    latestState.delete(type);
    return;
  }
  const message = { ...data, type };
  latestState.set(type, message);
  send(message);
}

export function get(): WebSocket { return socket; }
