# Phase 0006 — Finance Widgets

Change name: `phase-0006-finance-widgets`

Status: Planned

Depends on: Phase 0005

## Objective

Add compact, configurable currency and market information without turning the product into a finance terminal.

## Currency

Required:

- configurable currency pair;
- amount input inside widget;
- live/current conversion according to provider semantics;
- EUR/JPY works well as primary use case;
- size-aware rendering.

## Markets

Required:

- Settings-managed tracked symbols/watchlist;
- AAPL support;
- multiple symbols in one widget;
- price/value + movement information as provider allows;
- multiple Markets widget instances remain meaningful;
- explicit data freshness/delay semantics.

## Required design work

- select FX provider;
- select markets provider;
- define refresh/caching/rate-limit strategy;
- define legal sizes/content variants;
- define relationship between central watchlist and each Markets widget instance.

## Must not include

- trading;
- brokerage login;
- portfolio accounting;
- alerts;
- large financial charting suite.
