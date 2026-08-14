-- Enable PostGIS extension (must be done by a superuser or on a database where the extension is allowed)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geography(Point) column to ProviderLocation for spatial queries.
-- Prisma cannot natively model PostGIS geography types, so this is done via raw SQL.
-- The `location` column is marked as `Unsupported("geography(Point)")?` in schema.prisma.
ALTER TABLE "ProviderLocation"
  ADD COLUMN IF NOT EXISTS location geography(Point);

-- Update existing rows with a Point derived from lat/lng.
UPDATE "ProviderLocation"
  SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
  WHERE location IS NULL AND lat IS NOT NULL AND lng IS NOT NULL;

-- Create a GiST spatial index for fast ST_DWithin / ST_Distance queries.
CREATE INDEX IF NOT EXISTS idx_provider_location_gist
  ON "ProviderLocation"
  USING GIST (location);