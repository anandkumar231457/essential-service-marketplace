-- Populate the PostGIS geography column from lat/lng for all existing rows.
UPDATE "ProviderLocation"
  SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
  WHERE location IS NULL AND lat IS NOT NULL AND lng IS NOT NULL;