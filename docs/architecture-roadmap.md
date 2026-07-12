# Orakl Architecture Roadmap

> Living document describing the evolution of the Orakl platform.

---

# Vision

Build Orakl as a reusable competition platform where adding a new game should
require building only that game's module, with little or no modification to the
shared platform.

The platform owns:

- Competitions
- Membership
- Permissions
- Join codes
- Lifecycle
- Realtime routing
- Authentication

Each game owns:

- Rules
- Configuration
- Scoring
- Leaderboards
- Realtime events
- Game specific APIs

Goal:

> Adding a new game should be additive, not require platform changes.

---

# Current Architecture

```
Platform
│
├── Competitions
├── Members
├── Leaderboards
├── Registry
├── Auth
├── Realtime
│
├── Faux Stakes
│
└── Predictor (planned)
```

---

# Principles

## 1. Platform First

Platform should never know game rules.

---

## 2. Games Own Their Data

Every game owns its own tables.

Example:

Competition
↓

FauxStakesCompetition

PredictorCompetition

QuizCompetition

---

## 3. Engines are Plugins

Platform delegates behaviour.

```
Competition

↓

Registry

↓

Engine

↓

Game
```

---

## 4. Small Safe Refactors

No giant rewrites.

Every architectural improvement should be:

- Small
- Reviewable
- Deployable
- Independently testable

---

# Current Phase

## Phase 2B — Shared Platform Contracts

Status:

🟡 In Progress

Goal:

Polish the platform API before Predictor.

---

# Completed

## ✅ Phase 1A

Platform / Game separation

Completed:
- Competition ownership
- Registry
- Engine abstraction

---

## ✅ Phase 1B

Game configuration separation

Completed:
- FauxStakesCompetition
- Config service
- Platform cleanup

---

## ✅ Phase 2A

Engine contracts

Completed:
- Context objects
- Summary contracts
- Cleaner interfaces

---

# Roadmap

## Phase 2B

Shared platform contracts

Tasks

- [ ] Extract GameType
- [ ] Generic leaderboard contract
- [ ] Naming cleanup

---

## Phase 2C

Rename Game → Competition

---

## Phase 3

Predictor

---

## Phase 4

Frontend refactor

---

## Phase 5

Administration

---

## Phase 6

Additional games

Potential candidates

- Quiz
- Fantasy
- Draft
- Pick'em

---

# Backlog

High Priority

- Plugin discovery
- Competition events
- Stronger typing

Medium Priority

- Health checks
- Audit logging
- API versioning

Low Priority

- Public SDK
- Public API
- Webhooks

---

# Future Ideas

Things we like but intentionally aren't building yet.

- Mobile apps
- TV apps
- AI competition generation
- Live commentary