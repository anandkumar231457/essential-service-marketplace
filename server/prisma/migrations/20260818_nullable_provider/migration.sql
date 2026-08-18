-- Make Booking.providerId nullable to support open/broadcast jobs (Zomato-style)
ALTER TABLE "Booking" ALTER COLUMN "providerId" DROP NOT NULL;

-- Add description column for customer's problem description
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "description" TEXT;

-- Add address, lat, lng to User for persistent profile location
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lat" DOUBLE PRECISION;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lng" DOUBLE PRECISION;
