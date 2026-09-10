# Weather Integration

## Standard Weather widget

Represents one configured location.

Required information direction:

- current conditions;
- current temperature;
- useful compact secondary values as size permits;
- next 2 days when a legal size has enough room.

Exact displayed fields per size are defined during Phase 0005 design.

## Location

Store a stable human label plus coordinates rather than relying only on free-text city names.

Onboarding may obtain coordinates from browser geolocation.

Manual location search/correction is required.

## Multi-location weather

A separate Travel widget supports several configured places.

Do not overload the standard Weather widget with a location carousel in MVP.

## Provider

Not selected yet.

Phase 0005 must compare appropriate providers and normalize the chosen response behind an app adapter.
