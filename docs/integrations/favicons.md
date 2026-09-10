# Bookmark Favicons

## Goal

Bookmark icons should come from the target website without requiring manual icon management.

## Behavior

Given a bookmark URL:

1. derive the website origin/host safely;
2. attempt the chosen favicon strategy;
3. display the icon when available;
4. otherwise display a deterministic text fallback derived from the bookmark name/host.

## Constraints

- no arbitrary avatar/icon upload for bookmarks;
- favicon failure must not block bookmark navigation;
- do not make favicon retrieval a security-sensitive proxy without justification.

The exact favicon resolution strategy is an implementation detail for Phase 0005.
