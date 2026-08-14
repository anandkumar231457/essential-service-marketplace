import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Check PostGIS extension is enabled
  const ext = await prisma.$queryRaw<{ extname: string }[]>`
    SELECT extname FROM pg_extension WHERE extname = 'postgis'
  `;
  console.log('postgis extension:', ext.length > 0 ? 'ENABLED' : 'MISSING');

  // Check the geography column exists on ProviderLocation
  const col = await prisma.$queryRaw<{ column_name: string; data_type: string }[]>`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'ProviderLocation' AND column_name = 'location'
  `;
  console.log('location column:', col.length > 0 ? `${col[0].data_type}` : 'MISSING');

  // Check the GiST index exists
  const idx = await prisma.$queryRaw<{ indexname: string }[]>`
    SELECT indexname FROM pg_indexes WHERE tablename = 'ProviderLocation' AND indexdef ILIKE '%gist%'
  `;
  console.log('gist index:', idx.length > 0 ? idx[0].indexname : 'MISSING');

  // Test a spatial query: providers within 5km of Koramangala (12.9352, 77.6245)
  const nearby = await prisma.$queryRaw<{ name: string; distance_m: number }[]>`
    SELECT u.name,
           ST_Distance(l.location, ST_SetSRID(ST_MakePoint(77.6245, 12.9352), 4326)::geography) AS distance_m
    FROM "ProviderLocation" l
    JOIN "User" u ON u.id = l."providerId"
    WHERE ST_DWithin(l.location, ST_SetSRID(ST_MakePoint(77.6245, 12.9352), 4326)::geography, 5000)
    ORDER BY distance_m
  `;
  console.log('providers within 5km of Koramangala:', nearby.length);
  for (const n of nearby) {
    console.log(`  ${n.name}: ${Math.round(n.distance_m)}m`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });