const reconnectDelay = 1000;
let isConnected = false;
let playerId = localStorage.getItem('playerId');
let token = localStorage.getItem('token');
let socket: WebSocket;
let socketUrl = 'ws://localhost:3001';

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

export function get(): WebSocket {
  return socket;
}
