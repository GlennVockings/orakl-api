# Engineering Principles

## Purpose

This document defines the architectural principles that govern the design and evolution of Orakl.

These principles exist to ensure that the platform grows consistently over time. Every architectural decision should align with these principles.

If a proposed implementation conflicts with one or more principles, the implementation should be reconsidered before proceeding.

---

# Principle 1 - Orakl is a Platform

Orakl is a competitive gaming platform, not a single game.

The platform is responsible for providing the shared infrastructure required for competitions, while individual games are responsible for implementing their own gameplay.

The platform should remain independent of any individual game.

---

# Principle 2 - Games Own Gameplay

Every game is responsible for its own business rules.

Examples include, but are not limited to:

* Scoring
* Predictions
* Betting
* Tournament logic
* Market settlement
* Progression rules

Shared platform services must never contain game-specific business logic.

---

# Principle 3 - Competitions are the Core Domain

Every playable experience within Orakl exists inside a Competition.

Competitions provide the shared experience that allows users to create, join and participate regardless of the game being played.

Games extend a Competition rather than replacing it.

---

# Principle 4 - Automation Over Administration

Administrative effort should be reduced wherever possible.

The platform should automate repetitive tasks such as:

* Score calculation
* Leaderboards
* Tournament progression
* Fixture management
* Competition state

Organisers should focus on running competitions rather than maintaining them.

---

# Principle 5 - Shared Before Specific

If functionality is useful to multiple games, it belongs within the shared platform.

If functionality exists solely for one game, it belongs within that game's implementation.

This separation keeps games independent while allowing the platform to grow.

---

# Principle 6 - API First

The backend is the source of truth.

All clients consume the same API regardless of platform.

Business rules, validation and data ownership belong to the backend.

Client applications are responsible only for presentation and user interaction.

---

# Principle 7 - Client Agnostic

Orakl should support multiple client applications without changing platform behaviour.

Current and future clients include:

* Web
* Mobile
* Television

No client should receive special treatment within the platform architecture.

---

# Principle 8 - Extensibility

The platform should be designed to support new games without requiring changes to existing games.

Adding a new game should be an additive process rather than a modification of existing implementations.

---

# Principle 9 - Clear Ownership

Every feature should have a clear owner.

Ownership should be obvious from the project structure.

Examples include:

* Platform
* Authentication
* Competition
* Individual Game
* Shared Infrastructure

Features should not exist between boundaries.

---

# Principle 10 - Consistency Over Convenience

Architectural consistency is more valuable than short-term convenience.

Small compromises made repeatedly create unnecessary complexity over time.

Where possible, existing patterns should be followed rather than introducing exceptions.

---

# Decision Making

When implementing a new feature, contributors should consider the following questions before writing code:

1. Does this belong to the platform or to a game?
2. Does this functionality already exist elsewhere?
3. Will another game be able to reuse this?
4. Does this increase or reduce administrative effort?
5. Does this follow the established architecture?

If the answer to any of these questions is unclear, the implementation should be reconsidered before development begins.
