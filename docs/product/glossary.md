# Glossary

## User

An authenticated PocketBase user. Each user owns a private personal space.

## Personal space

The aggregate of one user's dashboards, widgets, bookmarks, preferences, integration settings, and scratchpad data. It is not a separate workspace entity.

## Dashboard

A user-owned tab containing widget instances arranged on a persisted grid.

## Widget type

A registered implementation definition such as `weather`, `search`, or `markets`. It declares legal sizes, configuration schema, and rendering behavior.

## Widget instance

One user-configured occurrence of a widget type on one dashboard.

## Legal size

A width/height grid combination explicitly supported by a widget type.

## Device layout

The saved position/size arrangement for one device class: desktop, tablet, or mobile.

## Normal mode

Regular dashboard usage. Layout mutation is disabled.

## Edit mode

Dashboard mode allowing add/move/resize/configure/duplicate/remove.

## Provider

An external service used for weather, market data, exchange rates, calendar, AI, or holidays.

## Adapter

An app-level boundary that converts provider-specific data into stable normalized application data.

## Phase brief

A durable product/architecture input document under `docs/phases/`. It guides SDD but is not the generated OpenSpec implementation spec.

## OpenSpec change

The proposal/spec/design/tasks/verification artifact set created by gentle-ai for one development change.
