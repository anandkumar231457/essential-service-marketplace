import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { emitJobToNearbyProviders, findNearbyOnlineProviders, broadcastJobClaimed, emitBookingUpdate } from '../lib/socketEmitter.js';

// ── Booking state machine ────────────────────────────────────────────────
const VALID_TRANSITIONS: Record<string, string[]> = {
  REQUESTED: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
  ACCEPTED: ['EN_ROUTE', 'CANCELLED'],
  EN_ROUTE: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

function validateTransition(current: string, next: string): string | null {
  if (current === next) return `Booking is already ${current}`;
  const allowed = VALID_TRANSITIONS[current];
  if (!allowed) return `Invalid transition from ${current}`;
  if (!allowed.includes(next)) {
    return `Invalid transition: ${current} → ${next}. Allowed: ${allowed.join(', ')}`;
  }
  return null;
}

// ── Endpoints ────────────────────────────────────────────────────────────

/**
 * POST /api/bookings/request
 * - If providerId is provided → direct booking to that specific specialist.
 * - If providerId is omitted / null → Swiggy/Zomato broadcast dispatch:
 *   1. Saves booking with providerId = null.
 *   2. Queries in-memory presence map (updated by live socket GPS pings) for nearby online providers.
 *   3. Emits job:broadcast ONLY to those specific provider socket IDs.
 */
export async function request(req: Request, res: Response) {
  const user = res.locals.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { providerId, categoryId, address, lat, lng, scheduledAt, description, radiusKm: customRadius } = req.body;

  const numCategoryId = typeof categoryId === 'number' ? categoryId : parseInt(categoryId, 10);
  const numLat = typeof lat === 'number' ? lat : parseFloat(lat);
  const numLng = typeof lng === 'number' ? lng : parseFloat(lng);
  const radiusKm = typeof customRadius === 'number' ? customRadius : parseFloat(customRadius) || 25;

  const finalAddress = (typeof address === 'string' && address.trim())
    ? address.trim()
    : (!isNaN(numLat) && !isNaN(numLng) ? `Live GPS Location (${numLat.toFixed(5)}, ${numLng.toFixed(5)})` : '');

  if (isNaN(numCategoryId) || !finalAddress || isNaN(numLat) || isNaN(numLng)) {
    return res.status(400).json({ error: 'categoryId, lat, and lng are required' });
  }

  try {
    // If a specific provider was requested, verify they exist
    if (providerId) {
      const provider = await prisma.providerProfile.findUnique({ where: { userId: providerId } });
      if (!provider || provider.verifiedStatus !== 'VERIFIED') {
        return res.status(400).json({ error: 'Selected provider not available' });
      }
    }

    let parsedDate: Date | null = null;
    if (scheduledAt) {
      const d = new Date(scheduledAt);
      if (!isNaN(d.getTime())) parsedDate = d;
    }

    // 1. Save booking to PostgreSQL with providerId = null for open broadcast jobs
    const booking = await prisma.booking.create({
      data: {
        customerId: user.userId,
        providerId: providerId || null,
        categoryId: numCategoryId,
        address: finalAddress,
        lat: numLat,
        lng: numLng,
        scheduledAt: parsedDate,
        description: description || null,
        status: 'REQUESTED',
      },
      include: {
        category: true,
        customer: { select: { name: true, phone: true } },
      },
    });

    await prisma.bookingStatusHistory.create({
      data: { bookingId: booking.id, status: 'REQUESTED' },
    });

    // 2. Find nearby online providers using in-memory GPS presence map (Haversine, no PostGIS needed)
    const nearbyProviders = findNearbyOnlineProviders(numLat, numLng, radiusKm);
    console.log(`[Dispatch] Job ${booking.id}: found ${nearbyProviders.length} provider(s) within ${radiusKm}km`);

    // 3. Emit job:broadcast ONLY to their specific socket IDs
    emitJobToNearbyProviders(booking, nearbyProviders, radiusKm);

    return res.status(201).json({
      booking,
      nearbyWorkersCount: nearbyProviders.length,
      radiusKm,
      nearbyProviders: nearbyProviders.map((p) => ({ providerId: p.providerId, distanceKm: p.distanceKm })),
    });
  } catch (err: any) {
    console.error('Error creating booking:', err);
    return res.status(500).json({ error: err.message || 'Failed to create booking' });
  }
}



/**
 * POST /api/bookings/:bookingId/rebroadcast
 * Expands search radius (e.g. 10km -> 20km -> 30km) and re-broadcasts unassigned jobs.
 */
export async function rebroadcast(req: Request, res: Response) {
  const user = res.locals.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { bookingId } = req.params;
  const radiusKm = parseFloat(req.body.radiusKm ?? '20') || 20;

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { category: true, customer: { select: { name: true, phone: true } } },
    });

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.status !== 'REQUESTED' || booking.providerId !== null) {
      return res.status(400).json({ error: 'Booking is already accepted or not open' });
    }

    // Use in-memory Haversine with expanded radius
    const nearbyProviders = findNearbyOnlineProviders(booking.lat!, booking.lng!, radiusKm);
    console.log(`[Rebroadcast] Job ${bookingId}: ${nearbyProviders.length} providers within ${radiusKm}km`);

    emitJobToNearbyProviders(booking, nearbyProviders, radiusKm);

    return res.json({ success: true, bookingId, radiusKm, nearbyWorkersCount: nearbyProviders.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to re-broadcast' });
  }
}

/**
 * POST /api/bookings/accept
 * ATOMIC FIRST-ACCEPT-WINS:
 * Uses a conditional update where status = 'REQUESTED' AND (providerId IS NULL OR providerId = current_user).
 * If another worker accepted first, count = 0 → returns 409 Conflict.
 * If winner → sets providerId, status = ACCEPTED, emits 'job:claimed' and 'booking:status-update'.
 */
export async function accept(req: Request, res: Response) {
  const user = res.locals.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { bookingId } = req.body;
  if (!bookingId) return res.status(400).json({ error: 'bookingId is required' });

  try {
    // 1. Ensure provider profile exists and is verified
    await prisma.providerProfile.upsert({
      where: { userId: user.userId },
      create: {
        userId: user.userId,
        category: 'Electrician',
        skills: ['General Repair', 'Maintenance', 'Emergency Service'],
        hourlyRate: 500,
        avgRating: 5.0,
        verifiedStatus: 'VERIFIED',
      },
      update: {
        verifiedStatus: 'VERIFIED',
      },
    });

    // 2. ATOMIC UPDATE: Only update if booking is still REQUESTED and unassigned (or assigned to this user)
    const result = await prisma.booking.updateMany({
      where: {
        id: bookingId,
        status: 'REQUESTED',
        OR: [
          { providerId: null },
          { providerId: user.userId },
        ],
      },
      data: {
        status: 'ACCEPTED',
        providerId: user.userId,
      },
    });

    if (result.count === 0) {
      // Another specialist already grabbed this order!
      return res.status(409).json({
        error: 'This order was already accepted by another specialist! It has been removed from your queue.',
        alreadyTaken: true,
      });
    }

    // 3. Record audit history
    await prisma.bookingStatusHistory.create({
      data: { bookingId, status: 'ACCEPTED' },
    });

    // 4. Fetch full updated booking
    const updatedBooking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        category: true,
        customer: { select: { name: true, phone: true } },
        provider: { select: { id: true, name: true, phone: true } },
      },
    });

    // 5. Broadcast in real time:
    // a) Remove job from all other workers' dashboards
    broadcastJobClaimed(bookingId, user.userId, updatedBooking?.provider?.name);

    // b) Notify customer tracking room that order was accepted
    emitBookingUpdate(bookingId, 'ACCEPTED', updatedBooking?.provider);

    return res.json({ booking: updatedBooking });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Failed to accept booking' });
  }
}

/** POST /api/bookings/en-route — provider en route (ACCEPTED → EN_ROUTE). */
export async function enRoute(req: Request, res: Response) {
  const user = res.locals.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { bookingId } = req.body;
  if (!bookingId) return res.status(400).json({ error: 'bookingId is required' });

  try {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.providerId !== user.userId) return res.status(403).json({ error: 'Not assigned to you' });

    const err = validateTransition(booking.status, 'EN_ROUTE');
    if (err) return res.status(400).json({ error: err });

    const [updated] = await prisma.$transaction([
      prisma.booking.update({ where: { id: bookingId }, data: { status: 'EN_ROUTE' } }),
      prisma.bookingStatusHistory.create({ data: { bookingId, status: 'EN_ROUTE' } }),
    ]);

    emitBookingUpdate(bookingId, 'EN_ROUTE');
    return res.json({ booking: updated });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

/** POST /api/bookings/in-progress — provider arrived (EN_ROUTE → IN_PROGRESS). */
export async function inProgress(req: Request, res: Response) {
  const user = res.locals.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { bookingId } = req.body;
  if (!bookingId) return res.status(400).json({ error: 'bookingId is required' });

  try {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.providerId !== user.userId) return res.status(403).json({ error: 'Not assigned to you' });

    const err = validateTransition(booking.status, 'IN_PROGRESS');
    if (err) return res.status(400).json({ error: err });

    const [updated] = await prisma.$transaction([
      prisma.booking.update({ where: { id: bookingId }, data: { status: 'IN_PROGRESS' } }),
      prisma.bookingStatusHistory.create({ data: { bookingId, status: 'IN_PROGRESS' } }),
    ]);

    emitBookingUpdate(bookingId, 'IN_PROGRESS');
    return res.json({ booking: updated });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

/** POST /api/bookings/complete — provider marks done (IN_PROGRESS → COMPLETED). */
export async function complete(req: Request, res: Response) {
  const user = res.locals.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { bookingId } = req.body;
  if (!bookingId) return res.status(400).json({ error: 'bookingId is required' });

  try {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.providerId !== user.userId) return res.status(403).json({ error: 'Not assigned to you' });

    const err = validateTransition(booking.status, 'COMPLETED');
    if (err) return res.status(400).json({ error: err });

    const [updated] = await prisma.$transaction([
      prisma.booking.update({ where: { id: bookingId }, data: { status: 'COMPLETED' } }),
      prisma.bookingStatusHistory.create({ data: { bookingId, status: 'COMPLETED' } }),
    ]);

    emitBookingUpdate(bookingId, 'COMPLETED');
    return res.json({ booking: updated });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

/** POST /api/bookings/cancel — customer or provider cancels. */
export async function cancel(req: Request, res: Response) {
  const user = res.locals.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { bookingId } = req.body;
  if (!bookingId) return res.status(400).json({ error: 'bookingId is required' });

  try {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.customerId !== user.userId && booking.providerId !== user.userId) {
      return res.status(403).json({ error: 'Not authorized to cancel this booking' });
    }

    const err = validateTransition(booking.status, 'CANCELLED');
    if (err) return res.status(400).json({ error: err });

    const [updated] = await prisma.$transaction([
      prisma.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED' } }),
      prisma.bookingStatusHistory.create({ data: { bookingId, status: 'CANCELLED' } }),
    ]);

    emitBookingUpdate(bookingId, 'CANCELLED');
    return res.json({ booking: updated });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
