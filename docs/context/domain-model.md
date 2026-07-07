# Domain Model

## Purpose

This document defines the core domain language used throughout Orakl.

It exists to ensure that developers, designers and AI assistants use consistent terminology when reasoning about the platform.

These definitions should guide naming across code, APIs, database models, documentation and user-facing language.

---

# Core Domain

## Orakl

Orakl is the platform that hosts competitive social games.

It provides the shared systems required to create, manage and participate in competitions while allowing individual games to define their own rules and gameplay.

---

## User

A User is a person with an Orakl account.

Users exist at the platform level and may participate in many competitions.

A User is not the same as a Player. A User becomes a Player when they join or participate in a specific Competition.

---

## Player

A Player is a User participating in a Competition.

The Player concept represents a user's involvement within a specific competitive context.

This distinction is important because a single User may participate in many competitions, potentially across different games.

---

## Competition

A Competition is a user-created experience that brings players together to compete within a single game.

Every Competition belongs to exactly one Game.

Competitions are designed primarily for multiplayer social play, but the platform does not need to prevent a user from creating or participating in a Competition alone.

A Competition provides the shared container for:

* Players
* Permissions
* Invites
* Status
* Leaderboards
* Game-specific data

---

## Game

A Game is a ruleset that defines how players compete.

Each Game owns its own gameplay logic, scoring rules and domain objects.

Examples of Games include:

* Faux Stakes
* Predictor

Games integrate with the Orakl platform through defined contracts rather than by placing game-specific logic inside shared platform services.

---

## Game Engine

A Game Engine is the implementation of a Game within the backend.

It is responsible for enforcing the rules of that Game.

A Game Engine may own:

* Scoring
* Predictions
* Bets
* Markets
* Fixtures
* Results
* Settlement
* Tournament logic
* Game-specific validation

The shared platform should communicate with Game Engines through defined interfaces.

---

# Competition Structure

## Template

A Template is a predefined configuration used to create a Competition.

Templates reduce setup effort by providing defaults, structure and automation.

A Template may define:

* Game
* Sport or activity type
* Tournament structure
* Teams or participants
* Fixtures
* Prediction type
* Scoring rules
* Display layout
* Locking rules
* Progression rules
* Automation rules

Templates are not merely collections of fixtures. They are competition definitions.

In future, Templates may also support AI-assisted analysis, suggested predictions or AI-controlled competitors.

---

## Tournament

A Tournament is the structure that organises a Competition.

Examples include:

* League
* Knockout
* Groups
* Groups and knockout
* Fixtures only

Not every Competition requires a Tournament.

Tournament logic belongs to the Game Engine or Template that requires it, not to the shared platform by default.

---

## Fixture

A Fixture is a scheduled event within a Competition.

In sports-based games, a Fixture usually represents a match between two sides.

Fixtures may be organised by a Tournament, displayed to Players and used as the basis for predictions, results or scoring.

Fixtures are game-specific and should not be assumed to exist for every Game.

---

## Team

A Team is a game-specific participant or side within a Competition.

Teams are not a universal platform concept because not every Game requires teams.

Where a Game requires teams, the owning Game Engine is responsible for defining how they are created, displayed and used.

---

# Scoring and Results

## Leaderboard

A Leaderboard ranks Players within a Competition.

Leaderboards are a shared platform concept because most games require a way to display standings.

However, Leaderboard calculation belongs to the owning Game Engine.

The platform may display Leaderboards, but the Game Engine determines the score, ordering and ranking rules.

---

## Result

A Result is the confirmed outcome of a Fixture, Market or Game-specific event.

Results are used by Game Engines to calculate scores, settle gameplay and update standings.

The meaning of a Result depends on the Game that owns it.

---

# Game-Specific Concepts

## Prediction

A Prediction is a Player's submitted guess about an outcome.

Predictions belong to games that require them.

The structure of a Prediction depends on the Game and Template being used.

For example, a sports prediction may include:

* Selected outcome
* Predicted score
* Predicted margin
* Bonus prediction data

---

## Market

A Market is a game-specific concept used by games where Players back an outcome from a set of selections.

Markets are not part of the shared platform.

They belong to the Game Engine that defines and settles them.

---

## Selection

A Selection is a possible outcome within a Market.

Selections are game-specific and should only exist within Game Engines that support market-based gameplay.

---

## Wallet

A Wallet is a game-specific balance used by games that require virtual currency.

Wallets are not part of the shared platform unless multiple games require a shared currency in the future.

---

# AI and Analysis

AI may become part of the Orakl experience in future.

Potential use cases include:

* Template-assisted setup
* Fixture analysis
* Suggested predictions
* AI competitors
* Competition summaries
* Player insights

AI features should support the core product goal of making competitions easier to organise and more engaging to play.

AI must not blur ownership boundaries. If AI supports a specific Game, it should be implemented within or alongside that Game Engine. If AI supports shared platform behaviour, it should live in the shared platform layer.

---

# Ownership Rules

The following ownership rules apply across the domain:

* Users belong to the platform.
* Competitions belong to the platform.
* Players exist within Competitions.
* Games define gameplay.
* Game Engines implement gameplay.
* Templates define Competition setup.
* Tournaments organise Competition structure when required.
* Teams are game-specific.
* Fixtures are game-specific.
* Leaderboards are displayed by the platform but calculated by the owning Game Engine.
* Predictions, Markets, Selections and Wallets belong to Game Engines.

These rules should guide future implementation decisions.
