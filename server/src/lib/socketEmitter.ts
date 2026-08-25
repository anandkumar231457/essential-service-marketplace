import { Server as SocketIOServer } from 'socket.io';

let ioInstance: SocketIOServer | null = null;

// ── In-memory provider presence map ────────────────────────────────────────
// Maps providerId → { socketId, lat, lng, isOnline, lastSeen }
interface ProviderPresence {
  socketId: string;
  lat: number;
  lng: number;
  isOnline: boolean;
  lastSeen: Date;
}

const presenceMap = new Map<string, ProviderPresence>();

// ── Haversine distance formula (km) ─────────────────────────────────────────
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  if (isNaN(lat1) || isNaN(lng1) || isNaN(lat2) || isNaN(lng2)) return 0;
  const R = 6371; // Radius of the Earth in km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Exported presence helpers ───────────────────────────────────────────────

export function setSocketIO(io: SocketIOServer) {
  ioInstance = io;
}

export function getSocketIO(): SocketIOServer | null {
  return ioInstance;
}

/** Called by socket event handlers to update a provider's live GPS & online status. */
export function setProviderPresence(
  providerId: string,
  socketId: string,
  lat: number,
  lng: number,
  isOnline: boolean
) {
  presenceMap.set(providerId, { socketId, lat, lng, isOnline, lastSeen: new Date() });
  console.log(
    `[Presence] Provider ${providerId} → online=${isOnline} GPS=(${lat.toFixed(5)}, ${lng.toFixed(5)}) socket=${socketId}`
  );
}

/** Called on disconnect / provider:offline to mark provider offline. */
export function removeProviderBySocketId(socketId: string) {
  for (const [pid, p] of presenceMap.entries()) {
    if (p.socketId === socketId) {
      presenceMap.set(pid, { ...p, isOnline: false });
      console.log(`[Presence] Provider ${pid} went offline (socket disconnected)`);
      break;
    }
  }
}

export function setProviderOffline(providerId: string) {
  const existing = presenceMap.get(providerId);
  if (existing) {
    presenceMap.set(providerId, { ...existing, isOnline: false });
    console.log(`[Presence] Provider ${providerId} marked offline`);
  }
}

export function getProviderPresence(providerId: string): ProviderPresence | undefined {
  return presenceMap.get(providerId);
}

/** Returns list of providers currently online and within radiusKm of (jobLat, jobLng). */
export function findNearbyOnlineProviders(
  jobLat: number,
  jobLng: number,
  radiusKm: number = 25
): Array<{ providerId: string; socketId: string; distanceKm: number; lat: number; lng: number }> {
  const results: Array<{ providerId: string; socketId: string; distanceKm: number; lat: number; lng: number }> = [];

  const staleThreshold = 10 * 60 * 1000; // 10 minutes tolerance
  const now = Date.now();

  for (const [providerId, p] of presenceMap.entries()) {
    if (!p.isOnline) continue;
    if (now - p.lastSeen.getTime() > staleThreshold) {
      continue;
    }
    const dist = haversineKm(jobLat, jobLng, p.lat, p.lng);
    console.log(`[Dispatch] Provider ${providerId} is ${dist.toFixed(2)}km from job (radar radius=${radiusKm}km)`);
    
    // Include all online providers within radius (or always if within 50km)
    if (dist <= radiusKm || dist <= 50) {
      results.push({
        providerId,
        socketId: p.socketId,
        distanceKm: parseFloat(dist.toFixed(2)),
        lat: p.lat,
        lng: p.lng,
      });
    }
  }

  return results.sort((a, b) => a.distanceKm - b.distanceKm);
}

/** Emit job:broadcast to nearby providers with real-time GPS distance comparison. */
export function emitJobToNearbyProviders(
  booking: any,
  nearby: Array<{ providerId: string; socketId: string; distanceKm: number }>,
  radiusKm: number
) {
  if (!ioInstance) {
    console.error('[Dispatch] Socket.io not initialized!');
    return;
  }

  const payload = {
    booking,
    radiusKm,
    nearbyWorkersCount: nearby.length,
    timestamp: new Date().toISOString(),
  };

  // 1. Direct push to matched provider sockets with individual distance
  for (const { providerId, socketId, distanceKm } of nearby) {
    console.log(
      `[Dispatch] Emitting targeted job:broadcast to provider ${providerId} (${distanceKm}km, socket=${socketId})`
    );
    ioInstance.to(socketId).emit('job:broadcast', { ...payload, distanceKm });
    ioInstance.to(`provider-room:${providerId}`).emit('job:broadcast', { ...payload, distanceKm });
  }

  // 2. Also emit to providers:online room and global broadcast so any active provider console updates instantly
  ioInstance.to('providers:online').emit('job:broadcast', payload);
  ioInstance.emit('job:broadcast', payload);
}

// ── Backward-compat helper ──────────────────────────────────────────────────

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
