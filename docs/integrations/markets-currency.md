# Markets & Currency Integrations

## Currency

The Currency widget is interactive.

Minimum behavior:

- configurable source currency;
- configurable target currency;
- user enters amount;
- converted amount updates using current rate;
- EUR/JPY is a primary use case.

A direction swap may be proposed in design if it remains compact and useful.

The provider is selected in Phase 0006.

## Markets

The Markets widget supports multiple symbols in one widget.

Minimum row information should include enough to identify the instrument and understand current movement, such as:

- symbol/name;
- current/latest value;
- change/percentage when provider supports it.

Exact fields and chart behavior depend on legal size design.

AAPL is a required example that the chosen provider must support.

## User watchlist

Settings > Markets manages the user's tracked symbols.

Phase 0006 design must define how a widget instance selects from that central list while preserving the ability to have multiple Markets instances meaningfully.

## Provider constraints

- validate/normalize provider responses;
- respect rate limits;
- define refresh cadence;
- do not pretend delayed quotes are real-time if the provider is delayed;
- expose data freshness appropriately.
