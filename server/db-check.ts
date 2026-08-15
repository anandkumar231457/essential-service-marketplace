import { prisma } from './src/lib/prisma.js';

async function main() {
  const users = await prisma.user.count();
  const cats = await prisma.serviceCategory.count();
  const profiles = await prisma.providerProfile.count();
  const locs = await prisma.providerLocation.count();
  console.log('users:', users, 'categories:', cats, 'profiles:', profiles, 'locations:', locs);

  // Check PostGIS geography column is populated
  const withGeo = await prisma.$queryRaw`SELECT COUNT(*)::int AS c FROM "ProviderLocation" WHERE location IS NOT NULL`;
  console.log('locations with geography:', JSON.stringify(withGeo));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('DB check failed:', e);
  process.exit(1);
});