import { Server as SocketIOServer } from 'socket.io';

let ioInstance: SocketIOServer | null = null;

// ── In-memory provider presence map ────────────────────────────────────────
// Maps providerId → { socketId, lat, lng, isOnline, lastSeen }
// This is the single source of truth for real-time dispatch.
// It's updated by socket events (provider:online, provider:location) from the server's index.ts.
interface ProviderPresence {
  socketId: string;
  lat: number;
  lng: number;
  isOnline: boolean;
  lastSeen: Date;
}

const presenceMap = new Map<string, ProviderPresence>();

// ── Haversine distance (km) ─────────────────────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
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

/** Called by socket event handlers in index.ts to update a provider's live GPS & online status. */
export function setProviderPresence(
  providerId: string,
  socketId: string,
  lat: number,
  lng: number,
  isOnline: boolean
) {
  presenceMap.set(providerId, { socketId, lat, lng, isOnline, lastSeen: new Date() });
  console.log(
    `[Presence] ${providerId} → online=${isOnline} lat=${lat.toFixed(4)} lng=${lng.toFixed(4)} socket=${socketId}`
  );
}

/** Called on disconnect / provider:offline to mark provider offline. */
export function removeProviderBySocketId(socketId: string) {
  for (const [pid, p] of presenceMap.entries()) {
    if (p.socketId === socketId) {
      presenceMap.set(pid, { ...p, isOnline: false });
      console.log(`[Presence] ${pid} went offline (socket disconnected)`);
      break;
    }
  }
}

export function setProviderOffline(providerId: string) {
  const existing = presenceMap.get(providerId);
  if (existing) {
    presenceMap.set(providerId, { ...existing, isOnline: false });
    console.log(`[Presence] ${providerId} marked offline`);
  }
}

/** Returns list of providers currently online and within radiusKm of (jobLat, jobLng). */
export function findNearbyOnlineProviders(
  jobLat: number,
  jobLng: number,
  radiusKm: number
): Array<{ providerId: string; socketId: string; distanceKm: number }> {
  const results: Array<{ providerId: string; socketId: string; distanceKm: number }> = [];

  // Prune stale presence entries (no ping > 3 minutes = considered offline)
  const staleThreshold = 3 * 60 * 1000;
  const now = Date.now();

  for (const [providerId, p] of presenceMap.entries()) {
    if (!p.isOnline) continue;
    if (now - p.lastSeen.getTime() > staleThreshold) {
      console.log(`[Presence] ${providerId} is stale, skipping`);
      continue;
    }
    const dist = haversineKm(jobLat, jobLng, p.lat, p.lng);
    console.log(`[Dispatch] ${providerId} is ${dist.toFixed(2)}km away (radius=${radiusKm}km)`);
    if (dist <= radiusKm) {
      results.push({ providerId, socketId: p.socketId, distanceKm: dist });
    }
  }

  return results;
}

/** Emit job:broadcast ONLY to specific nearby providers by their socket IDs. */
export function emitJobToNearbyProviders(
  booking: any,
  nearby: Array<{ providerId: string; socketId: string; distanceKm: number }>,
  radiusKm: number
) {
  if (!ioInstance) {
    console.error('[Dispatch] Socket.io not initialized!');
    return;
  }

  if (nearby.length === 0) {
    console.log('[Dispatch] No nearby online providers found — no broadcast sent.');
    return;
  }

  const payload = {
    booking,
    radiusKm,
    nearbyWorkersCount: nearby.length,
    timestamp: new Date().toISOString(),
  };

  for (const { providerId, socketId, distanceKm } of nearby) {
    console.log(
      `[Dispatch] Emitting job:broadcast to provider ${providerId} (${distanceKm.toFixed(2)}km, socket=${socketId})`
    );
    ioInstance.to(socketId).emit('job:broadcast', { ...payload, distanceKm });
  }
}

// ── Backward-compat: kept for other callers ────────────────────────────────

export function broadcastNewJob(booking: any, radiusKm: number, nearbyWorkersCount: number) {
  if (!ioInstance) return;
  // Fallback: global emit (only used if called without nearby list)
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
