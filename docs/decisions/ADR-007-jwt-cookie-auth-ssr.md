# ADR-007: JWT cookie auth with SSR cookie forwarding

**Status:** Accepted (2026-06)

## Context
Auth was inherited half-built: JWT in an `auth_token` cookie, an `auth` route
middleware, and duplicated `useUser` composables/plugins. Hard-refreshing any
protected page bounced users to login.

## Decision
- Single `useUser()` at `.demo/app/composables/useUser.ts`: `user` state,
  `fetchUser()`, `setUser()`, `logout()`.
- `fetchUser()` calls `/api/auth/me` through **`useRequestFetch()`** so SSR forwards
  the incoming request's cookies. Plain `$fetch` drops the cookie server-side and
  re-introduces the logout-on-reload bug — never revert this.
- One boot plugin (`plugins/auth-load.ts`); the duplicate `plugins/auth.ts` and the
  shadow `.demo/composables/useUser.ts` (outside srcDir) were deleted.
- Middleware `auth.ts`: no cookie → `/auth/login-1`; cookie but no user after fetch →
  `/auth/login-1`.

## Alternatives considered
- Session table / server-side sessions: rejected for now — out of scope of a UI
  overhaul; JWT flow already wired end-to-end.

## Consequences
- Dev conveniences to harden before production: cookie is httpOnly:false, JWT secret
  falls back to `'secret'`, `secure:false`.
- Works together with ADR-008; both were required to fix reload-logout.
