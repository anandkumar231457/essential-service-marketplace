import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ── Config ───────────────────────────────────────────────────────────────
const PASSWORD = 'testpass123'; // all test users share this password

// Bengaluru neighborhoods with realistic lat/lng pairs.
interface Location {
  lat: number;
  lng: number;
  area: string;
}

const locations: Location[] = [
  { lat: 12.9352, lng: 77.6245, area: 'Koramangala' },
  { lat: 12.9784, lng: 77.6408, area: 'Indiranagar' },
  { lat: 12.9063, lng: 77.5857, area: 'JP Nagar' },
  { lat: 12.9698, lng: 77.7500, area: 'Whitefield' },
  { lat: 12.9591, lng: 77.6974, area: 'Marathahalli' },
  { lat: 12.9250, lng: 77.5938, area: 'Jayanagar' },
  { lat: 12.9780, lng: 77.6076, area: 'MG Road' },
  { lat: 12.8399, lng: 77.6770, area: 'Electronic City' },
  { lat: 12.9257, lng: 77.6764, area: 'Bellandur' },
  { lat: 13.0358, lng: 77.5970, area: 'Hebbal' },
];

interface ProviderData {
  name: string;
  phone: string;
  email: string;
  category: string;
  skills: string[];
  hourlyRate: number;
  locationIndex: number;
}

const providers: ProviderData[] = [
  { name: 'Ravi Kumar',   phone: '9880010001', email: 'ravi.kumar@example.com',  category: 'Electrician',      skills: ['Wiring', 'Lighting', 'Switchboard repair'],          hourlyRate: 350,  locationIndex: 0 },
  { name: 'Suresh Patel', phone: '9880010002', email: 'suresh.patel@example.com',category: 'Plumber',          skills: ['Pipe repair', 'Tap installation', 'Drain cleaning'], hourlyRate: 400,  locationIndex: 1 },
  { name: 'Amit Sharma',  phone: '9880010003', email: 'amit.sharma@example.com', category: 'Mechanic',         skills: ['Engine repair', 'Oil change', 'Tire replacement'],   hourlyRate: 500,  locationIndex: 2 },
  { name: 'Priya Reddy',  phone: '9880010004', email: 'priya.reddy@example.com', category: 'Cleaner',          skills: ['Deep cleaning', 'Kitchen cleaning', 'Bathroom'],      hourlyRate: 250,  locationIndex: 3 },
  { name: 'Vikram Singh', phone: '9880010005', email: 'vikram.singh@example.com',category: 'Carpenter',        skills: ['Furniture assembly', 'Cabinet repair', 'Shelving'],   hourlyRate: 450,  locationIndex: 4 },
  { name: 'Deepa Nair',   phone: '9880010006', email: 'deepa.nair@example.com',  category: 'AC Technician',    skills: ['AC installation', 'Gas refill', 'Filter cleaning'],    hourlyRate: 600,  locationIndex: 5 },
  { name: 'Manoj Gupta',  phone: '9880010007', email: 'manoj.gupta@example.com', category: 'Appliance Repair', skills: ['Washing machine', 'Refrigerator', 'Microwave'],         hourlyRate: 400,  locationIndex: 6 },
  { name: 'Anita Desai',  phone: '9880010008', email: 'anita.desai@example.com', category: 'Electrician',      skills: ['Fan repair', 'Inverter wiring', 'Meter box'],         hourlyRate: 300,  locationIndex: 7 },
  { name: 'Rajesh Iyer',  phone: '9880010009', email: 'rajesh.iyer@example.com', category: 'Plumber',          skills: ['Water heater', 'Toilet repair', 'Pipe fitting'],      hourlyRate: 380,  locationIndex: 8 },
  { name: 'Kavita Joshi', phone: '9880010010', email: 'kavita.joshi@example.com',category: 'Cleaner',          skills: ['Office cleaning', 'Carpet cleaning', 'Disinfection'], hourlyRate: 300,  locationIndex: 9 },
];

const categories = [
  'Electrician',
  'Plumber',
  'Mechanic',
  'Cleaner',
  'Carpenter',
  'AC Technician',
  'Appliance Repair',
  'Maintenance Worker',
];

// ── Main seed ────────────────────────────────────────────────────────────
async function main() {
  console.log('Seeding database…');

  // 1. Create service categories ──────────────────────────────────────────
  const iconMap: Record<string, string> = {
    'Electrician':       'zap',
    'Plumber':           'droplet',
    'Mechanic':          'tool',
    'Cleaner':           'sparkles',
    'Carpenter':         'hammer',
    'AC Technician':     'wind',
    'Appliance Repair':  'settings',
    'Maintenance Worker':'wrench',
  };

  const createdCategories = new Map<string, number>();
  for (const name of categories) {
    const cat = await prisma.serviceCategory.upsert({
      where: { name },
      update: {},
      create: { name, icon: iconMap[name] ?? 'help-circle' },
    });
    createdCategories.set(name, cat.id);
  }
  console.log(`  ✓ ${categories.length} service categories created`);

  // 2. Create test customers ──────────────────────────────────────────────
  const customerData = [
    { name: 'Test Customer A', phone: '9999900001', email: 'customer.a@test.com' },
    { name: 'Test Customer B', phone: '9999900002', email: 'customer.b@test.com' },
  ];

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  for (const c of customerData) {
    await prisma.user.upsert({
      where: { email: c.email },
      update: {},
      create: {
        name: c.name,
        phone: c.phone,
        email: c.email,
        passwordHash,
        role: 'CUSTOMER',
      },
    });
  }
  console.log(`  ✓ ${customerData.length} test customers created`);

  // 3. Create providers + profiles + locations ────────────────────────────
  for (const p of providers) {
    const loc = locations[p.locationIndex];
    const categoryId = createdCategories.get(p.category);
    if (!categoryId) throw new Error(`Unknown category: ${p.category}`);

    const user = await prisma.user.upsert({
      where: { email: p.email },
      update: {},
      create: {
        name: p.name,
        phone: p.phone,
        email: p.email,
        passwordHash,
        role: 'PROVIDER',
      },
    });

    await prisma.providerProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        category: p.category,
        skills: p.skills,
        hourlyRate: p.hourlyRate,
        verifiedStatus: 'VERIFIED',
        avgRating: +(Math.random() * 2 + 3).toFixed(1), // 3.0–5.0
      },
    });

    await prisma.providerLocation.upsert({
      where: { providerId: user.id },
      update: {},
      create: {
        providerId: user.id,
        lat: loc.lat,
        lng: loc.lng,
        isOnline: Math.random() > 0.3, // ~70% online
      },
    });
  }
  console.log(`  ✓ ${providers.length} providers created (profiles + locations)`);

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });