import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import { createServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { requireAuth } from './auth/middleware.js';
import { register, login, refresh, googleAuth } from './auth/controller.js';
import { create as createProvider, read as readProvider, update as updateProvider, nearby as nearbyProviders } from './server/providerCrud.js';
import {
  request as requestBooking,
  accept as acceptBooking,
  rebroadcast as rebroadcastBooking,
  enRoute as enRouteBooking,
  inProgress as inProgressBooking,
  complete as completeBooking,
  cancel as cancelBooking,
} from './server/bookingLifecycle.js';
import { create as createReview } from './server/reviews.js';
import { setSocketIO, setProviderPresence, removeProviderBySocketId, setProviderOffline } from './lib/socketEmitter.js';

const app = express();
const server = createServer(app);

// Enable trust proxy for Render / Vercel reverse proxy forwarding
app.set('trust proxy', 1);

// ── Security & logging middleware ────────────────────────────────────────
app.use(helmet());

// Lock CORS to the frontend origin(s). CORS_ORIGIN may be a single origin
// or a comma-separated list (e.g. local dev + production frontend).
const corsOrigins = env.CORS_ORIGIN.split(',')
  .map((o) => o.trim())
  .filter(Boolean);
app.use(cors({ origin: corsOrigins }));

// Request logging (pino). Redact auth headers so secrets never hit the logs.
app.use(
  pinoHttp({
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    redact: ['req.headers.authorization', 'req.headers.cookie'],
  }),
);

app.use(express.json());

// ── Rate limiting ────────────────────────────────────────────────────────
// Generous API limiter: 1000 requests / 15 min / IP to prevent blocking during active usage & polling.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Auth limiter: 200 attempts / 15 min / IP.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, please try again later.' },
});

// Apply the general limiter to all /api routes.
app.use('/api', apiLimiter);

// ── Health check ─────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// ── Socket.io Setup ──────────────────────────────────────────────────────
const io = new SocketIOServer(server, {
  cors: { origin: corsOrigins },
});
setSocketIO(io);

// Track online providers: providerId -> socketId (kept for backward compat; presence details now in socketEmitter)
const providerSockets = new Map<string, string>();

io.on('connection', (socket: Socket) => {
  console.log('Socket client connected:', socket.id);

  socket.on('join-booking-room', (bookingId: string) => {
    socket.join(`booking-room:${bookingId}`);
  });

  // Provider registers with their current GPS location
  socket.on('set-provider-id', (providerId: string) => {
    if (!providerId) return;
    providerSockets.set(providerId, socket.id);
    socket.join(`provider-room:${providerId}`);
    socket.join('providers:online');
    console.log(`[Socket] Provider ${providerId} registered socket ${socket.id}`);
  });

  // Provider goes online — must send lat/lng for dispatch to work
  socket.on('provider:online', (data: { providerId: string; lat?: number; lng?: number }) => {
    if (!data?.providerId) return;
    const lat = typeof data.lat === 'number' ? data.lat : 0;
    const lng = typeof data.lng === 'number' ? data.lng : 0;

    providerSockets.set(data.providerId, socket.id);
    socket.join(`provider-room:${data.providerId}`);
    socket.join('providers:online');

    // Update in-memory presence map for real-time dispatch
    setProviderPresence(data.providerId, socket.id, lat, lng, true);

    io.emit('provider:presence-update', { providerId: data.providerId, isOnline: true, lat, lng });
  });

  socket.on('provider:offline', (data: { providerId: string }) => {
    if (!data?.providerId) return;
    socket.leave('providers:online');
    setProviderOffline(data.providerId);
    io.emit('provider:presence-update', { providerId: data.providerId, isOnline: false });
  });

  // Provider disconnect
  socket.on('disconnect', () => {
    for (const [pid, sid] of providerSockets.entries()) {
      if (sid === socket.id) {
        providerSockets.delete(pid);
        break;
      }
    }
    // Mark offline in presence map
    removeProviderBySocketId(socket.id);
    socket.leave('providers:online');
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });

  // Live GPS update during active session — this is the primary source of provider location
  socket.on('provider:location', (data: { providerId: string; lat: number; lng: number; isOnline: boolean; bookingId?: string }) => {
    if (!data?.providerId) return;
    const lat = typeof data.lat === 'number' ? data.lat : 0;
    const lng = typeof data.lng === 'number' ? data.lng : 0;

    providerSockets.set(data.providerId, socket.id);
    socket.join(`provider-room:${data.providerId}`);
    if (data.isOnline) socket.join('providers:online');

    // Update presence map with fresh GPS coordinates
    setProviderPresence(data.providerId, socket.id, lat, lng, data.isOnline);

    if (data.bookingId) {
      io.to(`booking-room:${data.bookingId}`).emit('provider:location-update', {
        providerId: data.providerId,
        lat: data.lat,
        lng: data.lng,
        isOnline: data.isOnline,
      });
    }
  });
});

// Helper: emit provider status to booking room
function emitProviderStatus(providerId: string, isOnline: boolean, lat?: number, lng?: number, bookingId?: string) {
  if (bookingId) {
    io.to(`booking-room:${bookingId}`).emit('provider:status-update', {
      providerId,
      isOnline,
      lat,
      lng,
    });
  }
}

// ── Auth routes ──────────────────────────────────────────────────────────
app.post('/api/auth/register', authLimiter, register);
app.post('/api/auth/login', authLimiter, login);
app.post('/api/auth/google', authLimiter, googleAuth);
app.post('/api/auth/refresh', authLimiter, refresh);

// Service categories (public)
app.get('/api/categories', async (_req, res) => {
  try {
    const categories = await prisma.serviceCategory.findMany({
      orderBy: { id: 'asc' },
    });
    res.json({ categories });
  } catch {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// User Profile CRUD
app.get('/api/users/me', requireAuth, async (_req, res) => {
  try {
    const user = res.locals.user;
    const profile = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { id: true, name: true, phone: true, email: true, role: true, address: true, lat: true, lng: true },
    });
    if (!profile) return res.status(404).json({ error: 'User not found' });
    res.json({ user: profile });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch user profile' });
  }
});

app.put('/api/users/me', requireAuth, async (req, res) => {
  try {
    const user = res.locals.user;
    const { name, phone, email, address, lat, lng } = req.body;

    const updated = await prisma.user.update({
      where: { id: user.userId },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(address !== undefined && { address }),
        ...(typeof lat === 'number' && { lat }),
        ...(typeof lng === 'number' && { lng }),
      },
      select: { id: true, name: true, phone: true, email: true, role: true, address: true, lat: true, lng: true },
    });

    res.json({ user: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update user profile' });
  }
});

// Protected: provider profile CRUD
app.post('/api/providers', requireAuth, createProvider);
app.get('/api/providers/me', requireAuth, readProvider);
app.put('/api/providers/me', requireAuth, updateProvider);

// Nearby provider search — public, no auth required
app.get('/api/providers/nearby', nearbyProviders);

// Public provider detail used by the customer profile screen.
app.get('/api/providers/:id', async (req, res) => {
  const profile = await prisma.providerProfile.findUnique({
    where: { userId: req.params.id },
    include: { user: { select: { name: true, phone: true } } },
  });
  if (!profile || profile.verifiedStatus !== 'VERIFIED') return res.status(404).json({ error: 'Provider not found' });
  return res.json({ profile });
});

// ── Worker Presence: Ping & Live Geolocation Endpoint ────────────────────
app.post('/api/providers/ping', requireAuth, async (req, res) => {
  try {
    const { lat, lng, isOnline, bookingId } = req.body;
    const providerId = res.locals.user.userId;
    const numLat = typeof lat === 'number' ? lat : parseFloat(lat) || 12.9352;
    const numLng = typeof lng === 'number' ? lng : parseFloat(lng) || 77.6245;
    const online = typeof isOnline === 'boolean' ? isOnline : true;

    // 1. Ensure ProviderProfile exists and is verified
    await prisma.providerProfile.upsert({
      where: { userId: providerId },
      create: {
        userId: providerId,
        category: 'Electrician',
        skills: ['General Repair', 'Maintenance'],
        hourlyRate: 500,
        avgRating: 5.0,
        verifiedStatus: 'VERIFIED',
      },
      update: {
        verifiedStatus: 'VERIFIED',
      },
    });

    // 2. Upsert ProviderLocation with online status and coordinates
    await prisma.providerLocation.upsert({
      where: { providerId },
      create: {
        providerId,
        lat: numLat,
        lng: numLng,
        isOnline: online,
      },
      update: {
        lat: numLat,
        lng: numLng,
        isOnline: online,
        updatedAt: new Date(),
      },
    });

    // 3. Update raw PostGIS geography point for fast spatial indexing
    try {
      await prisma.$executeRaw`
        UPDATE "ProviderLocation"
        SET location = ST_SetSRID(ST_MakePoint(${numLng}, ${numLat}), 4326)::geography
        WHERE "providerId" = ${providerId}
      `;
    } catch {
      // ignore
    }

    emitProviderStatus(providerId, online, numLat, numLng, bookingId);
    io.emit('provider:presence-update', { providerId, isOnline: online, lat: numLat, lng: numLng });

    res.json({ success: true, providerId, isOnline: online, lat: numLat, lng: numLng });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update provider status' });
  }
});

// Polling fallback: get provider status
app.get('/api/providers/:id/status', async (req, res) => {
  try {
    const providerId = req.params.id;
    const providerLocation = await prisma.providerLocation.findUnique({
      where: { providerId },
      select: { isOnline: true, lat: true, lng: true, updatedAt: true },
    });

    res.json({
      success: true,
      providerId,
      isOnline: providerLocation?.isOnline ?? false,
      lat: providerLocation?.lat,
      lng: providerLocation?.lng,
      lastSeen: providerLocation?.updatedAt,
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch provider status' });
  }
});

// Booking reads used by customer history, provider work queues, and live tracking.
app.get('/api/bookings/my', requireAuth, async (_req, res) => {
  const user = res.locals.user;
  const isProvider = user.role === 'PROVIDER';
  const bookings = await prisma.booking.findMany({
    where: isProvider ? { providerId: user.userId } : { customerId: user.userId },
    include: { category: true, customer: { select: { name: true, phone: true } }, provider: { select: { name: true, phone: true } }, review: true },
    orderBy: { requestedAt: 'desc' },
  });
  res.json({ bookings });
});

app.get('/api/bookings/:bookingId', requireAuth, async (req, res) => {
  const user = res.locals.user;
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.bookingId },
    include: { category: true, customer: { select: { name: true, phone: true } }, provider: { select: { name: true, phone: true } }, review: true, statusHistory: { orderBy: { changedAt: 'asc' } } },
  });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.customerId !== user.userId && booking.providerId !== user.userId) return res.status(403).json({ error: 'Not authorized for this booking' });
  return res.json({ booking });
});

// Open job board — unassigned broadcast jobs + incoming requests for this provider
app.get('/api/bookings/open', requireAuth, async (_req, res) => {
  try {
    const user = res.locals.user;
    const openJobs = await prisma.booking.findMany({
      where: {
        status: 'REQUESTED',
        OR: [
          { providerId: null },
          { providerId: user.userId },
        ],
      },
      include: {
        category: true,
        customer: { select: { name: true, phone: true } },
        provider: { select: { name: true, phone: true } },
      },
      orderBy: { requestedAt: 'desc' },
    });
    res.json({ bookings: openJobs });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// ── Booking lifecycle ────────────────────────────────────────────────────
app.post('/api/bookings/request', requireAuth, requestBooking);
app.post('/api/bookings/:bookingId/rebroadcast', requireAuth, rebroadcastBooking);
app.post('/api/bookings/accept', requireAuth, acceptBooking);
app.post('/api/bookings/en-route', requireAuth, enRouteBooking);
app.post('/api/bookings/in-progress', requireAuth, inProgressBooking);
app.post('/api/bookings/complete', requireAuth, completeBooking);
app.post('/api/bookings/cancel', requireAuth, cancelBooking);

// Reviews
app.post('/api/bookings/:bookingId/reviews', requireAuth, createReview);

const PORT = env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

export { io, app };
