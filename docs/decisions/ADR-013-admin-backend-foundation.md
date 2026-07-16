# ADR-013: Admin backend foundation — per-route RBAC guards, shared server utils, audit log

**Status:** Accepted (2026-07) — security-relevant

## Context
The admin panel needs a server foundation. The customer backend had grown by
copy-paste: the JWT block was inlined (unguarded) in ~25 routes, no route
checked `user.role`, nearly every route created its own `PrismaClient`, no
server route validated input with a schema, and several routes were
unauthenticated or leaked data (`/api/users` listed all users with no auth;
`settings/get-all` returned the password hash; ticket threads were readable
and writable by anyone with the id).

## Decision
1. **Shared server utils** (`.demo/server/utils/`, explicit imports):
   - `auth.ts` — `getAuthSession` / `requireAuth` (clean 401, never a 500 on a
     bad token) / `requireRole` / `requireAdmin`, plus `issueAuthToken` and
     `setAuthCookie`/`clearAuthCookie` as the single source of cookie truth.
     JWT secret comes from `runtimeConfig.jwtSecret` (`NUXT_JWT_SECRET`).
   - `validate.ts` — zod `validateBody`/`validateQuery` → 400 with
     `data.fieldErrors` (stable contract for the front-end).
   - `http.ts` — `paginationQuerySchema` + `paginated()` envelope
     (`{ items, total, page, pageSize, pageCount }`) for every list endpoint.
   - `audit.ts` — `recordAudit()` writes the `AuditLog` Prisma model
     (actor, action, target, before/after metadata, IP); best-effort.
2. **Per-route guards, no global Nitro middleware.** Middleware would run on
   every request including ~40 static template demo endpoints; an explicit
   guard at the top of each handler is self-documenting and can't regress
   unrelated routes.
3. **`requireAdmin` re-checks the role in the DB** (single indexed lookup)
   instead of trusting the 7-day JWT claim — a demoted admin loses access
   immediately.
4. **`/api/admin/**` namespace** with exemplar endpoints (users list/detail/
   patch, stats) demonstrating the full pattern: guard → validated input →
   shared prisma → audit on mutation.
5. **Dev-gating**: `create-admin` + all `seed-*` routes 404 unless
   `import.meta.dev`.

## Alternatives considered
- Global auth middleware with an allowlist: rejected (see 2).
- Trusting the JWT `role` claim for admin routes: rejected — revocation gap.
- NestJS-style service/repository layering: rejected — fights Nitro idiom;
  utils + thin handlers give the same reuse at this scale.
- New deps (nuxt-security, valibot, drizzle): rejected — zod/jwt/bcrypt/prisma
  already installed; the registry mirror makes new installs risky.

## Consequences
- Every new server route MUST use `requireAuth`/`requireRole`, the shared
  `prisma` singleton, and schema validation — never inline JWT or
  `new PrismaClient()`.
- Every admin mutation MUST `recordAudit()`.
- `auth_token` remains `httpOnly: false` until `app/middleware/auth.ts` stops
  reading the cookie client-side (tracked hardening follow-up); `sameSite:
  'lax'` + `secure` (prod) are already applied.
- Bugs fixed en route: expired token → 401 (was 500); `/api/orders/pay` IDOR +
  non-atomic balance check; ticket-thread IDOR (both directions); password
  hash leak in settings; wallet deposit not incrementing `walletBalance`;
  signup writing schema-invalid `role: 'USER'`/`name`/`status`.
