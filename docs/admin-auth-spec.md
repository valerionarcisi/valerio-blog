# Admin auth (cookie session)

## Flow
1. Visit any `/admin/...` URL with `?token=<ADMIN_TOKEN>` once (GET/HEAD).
2. `src/middleware.ts` verifies the token (constant time), responds `302` to the same URL with `token` removed, and sets the `vb_admin` cookie.
3. From then on admin pages, `/api/admin/*`, `/api/stats*`, `/api/training` and the public comment form (author mode) authenticate via the cookie. `Authorization: Bearer <ADMIN_TOKEN>` and `?token=` keep working (scripts, the email link in `email.ts`).
4. `/admin/logout` clears the cookie and redirects to `/`. "Esci" link is at the bottom of `AdminNav`.

`locals.isAdmin` (cookie OR Bearer OR `?token=` on `/admin` paths) is set for every SSR request; admin pages return 401 when false. API routes call `requireAdmin(request)` (`src/lib/admin-auth.ts`), which parses the cookie itself.

## Cookie
`vb_admin=<expiryUnix>.<base64url HMAC-SHA256(ADMIN_TOKEN, "admin-session:"+expiry)>`; `Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000` (30 days); `Secure` when the request is https. Empty `ADMIN_TOKEN` fails closed. Code: `src/lib/admin-session.ts`.

## CSRF
Cookie-authenticated POST/PUT/PATCH/DELETE to `/api/admin/*` and `/api/comments` require `Origin` (or `Referer` when absent) equal to the request origin, else 403. Bearer requests are exempt.

## Public author mode
`Comments.astro` calls `GET /api/admin/me` (`Cache-Control: private, no-store`; 200 `{admin:true}` or 401) at runtime. Nothing about auth is in the statically cached HTML and nothing is stored in localStorage.

## Rotation
Change `ADMIN_TOKEN` in the environment: the HMAC key changes, so every existing session is invalidated. Re-visit `/admin?token=<new>`.
