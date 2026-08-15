import { PrismaClient } from '@prisma/client';

// Single shared PrismaClient instance for the whole app.
export const prisma = new PrismaClient();