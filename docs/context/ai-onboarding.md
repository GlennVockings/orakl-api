# AI Onboarding Guide

## Purpose

This document is the recommended starting point for any AI assistant contributing to the Orakl codebase.

Read this document before making architectural decisions, implementing features or suggesting refactors.

Orakl is designed around a long-term vision. The role of an AI assistant is to help evolve the platform while preserving its architecture, principles and product direction.

---

# What is Orakl?

Orakl is a competitive gaming platform.

It enables friends, colleagues and communities to organise and participate in social competitions with minimal administration.

The platform exists to remove the need for spreadsheets, manual scoring and repetitive admin while making competition engaging, fair and enjoyable.

Competition is the core concept.

Games exist to fuel competition.

---

# Product Vision

Orakl aims to become the go-to platform for social competitions.

Initially this focuses on:

* Office competitions
* Sports tournaments
* Work social events
* Friendship groups

Long-term the platform should support:

* Multiple games
* Multiple client applications
* AI-assisted gameplay
* Templates
* Community-created competitions
* Mobile applications
* TV applications

---

# Core Philosophy

Competition comes first.

Every feature should strengthen competition between players.

When designing features, ask:

> Does this make the competition more enjoyable, easier to organise or more engaging?

If the answer is no, reconsider the design.

---

# Platform Architecture

Orakl consists of two major layers.

```text
Platform
    ↓
Game Engines
```

The Platform provides shared capabilities.

Game Engines provide gameplay.

---

## Platform Responsibilities

Platform code owns concepts shared across every game.

Examples include:

* Authentication
* Competitions
* Membership
* Invitations
* Notifications
* User Profiles
* Achievements
* Shared API
* Game Registry

Platform code should never contain game-specific rules.

---

## Game Responsibilities

Each Game owns its own gameplay.

Examples include:

### Faux Stakes

* Markets
* Bets
* Wallets
* Teams
* Market settlement
* Betting rules

### Predictor

* Fixtures
* Predictions
* Tournament progression
* Scoring
* Qualification logic

Game logic must remain isolated inside its own Game Engine.

---

# Game Engine Pattern

Every Game is implemented as a Game Engine.

The Platform should never contain conditional chains based on game type.

Avoid:

```ts
if (gameType === 'FAUX_STAKES') {
    ...
}
```

Instead:

```ts
const engine = gameRegistry.get(gameType);
return engine.getLeaderboard(...);
```

Adding a new Game should require registering a new Game Engine rather than modifying existing Games.

---

# Repository Philosophy

The repositories are separated by responsibility.

Current repositories:

* orakl-api
* orakl-web

Future repositories may include:

* orakl-mobile
* orakl-tv

The backend is the source of truth.

Clients should remain as thin as practical.

---

# Backend Principles

The backend owns:

* Validation
* Business rules
* Competition lifecycle
* Scoring
* Permissions
* State

Clients should not calculate authoritative game results.

---

# Shared vs Game-Specific

Always determine whether a concept belongs to the Platform or a Game.

Examples:

Shared:

* Authentication
* Invitations
* Competition membership
* User Profiles
* Achievements

Game-specific:

* Wallets
* Markets
* Fixtures
* Betting
* Predictions
* AI assistance
* Statistics

---

# Competition

Competition is the primary domain concept.

Games exist inside Competitions.

Players join Competitions.

Leaderboards belong to Competitions.

Future Games should integrate with Competitions rather than invent their own top-level concepts.

---

# Extensibility

The architecture is intentionally designed to support future Games.

New Games should be additive.

Existing Games should rarely require modification when introducing a new Game.

If implementing a new Game requires modifying Faux Stakes, Predictor or other existing Games, the architecture should be reconsidered.

---

# AI Features

AI is not intended to be a platform feature.

Instead, AI should provide value within individual Games.

Examples include:

Predictor:

* Historical analysis
* Prediction suggestions
* AI competitors
* Tournament insights

Faux Stakes:

* Suggested markets
* Suggested odds
* Betting insights

AI should enhance gameplay rather than replace it.

---

# Coding Philosophy

Prefer:

* Small focused services.
* Clear module boundaries.
* Dependency injection.
* Composition over conditional logic.
* Interfaces over concrete implementations.
* Readability over cleverness.

Avoid:

* Large service classes.
* Circular dependencies.
* Cross-game coupling.
* Platform services containing game logic.

---

# Refactoring Principles

When refactoring:

1. Preserve behaviour.
2. Keep the project compiling.
3. Move code before rewriting it.
4. Make one architectural change at a time.
5. Prefer many small commits over one large commit.

Architecture should evolve incrementally.

---

# Documentation

Before making significant architectural changes, review:

* docs/context/product.md
* docs/context/principles.md
* docs/context/domain-model.md
* docs/context/architecture.md
* docs/context/repository.md
* docs/context/game-engine.md

These documents describe the intended direction of the platform and take precedence over implementation details where practical.

---

# If Unsure

When multiple architectural approaches appear valid:

* Prefer consistency over novelty.
* Preserve existing abstractions.
* Avoid introducing new patterns without clear justification.
* Ask whether the change makes adding future Games easier.

The long-term health of the platform is more important than short-term convenience.

---

# Success Criteria

A successful contribution to Orakl should:

* Improve maintainability.
* Preserve architectural boundaries.
* Reduce coupling.
* Increase extensibility.
* Keep Games isolated.
* Strengthen the platform rather than individual implementations.

Every change should move Orakl closer to becoming a reusable competition platform rather than a collection of independent applications.

# Current State

Last updated: 2026-07-07

The backend is currently being refactored from the original Faux Stakes implementation into the Orakl platform architecture.

Current status:
- Repositories have been split into `orakl-api` and `orakl-web`.
- `orakl-api` contains the platform backend.
- `orakl-web` consumes the API and no longer owns Prisma or backend auth routes.
- `docs/context` contains product and architecture context.
- Faux Stakes code is being moved under `src/games/faux-stakes`.
- Platform code is being introduced under `src/platform`.
- `GameType` has been added.
- Game Registry work is in progress.
- Predictor folders exist but Predictor has not been implemented.