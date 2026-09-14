# Delta for Application Foundation

## MODIFIED Requirements

### Requirement: Neutral foundation shell

The application MUST render an authentication-aware application shell that preserves the established visual baseline while presenting login to unauthenticated visitors, onboarding to authenticated users whose onboarding is incomplete, and a minimal protected Home landing to authenticated users whose onboarding is complete. The protected landing MUST NOT implement dashboard editing or functional widget behavior. It MUST include a main landmark and retain an accessible appearance control consistent with the visual-foundation specification.

(Previously: The foundation rendered a neutral, non-product shell with a concise heading, explanatory text, main landmark, and non-persistent appearance control.)

#### Scenario: An unauthenticated visitor opens the application

- GIVEN no valid authenticated session is present
- WHEN the visitor opens the root application route
- THEN the application renders login rather than protected or onboarding content

#### Scenario: An incomplete user opens the application

- GIVEN an authenticated user has not completed onboarding
- WHEN the user opens the root application route
- THEN the application renders onboarding rather than the protected Home landing

#### Scenario: A completed user opens the application

- GIVEN an authenticated user has completed onboarding
- WHEN the user opens the root application route
- THEN the application renders the minimal protected Home landing with a main landmark and without dashboard-editor or functional-widget behavior
