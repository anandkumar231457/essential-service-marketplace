import { Request, Response } from 'express';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../auth/jwt.js';
import { prisma } from '../lib/prisma.js';
import { compare as bcryptCompare, hash as bcryptHash } from 'bcrypt';

async function ensureProviderDefaults(userId: string) {
  try {
    // Ensure ProviderProfile exists and is VERIFIED
    await prisma.providerProfile.upsert({
      where: { userId },
      create: {
        userId,
        category: 'Electrician',
        skills: ['General Repair', 'Wiring', 'Emergency Service'],
        hourlyRate: 500,
        avgRating: 5.0,
        verifiedStatus: 'VERIFIED',
      },
      update: {
        verifiedStatus: 'VERIFIED',
      },
    });

    // Ensure ProviderLocation exists
    await prisma.providerLocation.upsert({
      where: { providerId: userId },
      create: {
        providerId: userId,
        lat: 12.9352,
        lng: 77.6245,
        isOnline: true,
      },
      update: {
        isOnline: true,
      },
    });
  } catch (err) {
    console.error('Error ensuring provider defaults:', err);
  }
}

export async function register(req: Request, res: Response) {
  const { name, phone, email, password, role, address, lat, lng } = req.body;
  const userRole = role === 'PROVIDER' ? 'PROVIDER' : 'CUSTOMER';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const existingPhone = await prisma.user.findUnique({ where: { phone } });
  if (existingPhone) {
    return res.status(409).json({ error: 'Phone number already registered' });
  }

  const passwordHash = await bcryptHash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      phone,
      email,
      passwordHash,
      role: userRole,
      address: address || null,
      lat: typeof lat === 'number' ? lat : null,
      lng: typeof lng === 'number' ? lng : null,
    },
  });

  if (user.role === 'PROVIDER') {
    await ensureProviderDefaults(user.id);
  }

  const accessToken = signAccessToken(user.id, user.role);
  const refreshToken = signRefreshToken(user.id);

  return res.status(201).json({
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      address: user.address,
      lat: user.lat,
      lng: user.lng,
    },
    accessToken,
    refreshToken,
  });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await bcryptCompare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (user.role === 'PROVIDER') {
    await ensureProviderDefaults(user.id);
  }

  const accessToken = signAccessToken(user.id, user.role);
  const refreshToken = signRefreshToken(user.id);

  return res.json({
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      address: user.address,
      lat: user.lat,
      lng: user.lng,
    },
    accessToken,
    refreshToken,
  });
}

export async function googleAuth(req: Request, res: Response) {
  const { name, email, role } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required for Google Sign-In' });
  }

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    const userRole = role === 'PROVIDER' ? 'PROVIDER' : 'CUSTOMER';
    const randomPassword = Math.random().toString(36).slice(-10);
    const passwordHash = await bcryptHash(randomPassword, 10);
    const phone = `+91-G-${Math.floor(1000000000 + Math.random() * 9000000000)}`;

    user = await prisma.user.create({
      data: {
        name: name || 'Google User',
        phone,
        email,
        passwordHash,
        role: userRole,
      },
    });
  }

  if (user.role === 'PROVIDER') {
    await ensureProviderDefaults(user.id);
  }

  const accessToken = signAccessToken(user.id, user.role);
  const refreshToken = signRefreshToken(user.id);

  return res.json({
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      address: user.address,
      lat: user.lat,
      lng: user.lng,
    },
    accessToken,
    refreshToken,
  });
}

export async function refresh(req: Request, res: Response) {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }

  try {
    const payload = verifyRefreshToken(refreshToken);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const newAccessToken = signAccessToken(user.id, user.role);
    const newRefreshToken = signRefreshToken(user.id);

    return res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
}
