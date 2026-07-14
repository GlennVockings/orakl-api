# Orakl Architecture Roadmap

> Living document describing the current state, planned evolution and deferred work for the Orakl platform.

This document describes both the implemented architecture and the intended direction. Where the code temporarily differs from the target architecture, the current phase should make that explicit.

---

# Vision

Build Orakl as a reusable competition platform where adding a new Game requires building that Game's module, engine and data model with little or no modification to the shared Platform.

The Platform owns:

- Competitions
- Membership and roles
- Permissions
- Join codes
- Shared lifecycle
- Authentication
- Shared leaderboard delivery
- Game discovery and availability

Each Game owns:

- Rules
- Configuration
- Scoring
- Game-specific leaderboard calculation
- Game-specific realtime events
- Game-specific APIs and data

Goal:

> Adding a new Game should be additive and should not require modifying existing Games.

---

# Domain Terminology

Orakl distinguishes between a **Game** and a **Competition**.

## Game

A Game is a reusable ruleset or product experience.

Examples:

- Faux Stakes
- Predictor
- Quiz

Game-level concepts include:

- `GameType`
- `GameEngine`
- Game modules under `src/games`
- Game-specific configuration and tables

## Competition

A Competition is a playable instance of a Game that users create and join.

Examples:

- Office Sports Day 2026 using Faux Stakes
- World Cup Predictor using Predictor

Competition-level concepts include:

- Competition record
- Competition members
- Join code
- Status
- Activity
- Host and admin roles

This distinction means `GameEngine` and `GameType` remain valid names. The current Prisma `Game` model represents a Competition instance and should be renamed during Phase 2C.

---

# Current Architecture

```text
Orakl API
├── Platform
│   ├── Authentication
│   ├── Competitions
│   ├── Database
│   ├── Leaderboard delivery
│   └── Game Engine Registry
│
└── Games
    ├── Faux Stakes
    │   ├── Engine
    │   ├── Config
    │   ├── Bets
    │   ├── Markets
    │   ├── Teams
    │   ├── Leaderboard calculation
    │   └── Realtime
    │
    └── Predictor (planned)
```

Request flow:

```text
Platform endpoint
    ↓
Platform service
    ↓
Game Engine Registry
    ↓
Owning Game Engine
    ↓
Game-specific services and data
```

---

# Architectural Principles

## 1. Competition-Centred Platform

Competitions are the shared unit users create, join and organise.

## 2. Games Own Gameplay

The Platform must not understand bets, markets, fixtures, predictions, chips or scoring rules.

## 3. Games Own Their Data

The shared Competition record stores universal fields only. Each Game owns an extension model for its configuration and state.

```text
Competition
├── FauxStakesCompetition
├── PredictorCompetition
└── FutureGameCompetition
```

## 4. Engines Are the Platform Boundary

The Platform delegates game-specific behaviour through the `GameEngine` contract and registry rather than using `gameType` conditional chains.

## 5. New Games Are Additive

A new Game should add its own module, engine, extension model and APIs without modifying existing Game implementations.

## 6. Small Safe Refactors

Architectural improvements should be small, reviewable, independently testable and committed only after build and lint checks pass.

---

## Completed

### ✅ Phase 1A — Platform and Game Separation

Completed:
- Platform/Game separation
- Game registry
- Engine abstraction
- Shared competition lifecycle

---

### ✅ Phase 1B — Game Configuration Separation

Completed:
- FauxStakesCompetition
- Config service
- Platform configuration removal
- Game-owned configuration

---

### ✅ Phase 2A — Engine Contracts

Completed:
- Context objects
- Explicit engine contracts
- Shared summary contracts

---

### ✅ Phase 2B — Shared Platform Contracts

Completed:
- Shared leaderboard contract
- Extracted GameType
- Game-agnostic platform interfaces

---

### ✅ Phase 2C — Competition Terminology

Completed:
- Competition Prisma models
- Competition services
- Competition API terminology
- Clear Game vs Competition distinction

---

### ✅ Phase 3A — API Alignment

Completed:
- /competitions platform routes
- Faux Stakes namespaced routes
- Explicit gameType support
- API consistency

---

# Current Phase

## Phase 4 — Platform Hardening

Status

🟡 Planning

Goal

Strengthen the platform before introducing another frontend and another game.

Success criteria

- Platform contracts are stable.
- Developer experience is consistent.
- Core platform behaviour is protected by tests.

---

# Roadmap

## Phase 4

Platform Hardening

### 4A — Developer Experience

- CurrentUser decorator
- Request typing
- Logger
- Config module
- Error handling consistency

---

### 4B — Platform Safety

- Access audit
- Game configuration validation
- Lifecycle consistency
- Transactions
- Tests

---

### 4C — Operations

- Health endpoint
- Startup validation
- Environment configuration
- Swagger polish

---

## Phase 5

Frontend Alignment

Goal

Align Orakl Web with the new platform architecture.

---

## Phase 6

Predictor

Goal

Implement the first additional Game using the new architecture.

Success criterion

Predictor should require little or no Platform changes.

---

## Phase 7

Administration

---

## Phase 8

Additional Games

---

# Roadmap Backlog

## Platform

- Plugin discovery
- Domain events
- Stronger typing
- Background jobs

## Operations

- Metrics
- Audit logs
- API versioning
- Rate limiting

## Future

- Mobile clients
- TV clients
- AI-generated competitions