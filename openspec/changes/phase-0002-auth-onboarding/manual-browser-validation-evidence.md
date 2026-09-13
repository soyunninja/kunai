# Phase 0002 manual browser validation evidence — Task 15.1

Date: 2026-09-13

## Environment

| Field | Value |
| --- | --- |
| Browser | Google Chrome / HeadlessChrome |
| Browser version | Chrome CLI reported `Google Chrome 152.0.7977.75`; user agent reported `HeadlessChrome/152.0.0.0` |
| Operating system | Linux x86_64 (`Linux ubuntu 7.0.0-30-generic`) |
| Mode | Nuxt dev server with disposable PocketBase 0.40.3 |
| Protocol | HTTP |
| Reverse proxy | None detected/used |
| URL | Disposable local URL, e.g. `http://127.0.0.1:35520` |
| Validation method | Chrome DevTools Protocol against a real Chrome profile, real Nuxt server, and real disposable PocketBase users |

No real HTTPS or reverse-proxy environment was available during this validation. HTTPS/proxy validation is therefore not marked PASS.

## Matrix

| ID | Case | Environment | Expected | Actual | Status | Observations / blocker |
| --- | --- | --- | --- | --- | --- | --- |
| 15.1-LOGIN-A | Real login for user A | Chrome + dev HTTP + disposable PB | User A login succeeds and sets an HttpOnly app session cookie. | `POST /api/auth/login` returned 200 for `phase-15-a@example.test`; cookie `kunai_session` was present via DevTools cookie inspection and absent from `document.cookie`. | PASS | No token value recorded. |
| 15.1-COOKIE-DEV | Development HTTP cookie attributes | Chrome + dev HTTP | Cookie is HttpOnly, SameSite=Lax, host-scoped for local host, and not Secure in explicit dev HTTP mode. | DevTools cookie inspection reported `httpOnly: true`, `sameSite: Lax`, `secure: false`, domain `127.0.0.1`. | PASS | Host-only semantics are represented by the absence of a broad parent domain; local IP host is the cookie domain shown by Chrome. |
| 15.1-SESSION | Persistent session endpoint | Chrome + dev HTTP | A valid cookie keeps `/api/auth/session` authenticated. | Browser fetch to `/api/auth/session` returned 200 after login. | PASS | No bearer token value recorded. |
| 15.1-ONBOARDING-UI | Onboarding UI baseline | Chrome + dev HTTP | Onboarding renders 10 avatars, editable display name/timezone, optional location controls, and submit. | 10 avatar images/options were present; display name and timezone fields accepted input; skip/clear controls were present; submit completed onboarding. | PASS | Weather provider was not used. |
| 15.1-GEO-UNAVAILABLE | Geolocation unavailable | Chrome + dev HTTP with CDP simulation | UI reports unavailable geolocation and allows continuing without location. | Simulated `navigator.geolocation.getCurrentPosition` error code 2 produced the unavailable-location path. | PASS | Secure-context/provider weather behavior was not required. |
| 15.1-GEO-DENIED | Geolocation denied | Chrome + dev HTTP with CDP simulation | UI reports denied geolocation and allows continuing without location. | CDP harness did not reliably force the denied branch before the Home blocker was reached. | PENDING | Pending a stable interactive-browser/manual permission-denial run. |
| 15.1-KEYBOARD | Keyboard focus basics | Chrome + dev HTTP | Inputs can receive keyboard focus and visible focus styles are available. | Programmatic focus reached `#display-name`; CSS contains `:focus-visible` styling for inputs, buttons, and avatar options. | PASS | Full human keyboard walk remains limited by headless execution, but the available browser run verified focusability. |
| 15.1-TABLET-TOUCH | Tablet/touch basics | Chrome emulated 820x1180 + touch | UI remains usable with tablet-sized viewport and touch enabled. | Home/onboarding surfaces rendered under tablet metrics; touch emulation enabled; touch-target controls have 2.75rem minimum height. | PASS | Visual inspection was via headless text/DOM evidence, not screenshot review. |
| 15.1-REDUCED-MOTION | Reduced motion | Chrome emulated media | App respects reduced motion where relevant. | `matchMedia('(prefers-reduced-motion: reduce)')` returned true; onboarding CSS has reduced-motion media rule disabling scroll/transition/animation duration. | PASS | No complex animations exist in this phase. |
| 15.1-TOKEN-EXPOSURE | Token/secret exposure | Chrome + SSR fetch | Token is absent from `document.cookie`, localStorage, sessionStorage, SSR HTML, Nuxt payload, visible markup, and public runtime config. | Sanitized sentinel checks were false for document cookie, storage, SSR HTML/payload, visible text, and public runtime config/PocketBase URL exposure. | PASS | Real token value was not copied into evidence. |
| 15.1-OUTAGE-COOKIE | Temporary PocketBase outage | Chrome + dev HTTP | Outage returns unavailable but does not clear a valid cookie. | With PocketBase stopped, `/api/auth/session` returned 503 and DevTools still showed the session cookie. | PASS | Confirms outage does not force logout. |
| 15.1-INVALID-COOKIE | Invalid/expired session cleanup | Chrome + dev HTTP | Invalid session clears only the app session cookie. | CDP invalid-cookie injection was inconclusive in this manual run. | PENDING | Automated 14.2 coverage verifies the route behavior; manual browser corruption of an HttpOnly cookie needs a stable browser procedure. |
| 15.1-ONBOARDING-COMPLETE | Onboarding completion for user A | Chrome + dev HTTP + disposable PB | Completing onboarding persists user state and seeds Home. | Onboarding submit returned the completed user flow and navigated to Home. | PASS | Subsequent Home confirmation failed; see blocker below. |
| 15.1-HOME-PROTECTED | Protected Home after onboarding | Chrome + dev HTTP + disposable PB | Completed user reaches Home and `/api/home` confirms initialized Home. | Initial run failed: Home displayed the authenticated user but `/api/home` returned 503 `home_unavailable`. Diagnosis found PocketBase 0.40.3 rejected the route filter `owner = {:owner} && seedKey = {:seedKey}` with 400. After the authorized fix, revalidation returned `/api/home` 200 with `{ initialized: true, dashboard: { name: "Home" } }`. | PASS | Blocker fixed by replacing placeholders with an escaped literal owner filter. No tokens recorded. |
| 15.1-SSR-VALID | SSR refresh with valid session | Chrome + dev HTTP + disposable PB | Refresh with valid completed session keeps protected Home without stale failure state. | Initial run was blocked by `/api/home` 503. After the authorized fix, the real flow `login -> onboarding -> GET /api/home` confirmed initialized Home with 200; remaining full SSR browser refresh matrix still awaits 15.1 continuation. | PENDING | Home API blocker is fixed; full stale/refresh browser matrix remains pending until 15.1 resumes. |
| 15.1-LOGOUT | Logout from Home | Chrome + dev HTTP | Logout redirects to login and clears private content. | Logout redirected to `/login`; refresh after logout showed Login only. | PASS | Back/forward stale behavior not fully completed because Home blocker interrupted the matrix. |
| 15.1-TWO-USERS | Two administratively provisioned users | Chrome + dev HTTP + disposable PB | User B does not see user A data. | User B login/onboarding used a separate PB user and Home showed User B identity, not User A. | PASS | Home confirmation still failed for both users due the blocker. Two simultaneous browser profiles were not completed. |
| 15.1-STALE-TABS | Stale tab behavior | Chrome + dev HTTP | Previously opened tabs do not show private content after logout/session invalidation. | Not completed after blocker was found. | PENDING | Must be rerun after the Home blocker is resolved. |
| 15.1-HTTPS-PROXY | HTTPS/reverse proxy | Current environment | If real HTTPS/proxy exists, validate Secure cookie, forwarded proto, host/origin, same-origin, login, session, onboarding, logout. | No real HTTPS/reverse-proxy environment was available. | PENDING | Pending Hardening/Release or owner-provided HTTPS/proxy environment. Do not weaken cookie/security config for local validation. |

## Result

Task 15.1 is **not complete** yet. The available browser matrix originally found a real blocker: protected Home confirmation failed after onboarding in the disposable browser/PocketBase environment because PocketBase 0.40.3 rejected the placeholder filter used by `/api/home`. The authorized blocker fix was applied and the real flow now returns `/api/home` 200 with `initialized: true`, but the remaining pending 15.1 cases have not been completed.

No tokens, passwords, or secrets are recorded in this evidence.
Task 16.1 was not started.
