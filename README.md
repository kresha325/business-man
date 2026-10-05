# business-man

EDI is being built as a shared-data business platform with separate storefront, administration, and POS clients. The current implementation includes the initial multi-tenant model and authorization foundation, not the complete business system; see [the architecture and phase plan](./docs/architecture.md).

## Requirements

- Node.js 20.19 or newer and npm 10+
- PostgreSQL
- Rust/Cargo will be required when the POS is converted to a Tauri desktop application.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `backend/.env.example` to `backend/.env`; set `DATABASE_URL` and a private `JWT_ACCESS_SECRET` of at least 32 characters.
3. Create the PostgreSQL database named in `DATABASE_URL`.
4. Apply migrations with `npm run db:migrate`.
5. Set `EDI_ADMIN_EMAIL`, `EDI_ADMIN_PASSWORD` (at least 12 characters), and `EDI_ADMIN_NAME` in the environment, then run `npm run bootstrap:admin --workspace @edi/backend`. This idempotently provisions the initial `EDI Electro & Instalues` tenant (`EDI-ELECTRO`) and owner membership.

Example in PowerShell (use a unique password and do not commit it):

```powershell
$env:EDI_ADMIN_EMAIL = "admin@example.com"
$env:EDI_ADMIN_PASSWORD = "<at-least-12-characters>"
$env:EDI_ADMIN_NAME = "EDI Administrator"
npm run bootstrap:admin --workspace @edi/backend
```

Start the clients/API in separate terminals:

```text
npm run dev:ecommerce
npm run dev:admin
npm run dev:pos
npm run dev:backend
```

The Vite clients use ports 5173, 5174, and 5175; the API listens on port 3000 by default. The API health endpoints are `/healthz` and `/readyz`.

## Validation

- `npm run typecheck`
- `npm test`
- `npm run build`

Authenticated users can list their businesses with `GET /businesses`, create one with `POST /businesses`, and select a tenant for protected API operations using the `X-Business-Id` header. The header is only a selector: the API verifies an active membership and derives the tenant role, permissions, and enabled modules from PostgreSQL on every request.

The POS is currently a Vite client shell; it does not yet provide local SQLite, offline sales, synchronization, or hardware access. Product, inventory, sale, customer, report, and order domain APIs are not implemented yet. Fiscalization and payment confirmation are not simulated. The tenant migration is additive; the existing schema contains only users/authentication/audit data, so no product or sale data exists to backfill.

## Tenant API context

After authentication, send the chosen business ID in `X-Business-Id` on business-scoped API requests. Obtain selectable memberships from `GET /businesses`; create a business with `POST /businesses`. The server does not accept tenant identity from query or JSON body data. A selected business must also have an active membership and active subscription. The `GET /businesses/current` response contains only that verified membership's role, permissions, and plan-filtered enabled modules.

The migration adds tenant tables and an optional tenant reference on audit rows. Before applying it to a non-development database, take and verify a PostgreSQL backup, then apply `npm run db:migrate`. For example:

```powershell
$env:DATABASE_URL = "<your PostgreSQL connection string>"
pg_dump --format=custom --file=.\edi-before-tenant-migration.dump $env:DATABASE_URL
npm run db:migrate
```

Restore the backup to a separate database for verification with `pg_restore --dbname=<verification-database> .\edi-before-tenant-migration.dump`. The migration does not delete data. In this baseline, there are no product/sale records to backfill; if business-owned tables are added before this migration is deployed, stop and prepare an explicit per-table backfill before applying a `NOT NULL businessId` constraint.

## Production commands

From the repository root:

```powershell
npm ci
npm run db:generate
npm run typecheck
npm test
npm run build
```

The production build emits static assets into each app's `dist` directory and compiled API files into `backend/dist`. Deploy the backend with PostgreSQL and its environment variables; deploy `apps/ecommerce/dist` (and, as appropriate, the Admin/POS client builds) to a static host. Database and admin bootstrap must be performed separately as described above.
