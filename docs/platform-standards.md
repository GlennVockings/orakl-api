# Orakl Platform Standards

> This document defines the engineering conventions used throughout Orakl.
>
> These standards exist to keep the platform consistent, maintainable and easy
> to extend. They are conventions rather than rigid rules—deviations are
> acceptable when there is a clear architectural benefit.

---

# Core Principles

## Build for the next Game

Every architectural decision should assume that another Game will be added in
the future.

Platform code should never become coupled to the requirements of a single Game.

---

## Platform owns shared behaviour

The Platform owns concepts common to every Competition.

Examples include:

- Competitions
- Membership
- Authentication
- Permissions
- Join Codes
- Lifecycle
- Realtime routing

The Platform must never own game-specific rules.

---

## Games own their behaviour

Each Game owns:

- Configuration
- Rules
- Scoring
- Leaderboards
- Validation
- Realtime events
- Persistence specific to that Game

Adding a new Game should primarily involve creating a new Game module rather
than modifying Platform code.

---

## Prefer additive changes

New Games should extend the Platform rather than modify it.

Good:

Competition
↓

FauxStakesCompetition

PredictorCompetition

FutureGameCompetition

Avoid adding game-specific fields directly to shared Platform models.

---

# Terminology

Consistent language is important.

## Game

A reusable ruleset.

Examples:

- Faux Stakes
- Predictor

Game concepts include:

- GameEngine
- GameType
- GameRegistry

---

## Competition

A specific instance of a Game.

Examples:

- Office Sports Day
- World Cup Predictor 2026

Competition concepts include:

- Competition
- CompetitionMember
- competitionId

---

# Project Structure

Platform code belongs in:

```
src/platform
```

Game implementations belong in:

```
src/games
```

Each Game should be self-contained.

Example:

```
games/
└── faux-stakes
    ├── config
    ├── leaderboard
    ├── realtime
    ├── engine
    ├── bets
    ├── markets
    └── teams
```

---

# Controllers

Controllers should remain thin.

Controllers should:

- Validate requests
- Extract authenticated user information
- Delegate to services
- Return responses

Controllers should not contain business logic.

---

# Services

Services own business logic.

Guidelines:

- One primary responsibility
- Constructor injection
- Prefer `private readonly` dependencies
- Keep methods cohesive

Avoid services becoming "god classes".

---

# Platform Services

Platform services should never contain Game-specific rules.

If Platform starts needing to understand how Faux Stakes works, the
responsibility is probably in the wrong place.

---

# Game Engines

Each Game provides a GameEngine implementation.

The Platform communicates with Games exclusively through this contract.

The Platform should not know:

- how scoring works
- how leaderboards are calculated
- how configuration is validated

---

# Validation

Platform validates Platform concerns.

Games validate Game concerns.

Example:

Platform:

- Competition name
- Join code
- Authentication

Faux Stakes:

- Starting chips
- Team names

Predictor:

- Tournament template
- Fixture rules

---

# Realtime

Shared events should use:

```
competition.*
```

Game-specific events should use:

```
faux-stakes.*

predictor.*
```

The Platform should never emit Game-specific events.

---

# Dependency Direction

Preferred dependency flow:

```
Platform

↓

Game Registry

↓

Game Engine

↓

Game Services
```

Avoid dependencies flowing back into the Platform.

---

# Transactions

Platform owns shared lifecycle transactions.

Games should participate in Platform lifecycle rather than implementing their
own independent lifecycle.

---

# Testing

Platform behaviour should be covered by automated tests.

High priority:

- Competition creation
- Joining
- Permissions
- Access
- Lifecycle
- Leaderboard contract

Game modules should test their own rules separately.

---

# Logging

Use Nest Logger.

Avoid `console.log()`.

Game logs should clearly identify the owning Game.

---

# Configuration

Environment-specific configuration should come from the Config module.

Avoid hard-coded URLs, origins or secrets.

---

# Coding Style

Prefer:

- `private readonly`
- descriptive variable names
- small focused methods
- explicit return types where useful

Avoid:

- unused helpers
- duplicated queries
- long methods
- unnecessary abstractions

---

# Refactoring

Refactor in small, reviewable commits.

Each commit should:

- compile
- pass linting
- be independently understandable
- leave the application in a working state

---

# Architecture

Architecture should evolve because of new requirements, not because a different
abstraction seems cleaner.

The addition of a new Game should validate the architecture rather than require
large Platform changes.

When in doubt, optimise for clarity over cleverness.