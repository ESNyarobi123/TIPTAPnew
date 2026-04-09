# Multi-tenant strategy

## Row-level tenancy

- Every tenant-owned row carries **`tenantId`** (Prisma models under `Tenant`).
- Branch-scoped operational data also carries **`branchId`** where it belongs to a single branch (menus scoped to branch, tables, stations, etc.).

## Query rules (implementation target)

1. **No tenant-wide queries** from tenant-scoped controllers without an explicit `tenantId` filter from a trusted source (JWT claim, resolved QR context, or super-admin impersonation with audit).
2. **Branch managers** may only access their `branchId` subset within the tenant.
3. **Super admin** may list across tenants for platform operations; all such actions should write **audit logs**.

## RBAC model

`UserRoleAssignment` links `User` → `RoleCode` with optional `tenantId` / `branchId`:

- **SUPER_ADMIN** — platform; `tenantId` / `branchId` typically null.
- **TENANT_OWNER** — full tenant; `tenantId` set.
- **BRANCH_MANAGER** — `tenantId` + `branchId`.
- **CASHIER**, **SERVICE_STAFF**, **SUPPORT_AGENT** — scoped per tenant/branch as you assign.

Guards should validate that the route’s `:tenantId` / `:branchId` matches the principal’s grants.

## Category enablement

`TenantCategory` rows enable **FOOD_DINING** and/or **BEAUTY_GROOMING** per tenant with optional JSON **settings** (templates, feature flags). Category modules must check enabled categories before mutating vertical data.

## Data leakage prevention

- Never return **internal** staff/provider fields (`privateNotes`, `internalNotes`, salary references) on public or customer-facing DTOs.
- **ProviderProfile** splits public summary vs internal notes at the schema level.

## `TenantAccessService` (Phase 2)

Central place for **assertions** (not only ad-hoc `where: { tenantId }`):

- `assertReadableTenant` / `assertWritableTenant` — SUPER_ADMIN bypass; TENANT_OWNER for that tenant; BRANCH_MANAGER if they manage a branch in that tenant.
- `assertReadableBranch` / `assertWritableBranch` — tenant owner for branch’s tenant, or manager of that branch, or super admin.
- `assertBranchBelongsToTenant` — validates FK consistency before writes.
- `assertRoleAssignmentShape` — rejects illegal `UserRoleAssignment` shapes (e.g. `TENANT_OWNER` with `branchId`).

Controllers keep **thin**; services call these methods before Prisma mutations.

## QR resolution

QR resolution produces a **server-side context** (tenant, branch, type, optional table/station/staff). That context seeds **conversation sessions**; customers do not pick `tenantId` from the client.

**Trust model**: only an **opaque secret** (hashed server-side as `QrCode.tokenHash`) may resolve or start a session. **Never** treat a printable menu code or `publicRef` alone as proof of identity.

## Customer conversation access

- **Public** routes: `POST /conversations/start` (QR secret), `POST /conversations/message` (**opaque `sessionToken` in body** — no internal session id).
- **Customer read/reset**: `GET /conversations/session` and `POST /conversations/session/reset` use **`X-Session-Token` only** (no cuid in the path).
- **Staff**: `GET/POST /conversations/internal/:sessionId` with **JWT** and tenant read access (`TenantAccessService`).
- Sessions **expire** (`expiresAt`); expired customer calls return **410 Gone**.
