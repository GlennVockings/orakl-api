# Architecture

## Purpose

This document explains the conceptual architecture of Orakl.

It is written to help contributors understand how the platform is structured, where responsibilities belong and how future features should be added.

This document is intentionally framework-agnostic. It describes the architecture of the product rather than the implementation details of any specific technology.

---

# Architectural Summary

Orakl is a competitive game platform built around Competitions.

A Competition is the central organising concept of the platform. Users create Competitions, invite others to join, participate in Games and compete through Leaderboards.

Games provide the rules and mechanics that make a Competition playable.

The platform provides the shared infrastructure that connects users, competitions and games together.

---

# Core Structure

At a high level, Orakl is structured as:

```txt
Orakl Platform
│
├── Competitions
├── Users
├── Players
├── Invites
├── Leaderboards
├── Notifications
├── Achievements
│
└── Game Engines
    ├── Faux Stakes
    ├── Predictor
    └── Future Games
```

The platform is responsible for shared systems.

Game Engines are responsible for gameplay.

---

# Competition as the Centre

Competition is the driving force behind Orakl.

Every major user experience starts from or leads back to a Competition.

A Competition creates the context that makes games meaningful. It brings players together, gives them something to compete for and provides the structure through which rivalries develop over time.

Games are the fuel for competition, but Competition is the reason the platform exists.

---

# Platform Responsibilities

The Orakl platform owns shared functionality that applies across games.

Platform responsibilities include:

* Authentication
* Users
* User profiles
* Competitions
* Competition membership
* Invites
* Permissions
* Leaderboard presentation
* Notifications
* Achievements
* Game discovery
* Game availability

The platform acts as the hub that connects these systems together.

It should not implement game-specific business rules.

---

# Game Engine Responsibilities

A Game Engine owns the rules and behaviour of a specific Game.

Game Engine responsibilities may include:

* Scoring rules
* Gameplay validation
* Fixtures
* Teams
* Predictions
* Bets
* Markets
* Wallets
* Tournament logic
* Results
* Settlement
* Game-specific statistics
* Game-specific AI features

A Game Engine should be able to evolve independently without requiring changes to other Game Engines.

---

# Game Isolation

Games should be isolated by default.

A Game Engine should not need to know that another Game Engine exists.

This isolation reduces the risk of changes in one Game affecting another and makes it easier to add, maintain or temporarily disable games.

The platform may support enabling, disabling or maintaining games independently.

Future cross-game experiences are not ruled out, but they should be designed deliberately as platform-level features or composed experiences rather than by tightly coupling existing Game Engines.

---

# Adding New Games

New Games should be added by creating a new Game Engine and registering it with the platform.

Adding a new Game should not require modifying existing Game Engines.

The preferred model is:

```txt
Create Game Engine
Implement required contracts
Register Game Engine with platform
Expose game-specific API and client experience
```

This keeps new game development additive and reduces the risk of regressions in existing games.

---

# Shared vs Game-Specific Ownership

The following ownership rules apply.

| Feature                 | Ownership              |
| ----------------------- | ---------------------- |
| Authentication          | Platform               |
| Invites                 | Platform               |
| Notifications           | Platform               |
| Leaderboard display     | Platform               |
| Leaderboard calculation | Game Engine            |
| Wallets                 | Game Engine            |
| Teams                   | Game Engine            |
| Fixtures                | Game Engine            |
| AI                      | Game Engine by default |
| Statistics              | Game Engine by default |
| User Profiles           | Platform               |
| Achievements            | Platform               |

Ownership should be determined by whether the feature applies to the platform generally or exists to support a specific Game.

---

# Leaderboards

Leaderboards are shared at the presentation level but game-specific at the calculation level.

The platform owns the concept of showing a Leaderboard for a Competition.

The owning Game Engine determines:

* Score calculation
* Ranking logic
* Tie-break rules
* Score labels
* Relevant metrics

This allows all Competitions to have a consistent leaderboard experience without forcing all games to score players in the same way.

---

# AI Ownership

AI is not currently a core platform responsibility.

AI should be introduced where it provides clear value to a specific Game.

Examples include:

* Predictor analysis based on previous statistics
* Suggested predictions
* AI-controlled prediction competitors
* Market suggestions
* Odds suggestions
* Bet assistance

If an AI feature supports a specific Game, it belongs within or alongside that Game Engine.

If a future AI feature supports the whole platform, such as competition summaries or organiser assistance across all games, it may become a platform-level capability.

---

# Backend Model

Orakl uses one backend platform.

The backend owns:

* Business logic
* Authentication
* Data persistence
* Game Engines
* Validation
* Scoring
* Permissions

The backend is the source of truth for the platform.

There should not be separate backends per Game.

---

# Client Model

Orakl is designed to support multiple client applications.

Current and future clients may include:

* Web
* Mobile
* Television

Clients consume the same backend API.

Clients should not own business rules, scoring logic or game rules.

Their responsibility is to present platform and game experiences to users.

---

# Future Cross-Game Experiences

Games are isolated by default, but Orakl may support future experiences that combine multiple Games.

These should be designed as explicit platform features or new composed Game Engines.

Existing Game Engines should not become tightly coupled to support cross-game functionality.

This preserves isolation while allowing the product to evolve into richer competitive experiences.

---

# Architectural Rule

The platform connects competitions, users and games.

Game Engines make competitions playable.

When deciding where code belongs, contributors should ask:

```txt
Is this required by the Orakl platform, or is it part of how a specific Game is played?
```

If it is required by the platform, it belongs in the platform layer.

If it defines or enforces gameplay, it belongs in the owning Game Engine.
