import { prisma } from '../lib/prisma.js';
import {
  findNearbyOnlineProviders,
  emitJobToNearbyProviders,
  emitBookingUpdate,
  haversineKm,
} from '../lib/socketEmitter.js';

export interface CategoryMatch {
  categoryId: number;
  categoryName: string;
  confidence: number;
  explanation: string;
}

export interface NearbyProviderInfo {
  providerId: string;
  name: string;
  category: string;
  hourlyRate: number;
  avgRating: number;
  distanceKm: number;
  isOnline: boolean;
}

// ── 1. Identify Service Category ──────────────────────────────────────────
export async function identifyCategory(text: string): Promise<CategoryMatch | null> {
  const categories = await prisma.serviceCategory.findMany();
  const lower = text.toLowerCase();

  const rules: Array<{ name: string; keywords: string[] }> = [
    {
      name: 'Plumber',
      keywords: ['pipe', 'leak', 'drain', 'faucet', 'sink', 'toilet', 'tap', 'clog', 'water heater', 'plumber', 'plumbing', 'flush', 'shower', 'basin', 'sewage', 'drip', 'water'],
    },
    {
      name: 'Electrician',
      keywords: ['electric', 'wiring', 'wire', 'switch', 'socket', 'plug', 'breaker', 'spark', 'light', 'fan', 'power', 'circuit', 'fuse', 'short circuit', 'voltage', 'mcb'],
    },
    {
      name: 'AC Technician',
      keywords: ['ac', 'air condition', 'hvac', 'cooling', 'compressor', 'freon', 'heating', 'thermostat', 'duct', 'ventilation', 'chiller', 'air filter'],
    },
    {
      name: 'Cleaner',
      keywords: ['clean', 'cleaner', 'cleaning', 'mop', 'sweep', 'vacuum', 'dust', 'deep clean', 'bathroom clean', 'kitchen clean', 'wash', 'sanitization', 'pest', 'disinfect'],
    },
    {
      name: 'Appliance Repair',
      keywords: ['fridge', 'refrigerator', 'washing machine', 'dryer', 'microwave', 'oven', 'dishwasher', 'appliance', 'stove', 'induction', 'grinder', 'mixer'],
    },
    {
      name: 'Carpenter',
      keywords: ['carpenter', 'carpentry', 'wood', 'furniture', 'door', 'window', 'table', 'chair', 'cabinet', 'shelf', 'hinge', 'lock', 'cupboard'],
    },
    {
      name: 'Mechanic',
      keywords: ['mechanic', 'car', 'bike', 'motor', 'engine', 'vehicle', 'tire', 'brake', 'oil change'],
    },
    {
      name: 'Maintenance Worker',
      keywords: ['maintenance', 'paint', 'painting', 'wall', 'handyman', 'repair', 'fix', 'tile', 'drill', 'masonry'],
    },
  ];

  let bestMatch: CategoryMatch | null = null;
  let highestScore = 0;

  for (const rule of rules) {
    let score = 0;
    const matched: string[] = [];
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) {
        score += 1;
        matched.push(kw);
      }
    }

    if (score > highestScore) {
      const foundCategory = categories.find(
        (c) => c.name.toLowerCase().includes(rule.name.toLowerCase()) || rule.name.toLowerCase().includes(c.name.toLowerCase())
      );

      if (foundCategory) {
        highestScore = score;
        bestMatch = {
          categoryId: foundCategory.id,
          categoryName: foundCategory.name,
          confidence: Math.min(1, score * 0.35 + 0.3),
          explanation: `Matched ${matched.join(', ')} related to ${foundCategory.name}`,
        };
      }
    }
  }

  // Fallback if no specific keywords matched: check if category names appear directly
  if (!bestMatch) {
    for (const cat of categories) {
      if (lower.includes(cat.name.toLowerCase())) {
        return {
          categoryId: cat.id,
          categoryName: cat.name,
          confidence: 0.8,
          explanation: `Direct match with category ${cat.name}`,
        };
      }
    }
  }

  return bestMatch;
}

// ── 2. Find Nearby Providers / Service Seekers ────────────────────────────
export async function findNearbyProviders(
  lat: number,
  lng: number,
  categoryName?: string,
  radiusKm: number = 25
): Promise<NearbyProviderInfo[]> {
  try {
    const locations = await prisma.providerLocation.findMany({
      include: {
        provider: {
          include: {
            providerProfile: true,
          },
        },
      },
    });

    const results: NearbyProviderInfo[] = [];

    for (const loc of locations) {
      const profile = loc.provider.providerProfile;
      if (!profile || profile.verifiedStatus !== 'VERIFIED') continue;

      if (
        categoryName &&
        !profile.category.toLowerCase().includes(categoryName.toLowerCase()) &&
        !categoryName.toLowerCase().includes(profile.category.toLowerCase())
      ) {
        // If category is specified, match category loosely
        continue;
      }

      const dist = haversineKm(lat, lng, loc.lat, loc.lng);
      if (dist <= radiusKm || dist <= 50) {
        results.push({
          providerId: loc.providerId,
          name: loc.provider.name,
          category: profile.category,
          hourlyRate: profile.hourlyRate,
          avgRating: profile.avgRating,
          distanceKm: parseFloat(dist.toFixed(2)),
          isOnline: loc.isOnline,
        });
      }
    }

    if (results.length === 0 && categoryName) {
      for (const loc of locations) {
        const profile = loc.provider.providerProfile;
        if (!profile || profile.verifiedStatus !== 'VERIFIED') continue;
        const dist = haversineKm(lat, lng, loc.lat, loc.lng);
        if (dist <= radiusKm || dist <= 50) {
          results.push({
            providerId: loc.providerId,
            name: loc.provider.name,
            category: profile.category,
            hourlyRate: profile.hourlyRate,
            avgRating: profile.avgRating,
            distanceKm: parseFloat(dist.toFixed(2)),
            isOnline: loc.isOnline,
          });
        }
      }
    }

    return results.sort((a, b) => a.distanceKm - b.distanceKm);
  } catch (err) {
    console.error('[agentTools] findNearbyProviders error:', err);
    return [];
  }
}

// ── 3. Create and Broadcast Booking (Swiggy Style) ────────────────────────
export async function createAndBroadcastBooking(
  customerId: string,
  data: {
    categoryId: number;
    description: string;
    address: string;
    lat: number;
    lng: number;
    scheduledAt?: string;
    // Pre-found provider count from the "find nearby" step — used for consistent UI messaging
    confirmedNearbyCount?: number;
  }
) {
  const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : new Date();

  const [booking] = await prisma.$transaction([
    prisma.booking.create({
      data: {
        customerId,
        categoryId: data.categoryId,
        description: data.description,
        address: data.address,
        lat: data.lat,
        lng: data.lng,
        scheduledAt,
        status: 'REQUESTED',
      },
      include: {
        category: true,
        customer: { select: { id: true, name: true, phone: true } },
      },
    }),
  ]);

  await prisma.bookingStatusHistory.create({
    data: {
      bookingId: booking.id,
      status: 'REQUESTED',
    },
  });

  // Emit live socket notification to nearby online providers
  const nearby = findNearbyOnlineProviders(data.lat, data.lng, 25);
  emitJobToNearbyProviders(booking, nearby, 25);

  // Use the pre-confirmed count (from DB find-nearby step) for consistent UI display.
  // Fall back to socket-connected count only if no pre-confirmed count was provided.
  const displayCount = data.confirmedNearbyCount ?? nearby.length;

  return {
    booking,
    nearbyCount: displayCount,
    bookingCode: `FIN-${booking.id.slice(-6).toUpperCase()}`,
  };
}

// ── 4. Check Job Status ───────────────────────────────────────────────────
export async function getBookingStatus(userId: string, bookingId?: string) {
  if (bookingId) {
    const cleanId = bookingId.replace(/^#?FIN-?/i, '');
    let booking = await prisma.booking.findUnique({
      where: { id: cleanId },
      include: {
        category: true,
        customer: { select: { id: true, name: true, phone: true } },
        provider: { select: { id: true, name: true, phone: true } },
      },
    });

    if (!booking) {
      // Try searching by suffix if user entered 6-char code
      const matched = await prisma.booking.findMany({
        where: {
          id: { endsWith: cleanId.toLowerCase() },
          OR: [{ customerId: userId }, { providerId: userId }],
        },
        include: {
          category: true,
          customer: { select: { id: true, name: true, phone: true } },
          provider: { select: { id: true, name: true, phone: true } },
        },
        take: 1,
      });
      booking = matched[0] || null;
    }

    return booking;
  }

  // Fetch most recent booking for this user
  return prisma.booking.findFirst({
    where: { customerId: userId },
    orderBy: { requestedAt: 'desc' },
    include: {
      category: true,
      customer: { select: { id: true, name: true, phone: true } },
      provider: { select: { id: true, name: true, phone: true } },
    },
  });
}

// ── 5. Cancel Booking ─────────────────────────────────────────────────────
export async function cancelBooking(userId: string, bookingId: string, reason?: string) {
  const cleanId = bookingId.replace(/^#?FIN-?/i, '');
  let booking = await prisma.booking.findUnique({ where: { id: cleanId } });

  if (!booking) {
    const matched = await prisma.booking.findMany({
      where: {
        id: { endsWith: cleanId.toLowerCase() },
        OR: [{ customerId: userId }, { providerId: userId }],
      },
      take: 1,
    });
    booking = matched[0] || null;
  }

  if (!booking) {
    return { success: false, error: 'Booking not found' };
  }

  if (booking.customerId !== userId && booking.providerId !== userId) {
    return { success: false, error: 'Not authorized to cancel this booking' };
  }

  const cancellableStatuses = ['REQUESTED', 'ACCEPTED', 'EN_ROUTE'];
  if (!cancellableStatuses.includes(booking.status)) {
    return {
      success: false,
      error: `Cannot cancel booking with status ${booking.status}. Only unstarted orders can be cancelled.`,
    };
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: 'CANCELLED' },
    include: { category: true },
  });

  await prisma.bookingStatusHistory.create({
    data: {
      bookingId: booking.id,
      status: 'CANCELLED',
    },
  });

  emitBookingUpdate(booking.id, 'CANCELLED');

  return {
    success: true,
    booking: updated,
    reason: reason || 'Cancelled by customer via FixItNow assistant',
  };
}
