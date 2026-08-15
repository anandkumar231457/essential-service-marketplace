import { Request, Response } from 'express';
import { $Enums } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

// ── Booking state machine ────────────────────────────────────────────────
// Valid transitions:
//   REQUESTED  → ACCEPTED | REJECTED | CANCELLED
//   ACCEPTED   → EN_ROUTE | CANCELLED
//   EN_ROUTE   → IN_PROGRESS | CANCELLED
//   IN_PROGRESS→ COMPLETED
//   COMPLETED  → (terminal)
//   CANCELLED  → (terminal)
//   REJECTED   → (terminal)

const VALID_TRANSITIONS: Record<string, string[]> = {
  REQUESTED: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
  ACCEPTED: ['EN_ROUTE', 'CANCELLED'],
  EN_ROUTE: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

/** Validate a transition; returns error message or null. */
function validateTransition(current: string, next: string): string | null {
  if (current === next) return `Booking is already ${current}`;
  const allowed = VALID_TRANSITIONS[current];
  if (!allowed) return `Invalid transition from ${current}`;
  if (!allowed.includes(next)) {
    return `Invalid transition: ${current} → ${next} not allowed. Allowed: ${allowed.join(', ')}`;
  }
  return null;
}

/** Update booking status + append to status history (audit trail). */
async function transitionBooking(bookingId: string, nextStatus: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new Error('Booking not found');

  const error = validateTransition(booking.status, nextStatus);
  if (error) throw new Error(error);

  // Update status + record history atomically
  const [updated] = await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: { status: nextStatus as $Enums.BookingStatus },
    }),
    prisma.bookingStatusHistory.create({
      data: {
        bookingId,
        status: nextStatus as $Enums.BookingStatus,
      },
    }),
  ]);

  return updated;
}

// ── Endpoints ────────────────────────────────────────────────────────────

/** POST /api/bookings/request — customer requests a booking. */
export async function request(req: Request, res: Response) {
  const user = res.locals.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { providerId, categoryId, address, lat, lng, scheduledAt } = req.body;

  if (!providerId || !categoryId || !address || typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'providerId, categoryId, address, lat, lng are required' });
  }

  // Verify provider exists and is verified
  const provider = await prisma.providerProfile.findUnique({ where: { userId: providerId } });
  if (!provider || provider.verifiedStatus !== 'VERIFIED') {
    return res.status(400).json({ error: 'Provider not available' });
  }

  const booking = await prisma.booking.create({
    data: {
      customerId: user.userId,
      providerId,
      categoryId,
      address,
      lat,
      lng,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      status: 'REQUESTED',
    },
  });

  // Record initial status history
  await prisma.bookingStatusHistory.create({
    data: { bookingId: booking.id, status: 'REQUESTED' },
  });

  return res.status(201).json({ booking });
}

/** POST /api/bookings/accept — provider accepts (REQUESTED → ACCEPTED). */
export async function accept(req: Request, res: Response) {
  const user = res.locals.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { bookingId } = req.body;
  if (!bookingId) return res.status(400).json({ error: 'bookingId is required' });

  try {
    const booking = await transitionBooking(bookingId, 'ACCEPTED');
    return res.json({ booking });
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message });
  }
}

/** POST /api/bookings/en-route — provider en route (ACCEPTED → EN_ROUTE). */
export async function enRoute(req: Request, res: Response) {
  const user = res.locals.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { bookingId } = req.body;
  if (!bookingId) return res.status(400).json({ error: 'bookingId is required' });

  try {
    const booking = await transitionBooking(bookingId, 'EN_ROUTE');
    return res.json({ booking });
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message });
  }
}

/** POST /api/bookings/in-progress — provider arrived (EN_ROUTE → IN_PROGRESS). */
export async function inProgress(req: Request, res: Response) {
  const user = res.locals.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { bookingId } = req.body;
  if (!bookingId) return res.status(400).json({ error: 'bookingId is required' });

  try {
    const booking = await transitionBooking(bookingId, 'IN_PROGRESS');
    return res.json({ booking });
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message });
  }
}

/** POST /api/bookings/complete — provider completes (IN_PROGRESS → COMPLETED). */
export async function complete(req: Request, res: Response) {
  const user = res.locals.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { bookingId } = req.body;
  if (!bookingId) return res.status(400).json({ error: 'bookingId is required' });

  try {
    const booking = await transitionBooking(bookingId, 'COMPLETED');
    return res.json({ booking });
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message });
  }
}

/** POST /api/bookings/cancel — customer or provider cancels. */
export async function cancel(req: Request, res: Response) {
  const user = res.locals.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { bookingId } = req.body;
  if (!bookingId) return res.status(400).json({ error: 'bookingId is required' });

  try {
    const booking = await transitionBooking(bookingId, 'CANCELLED');
    return res.json({ booking });
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message });
  }
}