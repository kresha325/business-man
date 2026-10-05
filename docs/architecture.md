# EDI architecture and implementation plan

## Repository assessment

The workspace started empty. Phase 1 added runnable React/Vite shells for the storefront, admin, and POS; an Express API; shared packages; PostgreSQL/Prisma authentication tables; and token-based authentication. It did **not** implement products, cart, sales, inventory, offline POS, synchronization, or hardware. There is no existing Green Land code to reuse. Rust/Cargo is not installed, so a Tauri desktop binary cannot be built or verified in this environment.

The multi-tenant work adds tenant foundation to that Phase 1 baseline; it does not retroactively create the missing business workflows.

## Target architecture

- `apps/ecommerce`: React + Vite storefront; static-host friendly.
- `apps/admin`: React + Vite business administration client.
- `apps/pos`: React + Vite POS client shell. Tauri/SQLite integration is a later phase and requires the Rust toolchain.
- `backend`: Express + TypeScript API; PostgreSQL is the authoritative business database and Prisma is its ORM. Authenticated tenant endpoints resolve `X-Business-Id` through an active `BusinessMembership`; the header selects context, but never grants access.
- `packages/shared-types`: transport/domain types shared by clients and API.
- `packages/ui`: small shared EDI-branded React shell.
- `packages/validation`: shared Zod runtime schemas for validated API input.

All clients will use the same API and central business model. The POS will additionally use a local SQLite operational store and transactional outbox in the offline phase; it will not become a separate source of stock truth. Hardware and fiscal integrations will be isolated behind adapters and must not claim success without confirmation from real devices/services.

## Phase plan

1. **Architecture (complete):** workspace foundation, shared packages, PostgreSQL schema foundation, API, password-based authentication, refresh-token rotation, and initial API tests.
2. **Multi-tenant foundation (API/data complete):** tenant schema, per-business roles/permissions, locations, module flags, subscription plan scaffolding, EDI tenant bootstrap, onboarding/list/context API and tenant authorization. Visual business selection in the clients remains for a later client-integration phase.
3. **Products:** categories, brands, product/catalog APIs, barcode lookup, price rules. These records must be added with business-scoped unique constraints and tenant-filtered repositories/routes.
4. **Inventory and purchasing:** warehouse/location stock, auditable movements, counts, suppliers and purchases.
5. **POS core:** sales, server-calculated totals, payments, register sessions, barcode input.
6. **Offline POS:** Tauri/SQLite, durable local outbox, idempotent synchronization, conflict resolution and offline auth policy.
7. **Hardware:** scanner/printer/drawer adapters and fiscal integration only after EDI's actual hardware/provider is identified.
8. **Business administration:** customers, installers, staff/permissions, expenses, audit, dashboard and reports.
9. **E-commerce:** catalog, favorites, cart, checkout and online orders.
10. **Platform administration and modular business-specific features:** platform roles, usage/plan enforcement, restaurant/electrical/services extensions.
11. **Integration and hardening:** end-to-end flows, deployment, backups, responsive behavior, operational monitoring and failure-mode tests.

## Multi-tenant boundaries implemented

- `Business` owns the business identity, slug, type, contact/location basics, currency, VAT configuration and branding/settings JSON.
- `BusinessMembership` connects a user to a tenant. `BusinessRole` and `BusinessRolePermission` are tenant-scoped, so role assignments do not cross businesses.
- `BusinessLocation` and `BusinessFeature` use tenant-scoped unique keys.
- Business onboarding creates the tenant, initial location, owner role/membership, enabled-module rows, and a subscription to the Free plan in one database transaction.
- The bootstrap command provisions the first tenant as `EDI-ELECTRO` (`edi-electro`) and links the configured administrator.
- `GET /businesses` lists only active memberships; `GET /businesses/current` requires `X-Business-Id` and verifies membership each request. Tenant permission and feature middleware use the resolved membership, not body/query tenant IDs.
- `AuditLog.businessId` is optional for platform-level events and tenant-linked for business events.

The current schema has no product/sale/customer/inventory tables. Thus no legacy business data is backfilled by the additive tenant migration. When those domain models are introduced, their migration must make `businessId` mandatory after a reviewed backup/backfill and use composite tenant keys for tenant-owned references and scoped unique values. Platform super-admin routes, location/device authorization, tenant-aware SQLite/sync, and a visual business switcher are not implemented yet.

No business operation is represented as complete by the Phase 1 shell. Each later phase must add validated API behavior, persistence, tests, and usable client workflows before being considered done.
