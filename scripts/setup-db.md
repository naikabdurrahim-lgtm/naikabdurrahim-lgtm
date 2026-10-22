# Local database setup (optional, but the best way to catch SQL mistakes)

The SQL suites run against a **throw-away** local PostgreSQL, never against Supabase.
Two ways to get one:

## Option A — Supabase CLI (recommended once you have Docker)

```bash
npm install -g supabase        # once
supabase init                  # creates supabase/config.toml
supabase start                 # local Postgres + Auth + Studio
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c 'select 1'
```

Then, from the project root:

```bash
PGHOST=127.0.0.1 PGPORT=54322 PGUSER=postgres PGPASSWORD=postgres npm run db:test
```

## Option B — a plain PostgreSQL 16 install

Windows installer: <https://www.postgresql.org/download/windows/>.
Remember the `postgres` password you set, then:

```bash
PGPASSWORD=yourpassword PGHOST=localhost PGUSER=postgres npm run db:test
```

## Applying migrations to your real Supabase project

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Or paste each file in `supabase/migrations/` into the Supabase SQL editor **in order**.
Never edit a migration that has already been applied — add a new one.
