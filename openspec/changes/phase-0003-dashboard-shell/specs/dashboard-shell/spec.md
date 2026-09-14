# Dashboard Shell Specification Delta

## Purpose

Define the authenticated dashboard shell and dashboard-tab lifecycle for Phase 0003. This delta adds generic dashboard navigation and lifecycle behavior on top of the verified Phase 0002 authentication/onboarding foundation while reserving the widget grid engine for Phase 0004.

## Requirements

### Requirement: Authenticated dashboard shell

The application MUST render a protected dashboard shell for authenticated users who have completed onboarding. The shell MUST be data-driven by the user's dashboards and MUST NOT hard-code product sections such as Travel or Dev. The shell MUST include product identity, dashboard tabs, a create-dashboard action, current-user/avatar affordance, logout, and the existing appearance control when it fits the layout.

The shell MUST preserve the dark-first, terminal-inspired, mostly monospaced, compact visual baseline. It MUST be desktop-first, tablet touch-friendly, mobile usable, keyboard-operable, and understandable without color alone.

#### Scenario: Completed user opens the root shell

- GIVEN an authenticated user has completed onboarding
- AND the user has at least one non-archived dashboard
- WHEN the user opens `/`
- THEN the application renders the dashboard shell
- AND the shell shows only that user's dashboard tabs in persisted order
- AND it shows the active dashboard body as a safe empty placeholder
- AND it does not render a widget grid or functional widgets

#### Scenario: Incomplete or anonymous user opens the shell

- GIVEN the visitor is anonymous or authenticated but incomplete
- WHEN the visitor opens `/`
- THEN the existing auth routing redirects to login or onboarding as appropriate
- AND no dashboard data is rendered before authorization

### Requirement: Dashboard list and owner isolation

The application MUST list dashboards through the Nuxt server boundary using the authenticated normal user's PocketBase identity. Browser JavaScript MUST NOT receive a PocketBase token or use a direct PocketBase SDK. Dashboard DTOs MUST contain only fields required by the shell.

Archived dashboards MUST be excluded from the normal shell list. The list operation MUST return private, no-store responses and sanitized errors.

#### Scenario: User lists dashboards

- GIVEN User A and User B each have dashboards
- WHEN User A opens the dashboard shell
- THEN only User A's non-archived dashboards are returned
- AND User B's dashboards are absent from the DTO and rendered UI

#### Scenario: Direct normal PocketBase access attempts cross-user listing

- GIVEN User A has a normal PocketBase token
- WHEN User A attempts to list, view, update, reorder, or archive User B's dashboards directly
- THEN PocketBase rules or hooks deny access or return no victim records
- AND User B's records remain unchanged

### Requirement: Active dashboard selection

The application MUST resolve one active dashboard for every completed user with at least one non-archived dashboard. A valid URL dashboard id MAY select the active dashboard for that request. A persisted active-dashboard preference MAY be used when no valid URL selection exists. If neither is valid, the application MUST fall back to the first non-archived dashboard by persisted order.

Active-dashboard persistence MUST happen only through an explicit same-origin mutation. A `GET` request MUST NOT perform a business write merely because it contains a dashboard query parameter. Invalid, archived, or cross-owner active dashboard ids MUST NOT leak existence and MUST NOT create, duplicate, repair, or persist dashboards implicitly.

#### Scenario: Valid URL active dashboard

- GIVEN a completed user owns dashboard `D2`
- WHEN the user opens `/?dashboard=D2`
- THEN `D2` is selected as active for that response
- AND no preference write is performed by the `GET` request

#### Scenario: Invalid URL active dashboard

- GIVEN a completed user opens `/?dashboard=not-owned-or-missing`
- WHEN the shell resolves dashboards
- THEN the response selects the user's deterministic fallback dashboard
- AND the invalid id is not exposed as another user's dashboard
- AND no dashboard is created or duplicated

#### Scenario: Active selection is persisted explicitly

- GIVEN a user owns dashboard `D2`
- WHEN the user sends the explicit active-dashboard mutation for `D2`
- THEN the active preference is persisted for that user
- AND a later refresh without a dashboard query selects `D2` when it remains valid

#### Scenario: Refresh after active selection

- GIVEN a user selected an owned dashboard through URL or persisted preference
- WHEN the user refreshes the page without changing authentication state
- THEN SSR and client hydration agree on the same active dashboard or deterministic fallback

### Requirement: Dashboard creation

The application MUST allow a completed user to create a new empty dashboard through a bounded Nuxt mutation. Creation MUST derive the owner from the authenticated session, reject forged owner fields, assign a valid name, assign a persisted order after the user's current non-archived dashboards, and return the created dashboard as a minimal DTO.

Creation MUST NOT seed Travel, Dev, widgets, layouts, providers, or grid data.

#### Scenario: User creates a dashboard

- GIVEN a completed user has a Home dashboard
- WHEN the user activates the `+` action and submits a valid name
- THEN a new owned dashboard is created
- AND it appears as a tab after existing dashboards
- AND it has no widget grid or functional widget content

#### Scenario: User attempts mass assignment during creation

- GIVEN a completed user submits a create request containing `owner`, `seedKey`, `sortOrder`, `archivedAt`, or another unauthorized field
- WHEN the server handles the request
- THEN unauthorized fields are ignored or rejected according to the API contract
- AND ownership and order are derived server-side

### Requirement: Dashboard rename

The application MUST allow renaming owned non-archived dashboards. Names MUST be validated for trimmed non-empty content and bounded length. Renaming MUST NOT change owner, seed identity, sort order, archived state, or widget records.

Seeded Home MAY be renamed under the approved Phase 0003 policy, but it MUST retain `seedKey: home` and remain the durable seed dashboard.

#### Scenario: User renames a dashboard

- GIVEN a user owns dashboard `D1`
- WHEN the user submits a valid new name
- THEN the dashboard tab updates to the new name
- AND the dashboard id, owner, seed identity, and relative order remain unchanged

#### Scenario: User submits invalid name

- GIVEN a user is renaming a dashboard
- WHEN the submitted name is empty after trimming or exceeds the length bound
- THEN the API returns a field-level validation error
- AND the stored dashboard name remains unchanged

### Requirement: Dashboard reorder

The application MUST allow reordering dashboard tabs and persist the resulting order. Reorder MUST be owner-scoped and MUST accept only the complete ordered set of the user's current non-archived dashboards. The server MUST normalize `sortOrder` values deterministically.

Reorder MUST NOT permit adding, dropping, duplicating, archiving, unarchiving, or cross-owner dashboard ids through the reorder payload.

#### Scenario: User reorders tabs

- GIVEN a user owns dashboards `A`, `B`, and `C`
- WHEN the user submits the order `C`, `A`, `B`
- THEN the stored `sortOrder` values are normalized to that order
- AND a later refresh renders tabs as `C`, `A`, `B`

#### Scenario: Reorder payload is incomplete or cross-owner

- GIVEN a user owns dashboards `A` and `B`
- WHEN the user submits a reorder payload missing `B`, duplicating `A`, or including another user's dashboard
- THEN the mutation is rejected
- AND existing order remains unchanged

### Requirement: Dashboard removal policy

The application MUST prevent a user from ending with zero non-archived dashboards. Phase 0003 SHOULD implement dashboard removal as soft archive rather than hard delete. Archived dashboards MUST be excluded from the default shell list and active selection.

The seeded Home dashboard with `seedKey: home` MUST NOT be archivable/deletable in Phase 0003. This restriction is specific to Phase 0003 and may be reconsidered only by a later approved phase. Phase 0003 MUST NOT hard-delete dashboards.

#### Scenario: User archives an allowed dashboard

- GIVEN a user owns Home and a second non-archived dashboard
- WHEN the user archives the second dashboard
- THEN the second dashboard is excluded from the shell list
- AND active selection moves to a valid remaining dashboard if needed
- AND the user's widget records are not hard-deleted by this operation

#### Scenario: User attempts to archive the last dashboard

- GIVEN a user has exactly one non-archived dashboard
- WHEN the user attempts to archive it
- THEN the mutation is rejected
- AND the dashboard remains available

#### Scenario: User attempts to archive seeded Home

- GIVEN a user has the seeded Home dashboard
- WHEN the user attempts to archive Home during Phase 0003
- THEN the mutation is rejected
- AND Home remains available

### Requirement: Empty dashboard body and Phase 0004 boundary

The dashboard body MUST provide a safe empty or placeholder state for the active dashboard. It MUST be prepared structurally to host the future grid, but it MUST NOT implement grid layout, drag/drop, resize, widget placement, widget rendering, provider calls, or functional widget controls.

#### Scenario: Newly created dashboard is active

- GIVEN a user created an empty dashboard
- WHEN it is selected as active
- THEN the body renders an empty dashboard placeholder
- AND no widget grid or functional widget is present

#### Scenario: Existing Home has Phase 0002 seed widgets

- GIVEN Home has seeded Search, Clock, Weather, and Bookmarks widget records
- WHEN Home is active in Phase 0003
- THEN the shell may acknowledge that widgets will appear later
- BUT it MUST NOT render those widgets functionally or position them on a grid

### Requirement: Settings and edit entry boundaries

The shell MUST expose recognizable entry points for Settings and editing the current dashboard, but Phase 0003 MUST NOT implement full Settings sections or grid edit mode. Any settings shell introduced in this phase MUST be minimal, protected, terminal-inspired, and navigation-oriented.

#### Scenario: User sees future entry points

- GIVEN a completed user opens the dashboard shell
- WHEN the header renders
- THEN Settings and edit/current-dashboard affordances are visible or discoverable according to the design
- AND activating an unavailable future capability presents a safe placeholder or disabled state rather than a partial grid/settings implementation

### Requirement: Loading, error, and unavailable states

The shell MUST provide bounded loading, empty, conflict, and unavailable states. It MUST not display stale protected dashboard data after session invalidation or PocketBase outage. Private responses MUST remain no-store.

#### Scenario: Dashboard data is temporarily unavailable

- GIVEN the user has a valid session cookie
- AND PocketBase is temporarily unavailable
- WHEN the shell attempts to load dashboard data
- THEN it renders a retryable unavailable state
- AND it does not clear a valid cookie merely because of outage
- AND it does not render stale dashboard records as fresh data

#### Scenario: Session becomes invalid

- GIVEN a user's session becomes invalid
- WHEN dashboard shell data is requested
- THEN the session is cleared according to the Phase 0002 contract
- AND protected dashboard UI is not shown

### Requirement: Accessibility and responsive interaction

Dashboard tabs and shell actions MUST be keyboard-operable and touch-usable. Active, focus, disabled, loading, and error states MUST be perceivable without color alone. The layout MUST remain usable at desktop, tablet, and mobile widths.

#### Scenario: Keyboard user changes tabs

- GIVEN multiple dashboard tabs are rendered
- WHEN a keyboard-only user navigates the tab list
- THEN focus order is logical
- AND the active tab is identifiable
- AND the user can select another dashboard without a pointer

#### Scenario: Touch user operates header actions

- GIVEN the shell is displayed on a tablet-sized viewport
- WHEN the user taps tabs, create, logout, or appearance controls
- THEN targets are large enough for touch use
- AND controls do not require hover-only interaction

### Requirement: Security boundary preservation

Dashboard operations MUST preserve the Phase 0002 security model. Unsafe mutations MUST validate same-origin metadata before body processing or mutation. All browser-facing DTOs MUST be minimal and sanitized. Server code MUST not expose PocketBase tokens, superuser credentials, raw PocketBase errors, SQL/filter details, or private endpoints to the browser.

#### Scenario: Cross-origin mutation attempt

- GIVEN a malicious site submits a dashboard create, rename, reorder, or archive request
- WHEN same-origin validation fails
- THEN the request is rejected before mutation
- AND no dashboard data changes

#### Scenario: Browser output is inspected

- GIVEN an authenticated user opens the dashboard shell
- WHEN HTML, Nuxt payload, JSON responses, browser storage, and public runtime configuration are inspected
- THEN no PocketBase bearer token, private endpoint, superuser credential, or raw auth payload is present
