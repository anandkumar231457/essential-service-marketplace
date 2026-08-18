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
import { requireAuth, requireRole } from './auth/middleware.js';
import { register, login, refresh, googleAuth } from './auth/controller.js';
import { create as createProvider, read as readProvider, update as updateProvider, nearby as nearbyProviders } from './server/providerCrud.js';
import { request as requestBooking, accept as acceptBooking, enRoute as enRouteBooking, inProgress as inProgressBooking, complete as completeBooking, cancel as cancelBooking } from './server/bookingLifecycle.js';
import { create as createReview } from './server/reviews.js';

const app = express();
const server = createServer(app);

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
// General API limiter: 100 requests / 15 min / IP.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Stricter limiter for auth endpoints (brute-force protection).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
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

// Socket.io setup
const io = new SocketIOServer(server, {
  cors: { origin: corsOrigins },
});

// Track online providers: providerId -> socketId
const providerSockets = new Map<string, string>();

io.on('connection', (socket: Socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-booking-room', (bookingId: string) => {
    socket.join(`booking-room:${bookingId}`);
  });

  // Provider joins their personal room
  socket.on('set-provider-id', (providerId: string) => {
    providerSockets.set(providerId, socket.id);
    socket.join(`provider-room:${providerId}`);
    console.log(`Provider ${providerId} joined their room`);
  });

  // Provider leaves room on disconnect
  socket.on('disconnect', () => {
    for (const [pid, sid] of providerSockets.entries()) {
      if (sid === socket.id) {
        providerSockets.delete(pid);
        io.to(`provider-room:${pid}`).emit('provider:offline', { providerId: pid });
        console.log(`Provider ${pid} disconnected, marked offline`);
        break;
      }
    }
  });

  // Broadcast provider location to booking room
  socket.on('provider:location', (data: { providerId: string; lat: number; lng: number; isOnline: boolean; bookingId?: string }) => {
    providerSockets.set(data.providerId, socket.id);
    socket.join(`provider-room:${data.providerId}`);
    
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

// Auth routes (stricter rate limit)
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
app.post('/api/providers', requireAuth, requireRole('PROVIDER'), createProvider);
app.get('/api/providers/me', requireAuth, readProvider);
app.put('/api/providers/me', requireAuth, requireRole('PROVIDER'), updateProvider);

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

// Provider ping endpoint (Socket.io message + REST fallback)
app.post('/api/providers/ping', requireAuth, requireRole('PROVIDER'), async (req, res) => {
  try {
    const { lat, lng, isOnline, bookingId } = req.body;
    const providerId = res.locals.user.userId;
    
    // Update provider location in database
    await prisma.providerLocation.upsert({
      where: { providerId },
      create: {
        providerId,
        lat,
        lng,
        isOnline,
      },
      update: {
        lat,
        lng,
        isOnline,
        updatedAt: new Date(),
      },
    });
    
    // Emit to booking room if bookingId provided
    emitProviderStatus(providerId, isOnline, lat, lng, bookingId);
    
    res.json({ success: true, providerId });
  } catch {
    res.status(500).json({ error: 'Failed to update provider status' });
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

// Open job board — providers see all REQUESTED jobs in their category
app.get('/api/bookings/open', requireAuth, requireRole('PROVIDER'), async (_req, res) => {
  try {
    const user = res.locals.user;
    const profile = await prisma.providerProfile.findUnique({ where: { userId: user.userId } });
    const openJobs = await prisma.booking.findMany({
      where: {
        status: 'REQUESTED',
        ...(profile?.category ? { category: { name: profile.category } } : {}),
      },
      include: {
        category: true,
        customer: { select: { name: true, phone: true } },
      },
      orderBy: { requestedAt: 'desc' },
    });
    res.json({ bookings: openJobs });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// Booking lifecycle (Step 4)
app.post('/api/bookings/request', requireAuth, requestBooking);
app.post('/api/bookings/accept', requireAuth, requireRole('PROVIDER'), acceptBooking);
app.post('/api/bookings/en-route', requireAuth, requireRole('PROVIDER'), enRouteBooking);
app.post('/api/bookings/in-progress', requireAuth, requireRole('PROVIDER'), inProgressBooking);
app.post('/api/bookings/complete', requireAuth, requireRole('PROVIDER'), completeBooking);
app.post('/api/bookings/cancel', requireAuth, cancelBooking);

// Reviews (Step 4)
app.post('/api/bookings/:bookingId/reviews', requireAuth, createReview);

const PORT = env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

export { io, app };
