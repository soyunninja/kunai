# Visual Foundation Specification

## Purpose

Establish a restrained, accessible dark-first visual baseline for the foundation shell without creating product navigation or Settings behavior. Its scenarios verify rendered and interactive visual behavior only; deferred product scope is controlled by the OpenSpec artifacts rather than absence-only tests.

## Requirements

### Requirement: Theme modes and dark default

The application MUST support dark, light, and system appearance modes. Initial appearance MUST default to dark when no explicit mode has been selected. System mode MUST reflect the active operating-system color preference. A minimal non-product demonstration control MAY exercise the modes, but it MUST NOT create a Settings surface, account preference, or persisted user preference.

#### Scenario: A visitor has no selected appearance mode

- GIVEN the application is opened with no explicit appearance selection
- WHEN the initial shell is rendered
- THEN the shell uses the dark appearance

#### Scenario: A visitor selects system appearance

- GIVEN the theme demonstration is available and system appearance is selected
- WHEN the operating-system color preference is dark or light
- THEN the shell reflects that corresponding appearance

#### Scenario: A visitor selects an explicit appearance

- GIVEN the theme demonstration is available
- WHEN the visitor selects dark or light appearance
- THEN the shell uses the selected appearance without exposing a product Settings or account-preference feature

### Requirement: Terminal-inspired base tokens

The foundation MUST provide reusable visual tokens or equivalent shared styling for predominantly monospaced interface typography, dark-first flat surfaces, thin borders, restrained semantic color, compact controls, and little or no decorative shadow. The shell MUST avoid generic SaaS-card styling, glass effects, heavy gradients, neon decoration, and oversized display typography. Information and interaction states MUST remain understandable without color alone.

#### Scenario: A maintainer inspects the foundation shell

- GIVEN the shell is rendered in either supported explicit appearance
- WHEN the maintainer evaluates its shared visual treatment
- THEN typography, surfaces, borders, control density, and emphasis follow the terminal-inspired baseline without decorative styling prohibited by this requirement

#### Scenario: A non-color interaction cue is needed

- GIVEN a shell control receives focus or has an active state
- WHEN its state is presented
- THEN the state is distinguishable by more than color alone

### Requirement: Baseline interaction accessibility

The neutral shell and any theme demonstration control MUST be keyboard-operable, readable at tablet viewport sizes, and touch-usable. Motion in the foundation MUST be functional rather than decorative and MUST respect reduced-motion preferences.

#### Scenario: A keyboard user operates a theme control

- GIVEN the theme demonstration control is present
- WHEN a keyboard-only user navigates to and operates it
- THEN the user can identify and select an appearance mode without requiring a pointer

#### Scenario: A user prefers reduced motion

- GIVEN the user agent reports a reduced-motion preference
- WHEN the shell or theme mode changes state
- THEN nonessential animation is omitted or reduced
