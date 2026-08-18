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
async function transitionBooking(bookingId: string, nextStatus: string, providerId?: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new Error('Booking not found');

  const error = validateTransition(booking.status, nextStatus);
  if (error) throw new Error(error);

  // When any provider accepts a REQUESTED order, assign them as the active provider
  const updateData: any = { status: nextStatus as $Enums.BookingStatus };
  if (nextStatus === 'ACCEPTED' && providerId) {
    updateData.providerId = providerId;
  }

  const [updated] = await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: updateData,
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

/**
 * POST /api/bookings/request — customer posts a job or books a provider.
 * providerId is optional.
 */
export async function request(req: Request, res: Response) {
  const user = res.locals.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { providerId, categoryId, address, lat, lng, scheduledAt } = req.body;

  if (!categoryId || !address || typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'categoryId, address, lat, lng are required' });
  }

  try {
    let targetProviderId = providerId;

    if (targetProviderId) {
      const provider = await prisma.providerProfile.findUnique({ where: { userId: targetProviderId } });
      if (!provider || provider.verifiedStatus !== 'VERIFIED') {
        return res.status(400).json({ error: 'Selected provider not available' });
      }
    } else {
      // Find matching verified provider in category or any verified provider as placeholder
      const categoryRecord = await prisma.serviceCategory.findUnique({ where: { id: categoryId } });
      const matched = await prisma.providerProfile.findFirst({
        where: {
          verifiedStatus: 'VERIFIED',
          ...(categoryRecord ? { category: categoryRecord.name } : {}),
        },
        select: { userId: true },
      });

      if (matched) {
        targetProviderId = matched.userId;
      } else {
        const fallback = await prisma.providerProfile.findFirst({
          where: { verifiedStatus: 'VERIFIED' },
          select: { userId: true },
        });
        targetProviderId = fallback ? fallback.userId : user.userId;
      }
    }

    let parsedDate: Date | null = null;
    if (scheduledAt) {
      const d = new Date(scheduledAt);
      if (!isNaN(d.getTime())) {
        parsedDate = d;
      }
    }

    const booking = await prisma.booking.create({
      data: {
        customerId: user.userId,
        providerId: targetProviderId,
        categoryId,
        address,
        lat,
        lng,
        scheduledAt: parsedDate,
        status: 'REQUESTED',
      },
    });

    await prisma.bookingStatusHistory.create({
      data: { bookingId: booking.id, status: 'REQUESTED' },
    });

    return res.status(201).json({ booking });
  } catch (err: any) {
    console.error('Error creating booking request:', err);
    return res.status(500).json({ error: err.message || 'Failed to create booking request' });
  }
}

/** POST /api/bookings/accept — provider accepts (REQUESTED → ACCEPTED). */
export async function accept(req: Request, res: Response) {
  const user = res.locals.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { bookingId } = req.body;
  if (!bookingId) return res.status(400).json({ error: 'bookingId is required' });

  try {
    const booking = await transitionBooking(bookingId, 'ACCEPTED', user.userId);
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
    const booking = await transitionBooking(bookingId, 'EN_ROUTE', user.userId);
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
    const booking = await transitionBooking(bookingId, 'IN_PROGRESS', user.userId);
    return res.json({ booking });
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message });
  }
}

/** POST /api/bookings/complete — provider marks done (IN_PROGRESS → COMPLETED). */
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

    const error = validateTransition(booking.status, 'CANCELLED');
    if (error) return res.status(400).json({ error });

    const [updated] = await prisma.$transaction([
      prisma.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED' } }),
      prisma.bookingStatusHistory.create({ data: { bookingId, status: 'CANCELLED' } }),
    ]);

    return res.json({ booking: updated });
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message });
  }
}
