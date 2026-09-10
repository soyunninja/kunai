# Core User Flows

## First login

1. User authenticates.
2. If onboarding is incomplete, onboarding opens.
3. User chooses an 8-bit avatar.
4. App determines browser timezone.
5. App asks for geolocation permission for default weather.
6. User can correct/select the location manually.
7. App creates Home and default widgets.
8. User lands on Home.

## Normal startup

1. Browser opens the app.
2. Existing authenticated session is restored securely.
3. Active/default dashboard renders immediately.
4. Widget data loads independently.
5. A failing provider widget shows its own error state only.

## Search

1. User focuses Search.
2. Plain query uses Google.
3. Alias query selects a configured external engine.
4. App opens/navigates to the resulting external search URL.

Search does not query internal app records.

## Create dashboard

1. User selects `+` in dashboard tabs.
2. Provides dashboard name.
3. New empty dashboard is created.
4. User enters edit mode or adds widgets.

## Edit dashboard

1. User selects `edit`.
2. Layout controls become available.
3. User adds/moves/resizes/configures/duplicates/removes widgets.
4. Only legal widget sizes are selectable/reachable.
5. Layout persists for the current device class.
6. Leaving edit mode returns to stable normal interaction.

## Add bookmark

1. Add/edit Bookmarks widget data.
2. Enter name and URL.
3. Category is optional.
4. App derives favicon from URL.
5. If favicon cannot render, app shows deterministic text fallback.

## Scratchpad archive

1. User types; content autosaves.
2. `Cmd+Enter` archives current content.
3. Active editor becomes empty.
4. Archived entries remain available to the scratchpad feature's limited history UX, without becoming a general notes product.

## Connect Google Calendar

1. User opens Settings > Calendar.
2. Connects Google account using minimum read-only scopes.
3. App lists available calendars.
4. User selects calendars to display.
5. Calendar widget shows events from selected calendars for next 3 days.

## AI translation

1. User configures supported AI provider/model/credentials in Settings.
2. On a dashboard, user enters Spanish text in AI Translate JA.
3. Browser sends request to app server, never directly exposing stored provider secret.
4. Server requests translation through provider adapter.
5. Japanese result is displayed and can be copied.
