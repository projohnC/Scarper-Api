# Render Deployment Analysis: `https://scarperapi-8lk0.onrender.com/`

Date: 2026-02-15

## Executive summary

The deployment is live and serving both the marketing UI and API routes. Core pages load successfully, but API protection appears **inconsistent**: some listing endpoints are publicly accessible while related search/detail endpoints require an API key. There are also endpoint-level reliability issues (e.g., upstream fetch failures and missing stream iframe responses).

## What was tested

Using Playwright HTTP navigation checks against:

- `/`
- `/docs`
- `/dashboard/docs`
- Provider endpoints under `/api/kmmovies`, `/api/animesalt`, and `/api/netmirror`
- Operational routes (`/robots.txt`, `/sitemap.xml`, `/api/health`, `/health`)

## Findings

### 1) Site availability and routing

- Root page (`/`) returns **200** and renders the app.
- `/dashboard/docs` returns **200**.
- `/docs` returns **404**, so docs are not exposed at that path.

### 2) API key enforcement is inconsistent

Observed behavior without sending an API key:

- `GET /api/kmmovies` → **200** (public data response)
- `GET /api/animesalt` → **200** (public data response)
- `GET /api/netmirror` → **403** (API key required)
- `GET /api/kmmovies/search?q=inception` → **403**
- `GET /api/animesalt/search?q=naruto` → **403**

This differs from the repository documentation claim that all endpoints require API keys.

### 3) Functional reliability issues on some endpoints

- `GET /api/kmmovies/details?url=...` → **500** (`fetch failed`)
- `GET /api/kmmovies/magiclinks?url=...` → **500** (`fetch failed`)
- `GET /api/animesalt/stream?url=...` → **404** (`No video iframe found`)

These suggest upstream scraping dependencies are brittle and/or target URLs are unavailable/blocked.

### 4) Operational hardening signals

- No visible health-check endpoint at `/api/health` or `/health` (both 404).
- `robots.txt` and `sitemap.xml` return 404.
- Response header checks did not show `strict-transport-security`, `x-frame-options`, or `content-security-policy` on tested responses.

## Priority recommendations

1. **Unify auth middleware behavior** so provider root/list/search/detail/stream endpoints have a consistent API-key policy.
2. **Add a lightweight health route** (e.g., `/api/health`) for Render health checks and external uptime tooling.
3. **Improve scraper error handling** for upstream failures:
   - return typed 4xx/5xx errors with actionable messages,
   - add retries/timeouts/circuit-breaker behavior where appropriate.
4. **Add security headers** via Next.js headers config (HSTS, CSP baseline, frame controls).
5. **Decide docs surface intentionally** (`/dashboard/docs` only vs public docs route), then align links/README.

## Evidence snapshot

A homepage screenshot was captured during the check:

![Render deployment homepage screenshot](browser:/tmp/codex_browser_invocations/d64153d6c41f2aef/artifacts/artifacts/render-home.png)
