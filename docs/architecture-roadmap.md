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

# Completed Phases

## Phase 1A — Platform and Game Separation

Status: ✅ Complete

Completed:

- Split shared Platform code from Faux Stakes gameplay code
- Introduced Platform and Games aggregation modules
- Introduced shared DatabaseModule
- Moved Competitions into the Platform
- Introduced Game Engine Registry
- Split shared leaderboard delivery from Faux Stakes leaderboard calculation
- Removed Platform dependency on the Faux Stakes WebSocket gateway
- Introduced lifecycle delegation for competition creation and user joins

## Phase 1B — Game Configuration Separation

Status: ✅ Complete

Completed:

- Added `FauxStakesCompetition` extension model
- Moved `startingChips` out of the shared model
- Added `FauxStakesConfigService`
- Made the Platform creation DTO generic using `config`
- Moved Faux Stakes setup and reads behind the Faux Stakes engine

## Phase 2A — Engine Contracts

Status: ✅ Complete

Completed:

- Replaced positional engine arguments with context objects
- Added competition, user and creation context types
- Separated game summary data from membership enrichment
- Removed the temporary `_engineMembership` merge workaround

## Phase 2B — Shared Platform Contracts

Status: ✅ Complete

Completed:

- Extracted `GameType` from the engine interface
- Introduced a game-agnostic leaderboard result
- Standardised leaderboard output using `score`, `scoreLabel`, `rows` and optional game-specific `details`
- Began terminology cleanup around registry files

Note:

The current `competition-registry` directory is partially renamed while the classes still use `GameEngine` terminology. Phase 2C will restore consistent naming based on the Game-versus-Competition distinction.

---

# Current Phase

## Phase 2C — Competition Instance Terminology

Status: 🟡 Planned

Goal:

Rename concepts that represent playable Competition instances while preserving Game terminology for rulesets and engines.

### Keep as Game terminology

- `GameType`
- `GameEngine`
- `GameEngineRegistryService`
- `GameRegistryModule`
- `src/games`
- `FauxStakesEngine`
- `PredictorEngine`

### Rename to Competition terminology

- Prisma `Game` model → `Competition`
- Prisma `GameMember` → `CompetitionMember`
- shared `gameId` foreign keys → `competitionId`
- service parameters representing an instance → `competitionId`
- user-facing messages referring to an instance as a game → competition
- shared repository relations such as `gamesCreated` → `competitionsCreated`

### Phase 2C work units

1. Restore registry directory/file naming to `game-registry` while retaining the current engine contract.
2. Rename TypeScript instance variables and parameters from `game`/`gameId` to `competition`/`competitionId` where they refer to a Competition.
3. Rename Prisma shared models and relations with a controlled migration.
4. Rename remaining foreign keys and generated Prisma client usages.
5. Run build, lint, migrations and behavioural checks.

Routes remain unchanged during the backend model rename to avoid combining database, API and frontend changes in one phase.

---

# Planned Phases

## Phase 3 — API and Frontend Alignment

Status: ⬜ Planned

Goals:

- Rename `/games` API routes to `/competitions`
- Update response and request terminology
- Refactor `orakl-web` into an Orakl shell with a Faux Stakes game area
- Rename frontend hooks, pages and components from Game-instance terminology to Competition
- Update the frontend for the generic leaderboard response
- Complete Orakl branding

## Phase 4 — Predictor Backend

Status: ⬜ Planned

Goals:

- Add `PredictorCompetition` extension model
- Implement PredictorEngine
- Add templates, fixtures, predictions, results and scoring
- Implement tournament configuration and progression
- Integrate with shared competition membership and leaderboard delivery

V1 remains template-first. Custom predictors are deferred.

## Phase 5 — Predictor Frontend

Status: ⬜ Planned

Goals:

- Choose Game during competition creation
- Choose Predictor template
- Render group and knockout structures
- Build prediction entry and admin result workflows

## Phase 6 — Platform Administration

Status: ⬜ Planned

Potential work:

- Game enable/disable and maintenance controls
- Competition moderation
- Operational dashboards
- Audit logging
- Support tooling

## Phase 7 — Additional Games and Clients

Status: ⬜ Future

Potential Games:

- Quiz
- Fantasy
- Draft
- Pick'em

Potential clients:

- Mobile
- TV

---

# Roadmap Backlog

## High Priority

- Competition lifecycle/domain events
- Engine registration that scales beyond manual constructor wiring
- Strong validation of game-specific `config`
- Automated tests for creation, joining, settlement and leaderboard delivery
- Consistent use of shared CompetitionAccessService

## Engineering Standards

- Standardise constructor injection with `private readonly`
- Introduce an Orakl-owned authenticated user payload
- Consider a reusable `@CurrentUser()` decorator after auth normalisation
- Replace `console.log` with Nest Logger
- Move CORS and WebSocket origins to configuration
- Correct package database scripts that still reference the former monorepo path

## Before Production

- Health, readiness and liveness endpoints
- API versioning decision
- Audit logging strategy
- Error response standard
- Deployment and observability documentation

## Future Platform Capabilities

- Public SDK
- Public API
- Webhooks
- AI-assisted game creation and analysis
- Cross-game competition experiences
