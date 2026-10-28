# WriteSpace

A browser-local blogging demo built with React 18, JavaScript JSX, Vite, React Router DOM v6 and Tailwind CSS. Discover the product, register or log in, read and write posts, and explore role-based admin workflows.

## Important: demo only
Passwords are stored in **plain text** and access checks run in your browser. Do not use real passwords or sensitive data. The built-in demo account is username `admin`, password `admin`.

There is no backend, API, database, shared account service, synchronization or recovery. Records live only in the current browser profile and origin. Clearing browser data removes them. Role and ownership checks prevent ordinary UI misuse, not local tampering. Registration validates an email input but does not retain it.

## Run locally
Use Node 20 and npm. In the repository root:

```sh
cd frontend
npm ci --no-bin-links
cp .env.example .env
npm run dev
```

The `.env.example` documents development/preview host and port settings. These configure Vite tooling, not runtime secrets. The static application itself requires no environment variables or remote service.

## Routes and workflows
- `/`: public introduction and up to three newest local previews.
- `/login`, `/register`: demo account entry and validation.
- `/blogs`, `/blog/:id`: authenticated list and plain-text reader.
- `/write`, `/edit/:id`: creation and ownership-preserving edits.
- `/admin`, `/users`: admin content and local account oversight.

Users manage their own posts; admins can manage any post. Deletion requires confirmation. The built-in admin and current account cannot be deleted. Account deletion leaves posts unchanged. Missing records show a not-found view; invalid storage reads degrade to empty/guest views without repairing or overwriting bytes. Failed writes show feedback without announcing success.

Storage keys: `writespace_posts`, `writespace_users`, `writespace_session`. IDs use `crypto.randomUUID()`, requiring localhost or HTTPS in browsers.

## Verification
From `frontend/`:

```sh
npm test
npm run test:coverage
NODE_ENV=production npm run build
node node_modules/@playwright/test/cli.js install chromium
npm run test:e2e
```

Playwright uses one worker and its configured Vite webServer. Set `E2E_BASE_URL` and `E2E_PORT` explicitly to test an existing static host; do not run with `CI` set when reusing a preview server. To test the production bundle:

```sh
NODE_ENV=production npm run build
npm run preview -- --host 0.0.0.0 --port 4173
# In another terminal:
E2E_BASE_URL=http://127.0.0.1:4173 E2E_PORT=4173 npm run test:e2e
```

Node 24 in the development sandbox hung during Playwright 1.51 test discovery; Node 20.19.5 ran all journeys successfully. No assertions were weakened to resolve this. Browser tests assert real localStorage outcomes and fail on console/page errors. Screenshots are generated in `frontend/test-results`; `frontend/preflight.mjs` captures accessibility-tree, computed-style, HTML and screenshot evidence against `E2E_BASE_URL` (default preview port 4173).

Verified final results: **397 unit/component tests**, **28 browser journeys**, production build and Docker/nginx serving all passed. An earlier coverage run measured 100% lines/statements/functions and 99.77% branches; the final source/dependency regression run passed independently. API and backend integration tests are not applicable; cross-feature local workflows are covered in browser journeys.

## Static container

```sh
docker build -t writespace frontend
docker run --rm -p 8080:80 writespace
```

The two-stage Dockerfile builds with Node and serves only `dist/` from nginx on port 80, bound on all interfaces. Root `/` returns 200; nginx falls back to `index.html` for client routes. There is no proxy or persistent container volume. Direct requests to all nine named routes were verified inside the final image. `vercel.json` retains the alternative nested-frontend rewrite configuration, but the pipeline deployment target is AWS ECS/ALB/CloudFront. Actual AWS release and edge-host checks are downstream DevOps work, not verified deployment claims here.

## Dependency audit warning
Router was patched to **6.30.6**, removing the high-severity production findings. `npm audit --omit=dev` still reports two moderate dependency entries (React Router and its DOM wrapper), with fixes requiring v7.18.5, outside the specified v6 architecture. The reported surfaces include untrusted backslash redirects and SSR error hydration; this application uses generated/internal paths and no SSR, but this is not a claim that the dependency is vulnerability-free. Full build/test dependency installation reports additional development-tool advisories (four high and three critical in the final container build). Those tools do not ship in the nginx runtime image. Keep development servers local and review compatible toolchain upgrades before production use. This remains an intentionally insecure demo, not production authentication.

## Repository structure
Application, shared storage/policy helpers, components, pages and colocated tests live under `frontend/src/`. Feature browser specs live under `frontend/e2e/`. The final code graph lives at `graphify-out/graph.json`. Pipeline plan, worklist, test report and publication metadata are workspace artifacts excluded from git; downstream source identity is published separately.
