# Orakl Architecture Decisions

> Living document recording important architectural decisions made during the development of Orakl.

Each decision records:

- Context
- Decision
- Why
- Consequences

This document should only contain decisions that materially affect the architecture of the platform.

---

# ADR-001
## Competition Platform + Game Extensions

**Status**

✅ Accepted

**Date**

July 2026

### Context

Orakl is designed to support multiple games.

Some data is common to every competition, while other data is unique to a specific game.

Examples:

- starting chips
- prediction templates
- quiz question sets

Putting all of this on a single Competition model would cause it to continually grow as new games are added.

### Decision

Use a shared Competition model with one extension model per game.

Examples:

```
Competition
        │
        ├── FauxStakesCompetition
        ├── PredictorCompetition
        └── FutureGameCompetition
```

### Why

- Platform owns shared behaviour.
- Games own their own configuration.
- New games become additive.
- Platform does not require modification when new games are added.

### Consequences

Good

- Clear separation of concerns.
- Easy to extend.
- Keeps Competition model small.

Trade-offs

- Slightly more joins.
- Slightly more services.

---

# ADR-002
## Game Engine Registry

**Status**

✅ Accepted

### Context

Different games require different business logic.

Platform should not contain game-specific behaviour.

### Decision

Introduce GameEngine interface and GameEngineRegistry.

Platform resolves the correct engine using GameType.

```
Competition

↓

Registry

↓

Engine

↓

Game Module
```

### Why

Allows Platform to remain unaware of game rules.

### Consequences

Good

- Plugin architecture.
- Easy to add new games.
- Shared platform.

Trade-offs

- Slightly more abstraction.

---

# ADR-003
## Engine Context Objects

**Status**

✅ Accepted

### Context

Engine methods originally accepted positional parameters.

```
getPlayerState(userId, competitionId)
```

As the platform grows these methods will require additional information.

### Decision

Pass context objects instead.

```
getPlayerState({
    userId,
    competitionId,
})
```

### Why

Future expansion without changing signatures.

More readable.

Less error-prone.

### Consequences

Good

- Easier evolution.
- Self-documenting APIs.

Trade-offs

- Slightly more verbose.

---

# ADR-004
## Generic Platform DTOs

**Status**

✅ Accepted

### Context

Platform DTOs originally contained Faux Stakes configuration.

```
startingChips
teamNames
```

This would not scale to multiple games.

### Decision

Platform accepts:

```
config: unknown
```

Game engines own interpretation.

### Why

Platform should not understand game configuration.

### Consequences

Good

- Generic API.
- Supports any future game.

Trade-offs

- Validation happens inside game modules.

---

# ADR-005
## Dedicated Game Configuration Services

**Status**

✅ Accepted

### Context

Configuration queries were beginning to spread across the Faux Stakes module.

### Decision

Each game owns a configuration service.

Example:

```
FauxStakesConfigService
```

Future:

```
PredictorConfigService

QuizConfigService
```

### Why

Single responsibility.

Keeps Prisma access in one location.

### Consequences

Good

- Easier testing.
- Cleaner services.
- Centralised configuration logic.

---

# ADR-006
## Small Incremental Refactoring

**Status**

✅ Accepted

### Context

Large architectural rewrites introduce unnecessary risk.

### Decision

Refactor in small, independently deployable commits.

Each step must:

- compile
- run
- be reviewable
- be safe to merge

### Why

Reduces regression risk.

Allows architectural corrections during implementation.

### Consequences

This becomes the preferred development workflow for Orakl.

---

# Pending Decisions

These topics require decisions before implementation.

- Competition events
- Plugin discovery
- Caching strategy
- API versioning
- Mobile architecture
- Admin permissions