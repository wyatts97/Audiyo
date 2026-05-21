import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

let wss: WebSocketServer | null = null;
const clients = new Set<WebSocket>();

export function initWebSocket(server: Server): void {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('WebSocket client connected');

    ws.on('close', () => {
      clients.delete(ws);
      console.log('WebSocket client disconnected');
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });

  console.log('WebSocket server initialized');
}

export function broadcast(event: string, data: any): void {
  const message = JSON.stringify({ event, data, timestamp: Date.now() });
  
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

export function broadcastJobUpdate(jobId: string, status: string, progress?: number, message?: string): void {
  broadcast('job:update', { jobId, status, progress, message });
}

export function broadcastLibraryUpdate(): void {
  broadcast('library:update', {});
}

export function broadcastDownloadProgress(jobId: string, trackIndex: number, totalTracks: number, percent: number): void {
  broadcast('job:progress', { jobId, trackIndex, totalTracks, percent });
}
