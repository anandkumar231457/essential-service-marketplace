import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

/**
 * POST /api/bookings/:bookingId/reviews
 * Customer rates a completed booking. Updates provider's avgRating.
 */
export async function create(req: Request, res: Response) {
  const user = res.locals.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { bookingId } = req.params;
  const { rating, comment } = req.body;

  if (!bookingId) return res.status(400).json({ error: 'bookingId is required' });
  if (typeof rating !== 'number' || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'rating must be a number between 1 and 5' });
  }

  // Find the booking
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { review: true },
  });

  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  // Only the customer who made the booking can review it
  if (booking.customerId !== user.userId) {
    return res.status(403).json({ error: 'Only the booking customer can review' });
  }

  // Only completed bookings can be reviewed
  if (booking.status !== 'COMPLETED') {
    return res.status(400).json({ error: 'Only completed bookings can be reviewed' });
  }

  // Prevent duplicate reviews
  if (booking.review) {
    return res.status(409).json({ error: 'Booking already reviewed' });
  }

  // Create the review
  const review = await prisma.review.create({
    data: {
      bookingId,
      rating,
      comment: comment ?? null,
    },
  });

  // Recalculate provider's avgRating from all their reviews
  const providerBookings = await prisma.booking.findMany({
    where: { providerId: booking.providerId, status: 'COMPLETED' },
    select: { review: { select: { rating: true } } },
  });

  const ratings = providerBookings
    .map((b) => b.review?.rating)
    .filter((r): r is number => typeof r === 'number');

  const avgRating = ratings.length
    ? +(ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
    : 0;

  await prisma.providerProfile.update({
    where: { userId: booking.providerId },
    data: { avgRating },
  });

  return res.status(201).json({ review, avgRating });
}