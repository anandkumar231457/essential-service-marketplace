// Verification script for Steps 4 & 5.
// Starts the server, waits for it to be ready, then:
//  1. Logs in as a customer (gets JWT)
//  2. Calls GET /api/providers/nearby and prints the real JSON
//  3. Creates a booking, then tries an invalid transition (REQUESTED → COMPLETED)
//  4. Tests a real Socket.io connection (provider ping → customer receives broadcast)
import dotenv from 'dotenv';
dotenv.config({ path: 'D:/job_service/server/.env' });
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './src/config/env.js';
import { prisma } from './src/lib/prisma.js';
import { requireAuth, requireRole } from './src/auth/middleware.js';
import { register, login, refresh } from './src/auth/controller.js';
import { create as createProvider, read as readProvider, update as updateProvider, nearby as nearbyProviders } from './src/server/providerCrud.js';
import { request as requestBooking, accept as acceptBooking, enRoute as enRouteBooking, inProgress as inProgressBooking, complete as completeBooking, cancel as cancelBooking } from './src/server/bookingLifecycle.js';
import { create as createReview } from './src/server/reviews.js';

const app = express();
const server = createServer(app);

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());
app.use(morgan('combined'));

const io = new SocketIOServer(server, { cors: { origin: env.CORS_ORIGIN } });
const providerSockets = new Map<string, string>();

io.on('connection', (socket) => {
  console.log('[socket] Client connected:', socket.id);
  socket.on('set-provider-id', (providerId: string) => {
    providerSockets.set(providerId, socket.id);
    socket.join(`provider-room:${providerId}`);
    console.log(`[socket] Provider ${providerId} joined their room`);
  });
  socket.on('disconnect', () => {
    for (const [pid, sid] of providerSockets.entries()) {
      if (sid === socket.id) {
        providerSockets.delete(pid);
        io.to(`provider-room:${pid}`).emit('provider:offline', { providerId: pid });
        console.log(`[socket] Provider ${pid} disconnected`);
        break;
      }
    }
  });
  socket.on('provider:location', (data) => {
    providerSockets.set(data.providerId, socket.id);
    socket.join(`provider-room:${data.providerId}`);
    if (data.bookingId) {
      io.to(`booking-room:${data.bookingId}`).emit('provider:location-update', {
        providerId: data.providerId, lat: data.lat, lng: data.lng, isOnline: data.isOnline,
      });
      console.log(`[socket] Broadcast location to booking-room:${data.bookingId}`);
    }
  });
  // Customer joins a booking room to receive live updates
  socket.on('join-booking-room', (bookingId: string) => {
    socket.join(`booking-room:${bookingId}`);
    console.log(`[socket] Client ${socket.id} joined booking-room:${bookingId}`);
  });
});

function emitProviderStatus(providerId: string, isOnline: boolean, lat?: number, lng?: number, bookingId?: string) {
  if (bookingId) {
    io.to(`booking-room:${bookingId}`).emit('provider:status-update', { providerId, isOnline, lat, lng });
  }
}

// Routes (same as index.ts)
app.post('/api/auth/register', register);
app.post('/api/auth/login', login);
app.post('/api/auth/refresh', refresh);
app.post('/api/providers', requireAuth, requireRole('PROVIDER'), createProvider);
app.get('/api/providers/me', requireAuth, readProvider);
app.put('/api/providers/me', requireAuth, requireRole('PROVIDER'), updateProvider);
app.get('/api/providers/nearby', requireAuth, nearbyProviders);
app.post('/api/providers/ping', requireAuth, requireRole('PROVIDER'), async (req, res) => {
  try {
    const { lat, lng, isOnline, bookingId } = req.body;
    const providerId = res.locals.user.userId;
    await prisma.providerLocation.upsert({
      where: { providerId },
      create: { providerId, lat, lng, isOnline },
      update: { lat, lng, isOnline, updatedAt: new Date() },
    });
    emitProviderStatus(providerId, isOnline, lat, lng, bookingId);
    res.json({ success: true, providerId });
  } catch {
    res.status(500).json({ error: 'Failed to update provider status' });
  }
});
app.get('/api/providers/:id/status', async (req, res) => {
  try {
    const providerId = req.params.id;
    const pl = await prisma.providerLocation.findUnique({ where: { providerId }, select: { isOnline: true, lat: true, lng: true, updatedAt: true } });
    res.json({ success: true, providerId, isOnline: pl?.isOnline ?? false, lat: pl?.lat, lng: pl?.lng, lastSeen: pl?.updatedAt });
  } catch {
    res.status(500).json({ error: 'Failed to fetch provider status' });
  }
});
app.post('/api/bookings/request', requireAuth, requestBooking);
app.post('/api/bookings/accept', requireAuth, requireRole('PROVIDER'), acceptBooking);
app.post('/api/bookings/en-route', requireAuth, requireRole('PROVIDER'), enRouteBooking);
app.post('/api/bookings/in-progress', requireAuth, requireRole('PROVIDER'), inProgressBooking);
app.post('/api/bookings/complete', requireAuth, requireRole('PROVIDER'), completeBooking);
app.post('/api/bookings/cancel', requireAuth, cancelBooking);
app.post('/api/bookings/:bookingId/reviews', requireAuth, createReview);

const PORT = 4100; // use a distinct port for the test

async function main() {
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  console.log(`\n=== Server listening on http://localhost:${PORT} ===\n`);

  const base = `http://localhost:${PORT}`;

  // ── 1. Login as a seeded customer ──────────────────────────────────────
  console.log('── Step 4a: Login as seeded customer ──');
  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'customer.a@test.com', password: 'testpass123' }),
  });
  const loginData = await loginRes.json();
  console.log('Login status:', loginRes.status);
  console.log('Login user:', JSON.stringify(loginData.user));
  const customerToken = loginData.accessToken;
  console.log('Customer accessToken:', customerToken ? customerToken.slice(0, 30) + '…' : 'MISSING');
  console.log('');

  // ── 2. Nearby provider search (real PostGIS) ───────────────────────────
  console.log('── Step 4b: Nearby provider search (Koramangala 12.9352, 77.6245, radius 5km) ──');
  const nearbyRes = await fetch(`${base}/api/providers/nearby?lat=12.9352&lng=77.6245&radiusKm=5`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  const nearbyData = await nearbyRes.json();
  console.log('Nearby status:', nearbyRes.status);
  console.log('Nearby count:', nearbyData.count);
  console.log('Nearby providers (real JSON):');
  console.log(JSON.stringify(nearbyData.providers, null, 2));
  console.log('');

  // ── 3. Booking lifecycle: create + invalid transition ─────────────────
  console.log('── Step 4c: Booking lifecycle + invalid transition ──');
  // Find a provider to book
  const provider = nearbyData.providers?.[0];
  if (!provider) {
    console.log('No provider found nearby — cannot test booking.');
  } else {
    console.log('Booking provider:', provider.name, provider.providerId);
    // Get category id
    const cat = await prisma.serviceCategory.findUnique({ where: { name: provider.category } });
    const categoryId = cat?.id;

    // Create booking (REQUESTED) as the customer
    const bookRes = await fetch(`${base}/api/bookings/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        providerId: provider.providerId,
        categoryId,
        address: '12, 5th Block, Koramangala, Bengaluru',
        lat: 12.9352,
        lng: 77.6245,
      }),
    });
    const bookData = await bookRes.json();
    console.log('Create booking status:', bookRes.status);
    console.log('Booking created:', JSON.stringify({ id: bookData.booking?.id, status: bookData.booking?.status }));
    const bookingId = bookData.booking?.id;

    // Login as the provider (seeded password: testpass123)
    const providerLoginRes = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: provider.email ?? 'ravi.kumar@example.com', password: 'testpass123' }),
    });
    const providerLoginData = await providerLoginRes.json();
    const providerToken = providerLoginData.accessToken;
    console.log('Provider login status:', providerLoginRes.status);
    console.log('Provider token:', providerToken ? providerToken.slice(0, 30) + '…' : 'MISSING');

    // Try INVALID transition: REQUESTED → COMPLETED (should be rejected by state machine)
    console.log('\nAttempting INVALID transition: REQUESTED → COMPLETED (as provider)');
    const invalidRes = await fetch(`${base}/api/bookings/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${providerToken}` },
      body: JSON.stringify({ bookingId }),
    });
    const invalidData = await invalidRes.json();
    console.log('Invalid transition status:', invalidRes.status);
    console.log('Invalid transition response:', JSON.stringify(invalidData));
    console.log('');
  }

  // ── 4. Real Socket.io test ─────────────────────────────────────────────
  console.log('── Step 5: Real Socket.io connection test ──');
  // Customer socket joins a booking room
  const customerSocket = ioc(`http://localhost:${PORT}`, { transports: ['websocket'] });
  // Provider socket
  const providerSocket = ioc(`http://localhost:${PORT}`, { transports: ['websocket'] });

  const received: unknown[] = [];
  customerSocket.on('provider:location-update', (data: unknown) => {
    console.log('[test] Customer RECEIVED provider:location-update:', JSON.stringify(data));
    received.push(data);
  });
  customerSocket.on('provider:status-update', (data: unknown) => {
    console.log('[test] Customer RECEIVED provider:status-update:', JSON.stringify(data));
    received.push(data);
  });

  // Wait for both sockets to connect
  await Promise.all([
    new Promise<void>((resolve) => customerSocket.on('connect', () => { console.log('[test] Customer socket connected:', customerSocket.id); resolve(); })),
    new Promise<void>((resolve) => providerSocket.on('connect', () => { console.log('[test] Provider socket connected:', providerSocket.id); resolve(); })),
  ]);

  // Customer joins the booking room FIRST
  customerSocket.emit('join-booking-room', 'test-booking-1');
  console.log('[test] Customer joined booking-room:test-booking-1');
  // Small delay to ensure the join is processed server-side
  await new Promise((resolve) => setTimeout(resolve, 500));

  // THEN provider emits a location ping for that booking room
  providerSocket.emit('set-provider-id', 'test-provider-1');
  providerSocket.emit('provider:location', {
    providerId: 'test-provider-1',
    lat: 12.9360,
    lng: 77.6250,
    isOnline: true,
    bookingId: 'test-booking-1',
  });
  console.log('[test] Provider emitted provider:location for booking-room:test-booking-1');

  // Wait for the broadcast to arrive
  await new Promise((resolve) => setTimeout(resolve, 3000));
  console.log('\n[test] Broadcasts received by customer:', received.length);
  if (received.length === 0) {
    console.log('[test] ⚠️ No broadcast received — socket test FAILED');
  } else {
    console.log('[test] ✅ Socket broadcast received successfully');
  }

  customerSocket.close();
  providerSocket.close();
  server.close();
  await prisma.$disconnect();
  console.log('\n=== Verification complete ===');
  process.exit(0);
}

main().catch((e) => {
  console.error('Verification failed:', e);
  process.exit(1);
});