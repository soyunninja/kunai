# Onboarding Specification

## Purpose

Collect the minimum user profile and establish a complete, private default Home seed without introducing later dashboard or widget behavior.

## Requirements

### Requirement: Minimal profile baseline

The system MUST maintain each user's display name, bundled-avatar stable key, valid IANA timezone, and onboarding completion marker/timestamp. Display name, avatar key, and valid timezone MUST be present before onboarding can complete. The user preferences record MUST support a nullable or explicitly unconfigured default location.

#### Scenario: Valid profile completion

- GIVEN an authenticated user supplies a display name, an approved avatar key, and a valid IANA timezone
- WHEN the user completes onboarding and the required seed is established
- THEN the system persists those profile values and records onboarding completion

#### Scenario: Invalid timezone

- GIVEN an onboarding timezone is missing, invalid, or unavailable
- WHEN the user attempts completion
- THEN the system prevents completion and requests explicit correction rather than applying a hidden timezone fallback

#### Scenario: Location omitted

- GIVEN an authenticated user provides the required profile values but no location
- WHEN the user completes onboarding
- THEN completion remains possible and the default location is persisted as null or explicitly unconfigured

### Requirement: Bundled avatar selection gate

The system MUST require selection of one stable key from the owner-provided bundled avatar registry before onboarding completes. It MUST NOT invent replacement avatar assets or stable keys, and it MUST NOT offer arbitrary avatar upload.

#### Scenario: Avatar required

- GIVEN an authenticated user has not selected an approved bundled-avatar key
- WHEN the user attempts onboarding completion
- THEN the system prevents completion and identifies the required avatar selection

#### Scenario: Avatar assets are unavailable

- GIVEN the owner-provided avatar assets or final stable keys have not been supplied
- WHEN implementation readiness is assessed
- THEN avatar selection remains an apply gate and the system does not substitute fabricated assets or uploads

### Requirement: User-controlled location and timezone collection

The system MUST detect browser timezone when available and permit correction before persistence. It MUST request browser geolocation only after explicit user action in a secure browser context. Geolocation denial, failure, timeout, unavailable APIs, and user skipping location MUST NOT block onboarding. Normal onboarding MUST NOT require manual latitude/longitude entry, and this phase MUST NOT select or call a weather, geocoding, or reverse-geocoding provider. A user-entered location label, if offered, MUST be stored only as a non-geocoded label.

#### Scenario: Geolocation accepted

- GIVEN an onboarding user explicitly requests location detection in a secure browser context
- WHEN geolocation succeeds
- THEN the system may persist the resulting location state and allows the user to complete onboarding

#### Scenario: Geolocation rejected

- GIVEN an onboarding user explicitly requests location detection
- WHEN the browser rejects the permission request
- THEN the system presents non-blocking feedback and allows completion with an unconfigured location

#### Scenario: Geolocation unavailable or fails

- GIVEN geolocation is unavailable, times out, or otherwise fails after the user requests it
- WHEN the failure is reported
- THEN the system presents recoverable feedback and allows onboarding to continue without manual coordinate entry

### Requirement: Accessible and recoverable onboarding interaction

The onboarding flow MUST provide clear validation, loading, and recoverable error feedback. Its required controls and feedback MUST be keyboard-operable and touch-usable at supported tablet and desktop sizes.

#### Scenario: Validation feedback

- GIVEN an onboarding user omits or supplies an invalid required profile value
- WHEN the user submits the flow
- THEN the system identifies the affected value and does not report false completion

#### Scenario: Completion loading and failure feedback

- GIVEN a valid onboarding submission is in progress or encounters a recoverable persistence failure
- WHEN the user observes the flow
- THEN the system communicates the in-progress or failed state and permits a safe retry after failure

#### Scenario: Keyboard and touch completion

- GIVEN a user operates onboarding with keyboard-only input or tablet touch
- WHEN the user selects an avatar, corrects values, and submits
- THEN each required action and feedback state is usable without requiring a mouse or precise pointer interaction

### Requirement: Idempotent initial Home seed

Onboarding completion MUST ensure exactly one initial `Home` dashboard and exactly one seeded widget placeholder of each stable key `search`, `clock`, `weather`, and `bookmarks` on that dashboard. The Search placeholder MUST represent the built-in Google default, Clock MUST carry the selected timezone, Weather MUST carry selected location state or explicit unconfigured state, and Bookmarks MUST contain no seeded links. The seed MUST contain no layout/grid coordinates or dimensions and MUST NOT create Travel or Dev.

#### Scenario: First successful onboarding

- GIVEN a user has valid required profile data and no existing onboarding seed
- WHEN onboarding completes successfully
- THEN the user's private data contains exactly one seeded Home dashboard and exactly one each of Search, Clock, Weather, and Bookmarks placeholders with the required initial state

#### Scenario: Unconfigured weather seed

- GIVEN a user completes onboarding without usable location data
- WHEN the initial Home is seeded
- THEN its Weather placeholder has an explicit unconfigured location state and no weather provider data is created

### Requirement: Seed convergence and truthful completion

The system MUST make the Home and widget seed identities durably unique per owner/dashboard so retries, refreshes, concurrent completion requests, and partial-write recovery converge on one complete seed set. It MUST recover an existing seed identity created by a competing request rather than duplicating it. Onboarding MUST be marked complete only after the required profile/preferences state and all four required widget placeholders exist; incomplete partial state MUST remain recoverable by retry.

#### Scenario: Onboarding retry

- GIVEN a prior completion attempt created some but not all required seed records
- WHEN the user retries onboarding completion
- THEN the system preserves or reuses valid existing seed records, creates only missing required records, and marks completion only after the full seed exists

#### Scenario: Concurrent completion

- GIVEN two completion requests for the same user overlap
- WHEN both requests attempt to establish the initial seed
- THEN the persisted result contains one Home and one placeholder per required seed key without duplicate records

#### Scenario: Partial failure

- GIVEN a completion attempt fails after at least one profile, preferences, dashboard, or widget seed record is persisted
- WHEN the failure is returned
- THEN onboarding remains incomplete and a later retry can converge to the complete required seed without deleting valid user data

### Requirement: Phase boundaries

This phase MUST NOT provide dashboard editing, a functional widget engine, provider-backed weather, search-engine management, functional bookmark records, calendar, finance, travel, dev tools, AI features, collaboration, workspaces, organizations, or team roles. It MUST NOT add public registration, social login, password reset, email verification UX, or avatar upload.

#### Scenario: Default Home inspection

- GIVEN onboarding has completed
- WHEN the user opens the protected Home landing
- THEN it confirms only the initialized private Home state and does not expose a dashboard editor or functional widget/product areas deferred to later phases
