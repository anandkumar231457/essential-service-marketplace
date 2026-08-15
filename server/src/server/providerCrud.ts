import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

// ── Provider profile CRUD ────────────────────────────────────────────────

/** POST /api/providers — create a provider profile (PROVIDER only). */
export async function create(req: Request, res: Response) {
  const user = res.locals.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { category, skills, hourlyRate, idDocumentUrl } = req.body;

  // Validate required fields
  if (!category || !Array.isArray(skills) || typeof hourlyRate !== 'number') {
    return res.status(400).json({ error: 'category, skills[], and hourlyRate are required' });
  }

  // Check if profile already exists
  const existing = await prisma.providerProfile.findUnique({ where: { userId: user.userId } });
  if (existing) {
    return res.status(409).json({ error: 'Provider profile already exists' });
  }

  const profile = await prisma.providerProfile.create({
    data: {
      userId: user.userId,
      category,
      skills,
      hourlyRate,
      idDocumentUrl: idDocumentUrl ?? null,
    },
  });

  return res.status(201).json({ profile });
}

/** GET /api/providers/me — read own provider profile. */
export async function read(_req: Request, res: Response) {
  const user = res.locals.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const profile = await prisma.providerProfile.findUnique({
    where: { userId: user.userId },
    include: { user: { select: { name: true, phone: true, email: true } } },
  });

  if (!profile) {
    return res.status(404).json({ error: 'Provider profile not found' });
  }

  return res.json({ profile });
}

/** PUT /api/providers/me — update own provider profile (PROVIDER only). */
export async function update(req: Request, res: Response) {
  const user = res.locals.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { category, skills, hourlyRate, idDocumentUrl } = req.body;

  const profile = await prisma.providerProfile.findUnique({ where: { userId: user.userId } });
  if (!profile) {
    return res.status(404).json({ error: 'Provider profile not found' });
  }

  const updated = await prisma.providerProfile.update({
    where: { userId: user.userId },
    data: {
      ...(category !== undefined && { category }),
      ...(skills !== undefined && { skills }),
      ...(hourlyRate !== undefined && { hourlyRate }),
      ...(idDocumentUrl !== undefined && { idDocumentUrl }),
    },
  });

  return res.json({ profile: updated });
}

// ── Nearby provider search (PostGIS) ─────────────────────────────────────

/**
 * GET /api/providers/nearby?lat=&lng=&category=&radiusKm=
 * Uses PostGIS ST_DWithin + ST_Distance, sorted by distance.
 */
export async function nearby(req: Request, res: Response) {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);
  const radiusKm = parseFloat((req.query.radiusKm as string) ?? '5');
  const category = req.query.category as string | undefined;

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: 'lat and lng query params are required' });
  }
  if (isNaN(radiusKm) || radiusKm <= 0) {
    return res.status(400).json({ error: 'radiusKm must be a positive number' });
  }

  // Use PostGIS ST_DWithin to filter and ST_Distance to sort by distance.
  // The `location` column is a geography(Point) created via raw SQL.
  // Build the category filter as a parameterized SQL fragment so every
  // user-supplied value (lat, lng, radius, category) is bound as a
  // parameter — never string-interpolated into the query.
  const categoryFilter = category
    ? Prisma.sql`AND pp.category = ${category}`
    : Prisma.empty;

  const providers = await prisma.$queryRaw(Prisma.sql`
    SELECT
      u.id AS "providerId",
      u.name,
      u.phone,
      pp.category,
      pp.skills,
      pp."hourlyRate",
      pp."avgRating",
      pp."verifiedStatus",
      pl.lat,
      pl.lng,
      pl."isOnline",
      ROUND(
        (ST_Distance(pl.location, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) / 1000)::numeric,
        2
      ) AS "distanceKm"
    FROM "ProviderLocation" pl
    JOIN "User" u ON u.id = pl."providerId"
    JOIN "ProviderProfile" pp ON pp."userId" = u.id
    WHERE pl."isOnline" = true
      AND pp."verifiedStatus" = 'VERIFIED'
      AND ST_DWithin(
        pl.location,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        ${radiusKm * 1000}
      )
      ${categoryFilter}
    ORDER BY ST_Distance(pl.location, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography)
    LIMIT 50
  `);

  return res.json({ providers, count: (providers as unknown[]).length });
}