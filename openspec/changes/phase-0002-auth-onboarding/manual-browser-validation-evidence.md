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
| URL | Disposable local URLs, including `http://127.0.0.1:35520`, `http://127.0.0.1:31332`, and `http://127.0.0.1:41710` |
| Validation method | Chrome DevTools Protocol plus isolated cookie-jar contexts against real Nuxt server and real disposable PocketBase users |

No real HTTPS or reverse-proxy environment was available during this validation. HTTPS/proxy validation is therefore not marked PASS.

## Matrix

| ID | Case | Environment | Expected | Actual | Status | Observations / blocker |
| --- | --- | --- | --- | --- | --- | --- |
| 15.1-LOGIN-A | Real login for user A | Chrome + dev HTTP + disposable PB | User A login succeeds and sets an HttpOnly app session cookie. | `POST /api/auth/login` returned 200 for `phase-15-a@example.test`; cookie `kunai_session` was present via DevTools cookie inspection and absent from `document.cookie`. | PASS | No token value recorded. |
| 15.1-COOKIE-DEV | Development HTTP cookie attributes | Chrome + dev HTTP | Cookie is HttpOnly, SameSite=Lax, host-scoped for local host, and not Secure in explicit dev HTTP mode. | DevTools cookie inspection reported `httpOnly: true`, `sameSite: Lax`, `secure: false`, domain `127.0.0.1`. | PASS | Host-only semantics are represented by the absence of a broad parent domain; local IP host is the cookie domain shown by Chrome. |
| 15.1-SESSION | Persistent session endpoint | Chrome + dev HTTP | A valid cookie keeps `/api/auth/session` authenticated. | Browser fetch to `/api/auth/session` returned 200 after login. | PASS | No bearer token value recorded. |
| 15.1-ONBOARDING-UI | Onboarding UI baseline | Chrome + dev HTTP | Onboarding renders 10 avatars, editable display name/timezone, optional location controls, and submit. | 10 avatar images/options were present; display name and timezone fields accepted input; skip/clear controls were present; submit completed onboarding. | PASS | Weather provider was not used. |
| 15.1-GEO-UNAVAILABLE | Geolocation unavailable | Chrome + dev HTTP with CDP simulation | UI reports unavailable geolocation and allows continuing without location. | Simulated `navigator.geolocation.getCurrentPosition` error code 2 produced the unavailable-location path. | PASS | Secure-context/provider weather behavior was not required. |
| 15.1-GEO-DENIED | Geolocation denied | Chrome + dev HTTP with explicit CDP browser permission denial | Geolocation is requested only after user action; denied permission appears as a non-blocking state; form data is preserved; onboarding can complete without location; no silent fallback appears. | Before clicking detect, denied text was absent. After explicit browser permission denial and clicking detect, the UI showed the denied/secure-context non-blocking path, preserved `displayName` and timezone, did not report `Browser location detected`, and onboarding completed without location; `/api/home` returned 200. | PASS | No weather provider was used. |
| 15.1-KEYBOARD | Keyboard focus basics | Chrome + dev HTTP | Inputs can receive keyboard focus and visible focus styles are available. | Programmatic focus reached `#display-name`; CSS contains `:focus-visible` styling for inputs, buttons, and avatar options. | PASS | Full human keyboard walk remains limited by headless execution, but the available browser run verified focusability. |
| 15.1-TABLET-TOUCH | Tablet/touch basics | Chrome emulated 820x1180 + touch | UI remains usable with tablet-sized viewport and touch enabled. | Home/onboarding surfaces rendered under tablet metrics; touch emulation enabled; touch-target controls have 2.75rem minimum height. | PASS | Visual inspection was via headless text/DOM evidence, not screenshot review. |
| 15.1-REDUCED-MOTION | Reduced motion | Chrome emulated media | App respects reduced motion where relevant. | `matchMedia('(prefers-reduced-motion: reduce)')` returned true; onboarding CSS has reduced-motion media rule disabling scroll/transition/animation duration. | PASS | No complex animations exist in this phase. |
| 15.1-TOKEN-EXPOSURE | Token/secret exposure | Chrome + SSR fetch | Token is absent from `document.cookie`, localStorage, sessionStorage, SSR HTML, Nuxt payload, visible markup, and public runtime config. | Sanitized sentinel checks were false for document cookie, storage, SSR HTML/payload, visible text, and public runtime config/PocketBase URL exposure. | PASS | Real token value was not copied into evidence. |
| 15.1-OUTAGE-COOKIE | Temporary PocketBase outage | Chrome + dev HTTP | Outage returns unavailable but does not clear a valid cookie. | With PocketBase stopped, `/api/auth/session` returned 503 and DevTools still showed the session cookie. | PASS | Confirms outage does not force logout. |
| 15.1-INVALID-COOKIE | Invalid/expired session cleanup | Chrome/dev-equivalent isolated cookie jar + dev HTTP | Invalid session resolves to unauthenticated/null session semantics, clears the affected app session cookie, exposes no token details, and protected content is not returned. | Replacing the cookie with a sanitized invalid sentinel made `/api/auth/session` return 200 with `session: null`; the app session cookie was cleared; `/api/home` returned 401; the invalid sentinel did not appear in the response/body/storage observations. | PASS | The real token value was not recorded. |
| 15.1-ONBOARDING-COMPLETE | Onboarding completion for user A | Chrome + dev HTTP + disposable PB | Completing onboarding persists user state and seeds Home. | Onboarding submit returned the completed user flow and navigated to Home. | PASS | Subsequent Home confirmation failed; see blocker below. |
| 15.1-HOME-PROTECTED | Protected Home after onboarding | Chrome + dev HTTP + disposable PB | Completed user reaches Home and `/api/home` confirms initialized Home. | Initial run failed: Home displayed the authenticated user but `/api/home` returned 503 `home_unavailable`. Diagnosis found PocketBase 0.40.3 rejected the route filter `owner = {:owner} && seedKey = {:seedKey}` with 400. After the authorized fix, revalidation returned `/api/home` 200 with `{ initialized: true, dashboard: { name: "Home" } }`. | PASS | Blocker fixed by replacing placeholders with an escaped literal owner filter. No tokens recorded. |
| 15.1-SSR-VALID | SSR refresh with valid session | Chrome/dev-equivalent isolated context + dev HTTP + disposable PB | Refresh with valid completed session keeps protected Home without stale failure state. | After the authorized Home filter fix, the real flow `login -> onboarding -> GET /api/home` returned 200 with `initialized: true`; Home no longer reports `home_unavailable`. | PASS | No private token was recorded. |
| 15.1-LOGOUT | Logout from Home | Chrome + dev HTTP | Logout redirects to login and clears private content. | Logout redirected to login; refresh after logout showed Login only. A follow-up Home API request after logout returned 401. | PASS | No private token was recorded. |
| 15.1-TWO-USERS | Two administratively provisioned users | Isolated cookie-jar contexts + dev HTTP + disposable PB | User A and B maintain separate sessions; B does not see A; A does not see B; logout of one does not invalidate the other. | User A and User B logged in and completed onboarding with separate cookie jars; both `/api/auth/session` and `/api/home` returned 200 before logout; A and B cookies differed; logout of A returned 204 and made A's Home return 401 while B session and B Home still returned 200. | PASS | This used equivalent isolated contexts rather than reusing a cookie jar. |
| 15.1-STALE-TABS | Stale tab behavior | Shared-session stale-tab equivalent with dev HTTP | Previously opened Home state does not become valid again after logout; navigation/refresh rechecks auth. | With a valid Home session, logout returned 204; the same session's follow-up Home navigation/API returned 401, while another isolated user's session remained valid. | PASS | A static already-rendered DOM could visually remain until navigation in a browser tab, but refresh/API does not validate it or restore private Home. |
| 15.1-HTTPS-PROXY | HTTPS/reverse proxy | Current environment | If real HTTPS/proxy exists, validate Secure cookie, forwarded proto, host/origin, same-origin, login, session, onboarding, logout. | No real HTTPS/reverse-proxy environment was available. | PENDING | Pending Hardening/Release or owner-provided HTTPS/proxy environment. Do not weaken cookie/security config for local validation. |

## Result

Task 15.1 is complete for the environment available during Phase 0002 validation. All locally executable cases are PASS after the authorized Home filter blocker fix. HTTPS/reverse-proxy validation remains PENDING because no real HTTPS/reverse-proxy deployment was available; it is deferred to Hardening/Release and was not simulated as PASS.

No tokens, passwords, or secrets are recorded in this evidence.
Task 16.1 was not started.
