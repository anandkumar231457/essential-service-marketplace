import { Server as SocketIOServer } from 'socket.io';

let ioInstance: SocketIOServer | null = null;

export function setSocketIO(io: SocketIOServer) {
  ioInstance = io;
}

export function getSocketIO(): SocketIOServer | null {
  return ioInstance;
}

export function broadcastNewJob(booking: any, radiusKm: number, nearbyWorkersCount: number) {
  if (!ioInstance) return;
  ioInstance.emit('job:broadcast', {
    booking,
    radiusKm,
    nearbyWorkersCount,
    timestamp: new Date().toISOString(),
  });
}

export function broadcastJobClaimed(bookingId: string, assignedTo: string, providerName?: string) {
  if (!ioInstance) return;
  ioInstance.emit('job:claimed', {
    bookingId,
    assignedTo,
    providerName: providerName || 'Specialist',
    timestamp: new Date().toISOString(),
  });
}

export function emitBookingUpdate(bookingId: string, status: string, provider?: any) {
  if (!ioInstance) return;
  ioInstance.to(`booking-room:${bookingId}`).emit('booking:status-update', {
    bookingId,
    status,
    provider,
    timestamp: new Date().toISOString(),
  });
  ioInstance.emit('booking:status-changed', {
    bookingId,
    status,
    provider,
    timestamp: new Date().toISOString(),
  });
}
