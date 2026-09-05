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

  // 30 minutes stale threshold — generous for Render free-tier restarts
  const staleThreshold = 30 * 60 * 1000;
  const now = Date.now();

  for (const [providerId, p] of presenceMap.entries()) {
    if (!p.isOnline) continue;
    if (now - p.lastSeen.getTime() > staleThreshold) {
      console.log(`[Dispatch] Skipping stale provider ${providerId}`);
      continue;
    }
    const dist = haversineKm(jobLat, jobLng, p.lat, p.lng);
    console.log(`[Dispatch] Provider ${providerId} is ${dist.toFixed(2)}km from job (radius=${radiusKm}km)`);

    results.push({
      providerId,
      socketId: p.socketId,
      distanceKm: parseFloat(dist.toFixed(2)),
      lat: p.lat,
      lng: p.lng,
    });
  }

  return results.sort((a, b) => a.distanceKm - b.distanceKm);
}

/** Emit job:broadcast to all online providers.
 *  Strategy:
 *  1. Targeted emit to known socket IDs from presenceMap (with distance info).
 *  2. Room broadcast to providers:online — catches any provider connected after a server restart.
 *  This handles Render free-tier restarts that wipe in-memory presenceMap.
 */
export function emitJobToNearbyProviders(
  booking: any,
  nearby: Array<{ providerId: string; socketId: string; distanceKm: number }>,
  radiusKm: number
) {
  if (!ioInstance) {
    console.error('[Dispatch] Socket.io not initialized!');
    return;
  }

  const basePayload = {
    booking,
    radiusKm,
    nearbyWorkersCount: nearby.length,
    timestamp: new Date().toISOString(),
  };

  // 1. Targeted push with exact distance for each known provider in presenceMap
  for (const { providerId, socketId, distanceKm } of nearby) {
    console.log(`[Dispatch] → Targeted to provider ${providerId} socket=${socketId} dist=${distanceKm}km`);
    ioInstance.to(socketId).emit('job:broadcast', { ...basePayload, distanceKm });
    ioInstance.to(`provider-room:${providerId}`).emit('job:broadcast', { ...basePayload, distanceKm });
  }

  // 2. ALWAYS broadcast to providers:online room (handles server restarts that wipe presenceMap)
  console.log(`[Dispatch] Broadcasting to providers:online room`);
  ioInstance.to('providers:online').emit('job:broadcast', basePayload);

  // 3. Global fallback so no provider misses it
  ioInstance.emit('job:broadcast', basePayload);
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
