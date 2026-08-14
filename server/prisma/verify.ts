import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.count();
  const categories = await prisma.serviceCategory.count();
  const profiles = await prisma.providerProfile.count();
  const locations = await prisma.providerLocation.count();
  const providers = await prisma.user.count({ where: { role: 'PROVIDER' } });
  const customers = await prisma.user.count({ where: { role: 'CUSTOMER' } });

  console.log('users:', users);
  console.log('  providers:', providers);
  console.log('  customers:', customers);
  console.log('categories:', categories);
  console.log('providerProfiles:', profiles);
  console.log('providerLocations:', locations);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });