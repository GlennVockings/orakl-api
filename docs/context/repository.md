# Repository Structure

## Purpose

This document defines how the Orakl codebase is organised and why each repository exists.

The goal of this structure is to keep responsibilities clearly separated, reduce coupling between projects and allow each platform to evolve independently while sharing a common backend.

Repository boundaries are architectural boundaries. A repository should own a single responsibility and should not depend on implementation details from another repository.

---

# Philosophy

Orakl is organised by **platform**, not by **game**.

Games are features of the Orakl platform.

Repositories represent deployment targets and technical responsibilities.

This approach allows new games to be introduced without creating additional repositories while allowing new client applications to be developed independently.

---

# Repository Overview

The Orakl platform is organised into multiple repositories.

```text
Orakl

├── orakl-api
├── orakl-web
├── orakl-mobile      (future)
├── orakl-tv          (future)
└── other platform clients...
```

Each repository has a clearly defined responsibility.

---

# orakl-api

The API is the heart of the Orakl platform.

It owns every piece of business logic and acts as the single source of truth for all clients.

Responsibilities include:

* Authentication
* User management
* Competition management
* Game Engine execution
* Templates
* Leaderboards
* Invitations
* Notifications
* Validation
* Database access
* API contracts
* Real-time communication

The API is responsible for determining **what happens**.

Client applications should never reimplement business rules owned by the API.

---

# orakl-web

The web application is a client of the Orakl API.

Its responsibility is to present platform functionality to users through a browser.

Responsibilities include:

* User interface
* Navigation
* Forms
* Visualisation
* User interaction
* Consuming platform APIs

The web application should not own business rules or database access.

---

# Future Clients

Future clients should follow the same model.

Examples include:

## orakl-mobile

Provides a native mobile experience while consuming the same platform API.

## orakl-tv

Provides a television experience while consuming the same platform API.

Both clients should reuse the same backend functionality rather than implementing their own business rules.

---

# Why Repositories are Split

Repositories are separated to achieve several goals.

## Independent Development

Frontend and backend can evolve independently.

Changes to one platform should not unnecessarily impact another.

---

## Platform Focus

Each repository has a single responsibility.

Developers can focus on solving problems within one platform without navigating unrelated code.

---

## Technology Independence

Each repository may evolve independently.

For example:

* The frontend may migrate frameworks.
* The backend may adopt new infrastructure.
* Mobile may use completely different technologies.

These changes should not require large-scale changes across the entire project.

---

## Future Scalability

As Orakl grows, additional client applications can be introduced without changing the architecture.

Examples include:

* Mobile applications
* Television applications
* Desktop applications
* Third-party integrations

All consume the same platform API.

---

# Repository Responsibilities

## Backend Owns

The backend owns:

* Authentication
* Business logic
* Validation
* Database
* Game Engines
* Competition lifecycle
* Scoring
* Real-time events
* Permissions

---

## Frontend Owns

Frontend applications own:

* User experience
* Navigation
* Presentation
* User interaction
* API consumption
* Local interface state

---

## Frontends Must Not Own

Frontend applications must not own:

* Business rules
* Database access
* Game scoring
* Competition validation
* Permission rules
* Authentication logic
* Game Engine implementation

---

# Communication

Clients communicate with the platform exclusively through the Orakl API.

```text
Web
        │
Mobile  │
        │
TV      │
        ▼

───────────────
  Orakl API
───────────────

        │

Database
Game Engines
Authentication
Real-time
```

Clients should never communicate directly with the database or rely on implementation details inside another repository.

---

# Shared Behaviour

Although multiple client applications may exist, users should experience consistent platform behaviour.

For example:

* Competition rules should produce identical outcomes regardless of client.
* Leaderboards should be consistent across every platform.
* Authentication should behave identically on every client.
* Game Engines should calculate results once within the backend.

This ensures there is only one source of truth for platform behaviour.

---

# Repository Evolution

New repositories should only be introduced when they represent a new platform or deployment target.

Examples include:

* Mobile application
* Television application
* Public SDK
* Administrative portal

Repositories should **not** be created for individual games.

Games are implemented as Game Engines within the platform rather than independent applications.

---

# Architectural Rule

When introducing new functionality, contributors should first determine which repository owns the responsibility.

The guiding question is:

> **Which platform is responsible for this behaviour?**

If the answer is:

* Business logic → `orakl-api`
* Presentation or user interaction → Client application
* Gameplay rules → Game Engine within `orakl-api`

Maintaining these boundaries ensures Orakl remains scalable, maintainable and capable of supporting new games and client platforms without unnecessary complexity.
