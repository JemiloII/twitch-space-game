const reconnectDelay = 1000;
let isConnected = false;
let playerId = localStorage.getItem('playerId');
let token = localStorage.getItem('token');
let socket: WebSocket;
// Dynamically determine WebSocket URL based on current host
const getSocketUrl = () => {
  const host = window.location.hostname;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${host}:2087`;
};

let socketUrl = getSocketUrl();

function connected(event: any) {
  try {
    const message = JSON.parse(event.data);
    console.log('Connected to server!', message);

    if (message.type === 'connected') {

      if (!playerId && playerId !== message.id) {
        console.log(`Player IDs don't match...`);
      }

      if (!token && token !== message.token) {
        console.log(`Tokens don't match...`);
      }

      playerId = message.id;
      token = message.token;

      localStorage.setItem('playerId', playerId!);
      localStorage.setItem('token', token!);
      isConnected = true;
      socket.removeEventListener('message', connected);
    }
  } catch {
    console.warn('[socket] invalid JSON:', event.data);
  }
}

export function connect(url: string = socketUrl): WebSocket {
  socketUrl = url;

  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return socket;
  }

  socket = new WebSocket(socketUrl);

  socket.addEventListener('open', () => {
    if (!playerId || !token) {
      // send blank handshake, server will assign new ID + token
      console.log('Sending Blank Handshake!');
      socket.send(JSON.stringify({ type: 'handshake' }));
    } else {
      console.log('Sending Handshake!');
      socket.send(JSON.stringify({
        type: 'handshake',
        id: playerId,
        token
      }));
    }
  });

  socket.addEventListener('message', connected);

  socket.addEventListener('close', () => {
    console.warn('[socket] disconnected — reconnecting...');
    isConnected = false;
    setTimeout(() => connect(socketUrl), reconnectDelay);
  });

  socket.addEventListener('error', (error) => {
    console.error('[socket] error:', error);
    isConnected = false;
  });

  return socket;
}

export function listen(handler: (message: any) => void) {
  if (!socket) return;

  socket.addEventListener('message', event => {
    try {
      const message = JSON.parse(event.data);
      
      // Check for rejection messages and trigger reconnection
      if (message.type === 'rejection') {
        console.warn('[socket] detected rejection from server - triggering reconnection:', message.reason);
        forceReconnect();
        return;
      }
      
      handler(message);
    } catch {
      console.warn('[socket] invalid JSON:', event.data);
    }
  });
}

export function send(data: any) {
  if (!socket || socket.readyState !== WebSocket.OPEN || !isConnected) {
    // console.warn('[socket] send skipped — not ready');
    return;
  }

  try {
    socket.send(JSON.stringify(data));
  } catch {
    console.warn('[socket] send exception — skipping');
  }
}

// Function to force reconnection and re-handshake
export function forceReconnect() {
  console.log('[socket] forcing reconnection due to rejection...');
  isConnected = false;
  if (socket) {
    socket.close();
  }
  // Clear stored credentials to force new handshake
  localStorage.removeItem('playerId');
  localStorage.removeItem('token');
  playerId = null;
  token = null;
  // Reconnect after short delay
  setTimeout(() => {
    connect(socketUrl);
  }, 100);
}

export function get(): WebSocket {
  return socket;
}
