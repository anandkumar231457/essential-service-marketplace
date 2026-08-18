import { Request, Response } from 'express';
import { $Enums } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

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

async function transitionBooking(bookingId: string, nextStatus: string, actorId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new Error('Booking not found');

  const error = validateTransition(booking.status, nextStatus);
  if (error) throw new Error(error);

  const updateData: any = { status: nextStatus as $Enums.BookingStatus };

  // When a provider accepts an OPEN or direct job, assign them as active provider
  if (nextStatus === 'ACCEPTED') {
    updateData.providerId = actorId;
  }

  const [updated] = await prisma.$transaction([
    prisma.booking.update({ where: { id: bookingId }, data: updateData }),
    prisma.bookingStatusHistory.create({
      data: { bookingId, status: nextStatus as $Enums.BookingStatus },
    }),
  ]);

  return updated;
}

// ── Endpoints ────────────────────────────────────────────────────────────

/**
 * POST /api/bookings/request
 * If providerId is given → direct booking to that specific provider.
 * If providerId is omitted → OPEN/BROADCAST job: any provider can pick it up.
 */
export async function request(req: Request, res: Response) {
  const user = res.locals.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { providerId, categoryId, address, lat, lng, scheduledAt, description } = req.body;

  const numCategoryId = typeof categoryId === 'number' ? categoryId : parseInt(categoryId, 10);
  const numLat = typeof lat === 'number' ? lat : parseFloat(lat);
  const numLng = typeof lng === 'number' ? lng : parseFloat(lng);

  if (isNaN(numCategoryId) || !address || isNaN(numLat) || isNaN(numLng)) {
    return res.status(400).json({ error: 'categoryId, address, lat, lng are required' });
  }

  try {
    // If a specific provider was requested, verify they exist and are VERIFIED
    if (providerId) {
      const provider = await prisma.providerProfile.findUnique({ where: { userId: providerId } });
      if (!provider || provider.verifiedStatus !== 'VERIFIED') {
        return res.status(400).json({ error: 'Selected provider not available' });
      }
    }
    // If no providerId → leave null (open broadcast — any provider can accept)

    let parsedDate: Date | null = null;
    if (scheduledAt) {
      const d = new Date(scheduledAt);
      if (!isNaN(d.getTime())) parsedDate = d;
    }

    const booking = await prisma.booking.create({
      data: {
        customerId: user.userId,
        providerId: providerId || null,  // NULL = open job for any provider
        categoryId: numCategoryId,
        address,
        lat: numLat,
        lng: numLng,
        scheduledAt: parsedDate,
        description: description || null,
        status: 'REQUESTED',
      },
    });

    await prisma.bookingStatusHistory.create({
      data: { bookingId: booking.id, status: 'REQUESTED' },
    });

    return res.status(201).json({ booking });
  } catch (err: any) {
    console.error('Error creating booking:', err);
    return res.status(500).json({ error: err.message || 'Failed to create booking' });
  }
}

export async function accept(req: Request, res: Response) {
  const user = res.locals.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const { bookingId } = req.body;
  if (!bookingId) return res.status(400).json({ error: 'bookingId is required' });

  try {
    // Ensure provider profile exists for this accepting user
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

    const booking = await transitionBooking(bookingId, 'ACCEPTED', user.userId);
    return res.json({ booking });
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message });
  }
}

export async function enRoute(req: Request, res: Response) {
  const user = res.locals.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const { bookingId } = req.body;
  if (!bookingId) return res.status(400).json({ error: 'bookingId is required' });
  try {
    const booking = await transitionBooking(bookingId, 'EN_ROUTE', user.userId);
    return res.json({ booking });
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message });
  }
}

export async function inProgress(req: Request, res: Response) {
  const user = res.locals.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const { bookingId } = req.body;
  if (!bookingId) return res.status(400).json({ error: 'bookingId is required' });
  try {
    const booking = await transitionBooking(bookingId, 'IN_PROGRESS', user.userId);
    return res.json({ booking });
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message });
  }
}

export async function complete(req: Request, res: Response) {
  const user = res.locals.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const { bookingId } = req.body;
  if (!bookingId) return res.status(400).json({ error: 'bookingId is required' });
  try {
    const booking = await transitionBooking(bookingId, 'COMPLETED', user.userId);
    return res.json({ booking });
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message });
  }
}

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
    return res.json({ booking: updated });
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message });
  }
}
