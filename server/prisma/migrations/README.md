# Prisma Migrations

## PostGIS Setup

After running `prisma migrate dev`, you need to apply one more SQL migration
manually to enable PostGIS and create the geography column on ProviderLocation:

1. Run the initial migration:
   ```
   cd server
   npx prisma migrate dev --name init
   ```

2. Then run the PostGIS bootstrap SQL:
   ```
   npx prisma db execute --file prisma/migrations/postgis_bootstrap.sql
   ```

   This will:
   - `CREATE EXTENSION IF NOT EXISTS postgis`
   - Add a `geography(Point)` column to `ProviderLocation`
   - Create a GiST spatial index on it

3. Generate the Prisma Client:
   ```
   npx prisma generate
   ```

4. Seed the database:
   ```
   npm run db:seed