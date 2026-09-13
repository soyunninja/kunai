export type DefaultLocation =
  | null
  | LocationLabel
  | LocationCoordinates

export interface LocationLabel {
  readonly kind: 'label'
  readonly label: string
}

export interface LocationCoordinates {
  readonly kind: 'coordinates'
  readonly label: string
  readonly latitude: number
  readonly longitude: number
}

export interface OnboardingCompletionInput {
  readonly displayName: string
  readonly avatarKey: string
  readonly timezone: string
  readonly defaultLocation: DefaultLocation
}

export interface OnboardingDraft {
  readonly displayName: string
  readonly avatarKey: string
  readonly timezone: string
  readonly defaultLocation: DefaultLocation
}

export interface OnboardingDraftEnvelope {
  readonly draft: OnboardingDraft
}

export interface OnboardingParserOptions {
  readonly allowedAvatarKeys: readonly string[]
}

export interface SearchInitialWidgetConfig {
  readonly engine: 'google'
  readonly placeholder: null
}

export interface ClockInitialWidgetConfig {
  readonly mode: 'local'
  readonly timezone: string
}

export interface WeatherInitialWidgetConfig {
  readonly location: DefaultLocation
}

export interface BookmarksInitialWidgetConfig {
  readonly items: readonly []
}

export type InitialWidgetConfig =
  | SearchInitialWidgetConfig
  | ClockInitialWidgetConfig
  | WeatherInitialWidgetConfig
  | BookmarksInitialWidgetConfig
