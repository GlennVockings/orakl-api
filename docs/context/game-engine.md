# Game Engine Architecture

## Purpose

This document defines how Games integrate with the Orakl platform.

It explains the responsibilities of a Game Engine, the boundaries between platform and gameplay logic, and the expected contract that every Game Engine should follow.

This document exists to prevent game-specific logic from leaking into shared platform code and to make future games additive rather than disruptive.

---

# Overview

Orakl supports multiple Games through Game Engines.

A Game Engine is a self-contained implementation of a Game. It owns the rules, state and behaviour required to make that Game playable inside a Competition.

The platform provides the shared structure.

The Game Engine provides the gameplay.

```txt
Orakl Platform
│
├── Competition
├── Players
├── Invites
├── Permissions
├── Leaderboard shell
│
└── Game Engine
    ├── Game state
    ├── Game rules
    ├── Game actions
    ├── Scoring
    └── Leaderboard calculation
```

---

# Core Rule

Platform code must not contain game-specific business logic.

If a rule only applies to one Game, it belongs inside that Game Engine.

If a rule applies to all Competitions regardless of Game, it belongs in the platform.

---

# Game Engine Responsibilities

A Game Engine is responsible for:

* Creating game-specific data when a Competition is created.
* Maintaining game-specific state.
* Handling game-specific actions.
* Validating gameplay rules.
* Responding to players joining or leaving.
* Calculating leaderboards.
* Returning game-specific views of a Competition.
* Supporting game enablement and maintenance status.

Examples of game-specific actions include:

* Creating a market.
* Settling a market.
* Placing a bet.
* Creating fixtures.
* Submitting predictions.
* Entering results.
* Recalculating scores.

The platform should not need to understand these actions.

---

# Required Game Engine Contract

Every Game Engine should implement a common contract.

The exact implementation may evolve, but the conceptual responsibilities should remain stable.

```ts
interface GameEngine {
  gameType: GameType;

  isEnabled(): boolean;

  createCompetition(input: CreateGameCompetitionInput): Promise<void>;

  getCompetitionState(
    competitionId: string,
    userId: string,
  ): Promise<GameCompetitionState>;

  getLeaderboard(
    competitionId: string,
  ): Promise<LeaderboardRow[]>;

  canUserAccess(
    competitionId: string,
    userId: string,
  ): Promise<boolean>;

  onUserJoined(
    competitionId: string,
    userId: string,
  ): Promise<void>;

  onUserLeft(
    competitionId: string,
    userId: string,
  ): Promise<void>;
}
```

---

# Required Methods

## `gameType`

Identifies the Game owned by the engine.

Examples:

```txt
FAUX_STAKES
PREDICTOR
```

Every Competition belongs to exactly one `gameType`.

---

## `isEnabled`

Determines whether the Game is currently available.

This allows individual Games to be enabled, disabled or placed into maintenance without disabling the whole platform.

If a Game is disabled:

* New Competitions for that Game should not be created.
* Existing Competitions may be read-only depending on the maintenance mode.
* The platform should communicate availability clearly to clients.

---

## `createCompetition`

Creates the game-specific data required when a Competition is created.

The platform creates the shared Competition record.

The owning Game Engine creates the game-specific setup.

For example:

* A market-based Game may create wallets or starting balances.
* A prediction-based Game may create tournament structures, fixtures and scoring rules.

---

## `getCompetitionState`

Returns the Game-specific state required to render the Competition experience.

This state is owned by the Game Engine and may differ significantly between Games.

Examples:

* Markets, selections, bets and wallets.
* Fixtures, predictions, results and standings.
* Game-specific progress, rules and admin actions.

The platform should not inspect or modify this state except through the Game Engine contract.

---

## `getLeaderboard`

Returns leaderboard rows for a Competition.

Every Game is expected to provide a leaderboard because competition is central to Orakl.

The platform owns leaderboard presentation.

The Game Engine owns leaderboard calculation.

This allows all Games to appear consistently within Orakl while still supporting different scoring models.

---

## `canUserAccess`

Determines whether a User can access the game-specific part of a Competition.

Platform-level access checks should still exist, but a Game Engine may need additional validation.

Examples:

* Game is disabled.
* Competition is locked.
* User is not a Player.
* Game-specific restrictions apply.

---

## `onUserJoined`

Runs when a User joins a Competition.

This is required because every Game may need to create game-specific player state.

Examples:

* Creating a wallet.
* Creating a blank prediction profile.
* Assigning default state.
* Initialising player-specific statistics.

---

## `onUserLeft`

Runs when a User leaves a Competition.

This allows the Game Engine to clean up, preserve or archive game-specific player state.

The exact behaviour is game-specific.

---

# Optional Lifecycle Hooks

Additional lifecycle hooks may be added as the platform evolves.

Examples include:

```ts
onCompetitionOpened?(): Promise<void>;
onCompetitionLocked?(): Promise<void>;
onCompetitionCompleted?(): Promise<void>;
onCompetitionArchived?(): Promise<void>;
onResultEntered?(): Promise<void>;
recalculate?(): Promise<void>;
```

These should only become part of the required contract when more than one Game needs them.

---

# Game-Specific Endpoints

Game-specific actions should be exposed through Game-specific API routes.

Examples:

```txt
/competitions/:competitionId/faux-stakes/markets
/competitions/:competitionId/faux-stakes/bets
/competitions/:competitionId/predictor/fixtures
/competitions/:competitionId/predictor/predictions
```

This keeps routes explicit and prevents the shared platform API from becoming overloaded with gameplay concepts.

---

# Shared Competition Endpoints

The platform may also expose shared Competition endpoints that delegate to the Game Engine when necessary.

Examples:

```txt
/competitions/:competitionId
/competitions/:competitionId/leaderboard
/competitions/:competitionId/game-state
```

Shared endpoints should only exist when the concept is genuinely cross-game.

Where a response requires game-specific data, the platform should delegate to the owning Game Engine rather than implementing Game-specific logic itself.

The exact boundary between shared and game-specific endpoints may evolve as the platform grows.

---

# Game Engine Registry

The platform should not use large conditional chains to decide which Game Engine to call.

Instead, Game Engines should be registered with a Game Engine Registry.

Conceptually:

```ts
const engine = gameEngineRegistry.get(competition.gameType);
return engine.getLeaderboard(competition.id);
```

Adding a new Game should require registering a new Game Engine, not modifying existing Game Engines.

This keeps the architecture extensible and avoids platform-level `if gameType` logic spreading across the codebase.

---

# Dependency Direction

Dependencies should flow downward from platform to Game Engine.

The platform may call Game Engines through defined interfaces.

Game Engines may use shared platform services where appropriate.

However, shared platform services should not depend directly on specific Game Engines.

Preferred direction:

```txt
Platform
   ↓
Game Engine
```

Avoid:

```txt
Platform
   ↔
Game Engine
```

This keeps the platform stable and prevents circular dependencies.

---

# Platform Services Available to Game Engines

Game Engines may need access to platform services.

Examples include:

* Competition service
* Membership service
* Permission service
* Notification service
* Achievement service

These services should be used through clear interfaces.

Game Engines should not bypass platform rules or directly manipulate shared platform state without going through the appropriate service.

---

# Game Availability

Games should support enablement and disablement.

This allows Orakl to:

* Temporarily disable a Game for maintenance.
* Hide a Game from new Competition creation.
* Keep existing Competitions readable.
* Roll out new Games gradually.

Game availability is a platform concern, but each Game Engine must expose whether it is currently available.

---

# Cross-Game Experiences

Games are isolated by default.

Future Orakl experiences may combine multiple Games or allow Games to interact in new ways.

These should be designed deliberately as:

* Platform-level features.
* New composed Game Engines.
* Explicit cross-game modules.

Existing Game Engines should not become tightly coupled to support cross-game features.

---

# Anti-Patterns

The following patterns should be avoided:

## Game Logic in Platform Services

Platform services should not contain rules for a specific Game.

Bad:

```txt
CompetitionService calculates prediction points.
```

Good:

```txt
PredictorEngine calculates prediction points.
```

---

## Large `gameType` Conditional Chains

Bad:

```ts
if (gameType === 'PREDICTOR') {
  ...
} else if (gameType === 'FAUX_STAKES') {
  ...
}
```

Good:

```ts
const engine = gameEngineRegistry.get(gameType);
return engine.getLeaderboard(competitionId);
```

---

## Games Depending on Other Games

A Game Engine should not directly call another Game Engine.

Cross-game experiences should be explicitly designed outside individual Game Engines.

---

## Frontend-Owned Gameplay Rules

Clients should not calculate authoritative scores, validate business rules or settle gameplay.

Frontend clients may display calculated data but should not be the source of truth.

---

# Summary

A Game Engine is the boundary between the shared Orakl platform and the gameplay rules of a specific Game.

The platform owns Competitions.

The Game Engine owns gameplay.

This separation allows Orakl to support multiple Games, multiple clients and future expansion without turning the platform into a collection of tightly coupled features.
