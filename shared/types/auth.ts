export interface SafeSessionDto {
  readonly id: string
  readonly displayName: string
  readonly avatarKey: string
  readonly onboardingCompleted: boolean
}

export interface SessionEnvelope {
  readonly session: SafeSessionDto | null
}
