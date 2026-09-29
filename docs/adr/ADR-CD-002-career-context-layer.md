# ADR-CD-002 — Career Context as the Persistent Context Layer

**Status:** Proposed  
**Date:** 29 Sep 2026

## Decision

Career Diya's profile is the persistent **Career Context Layer** for the entire product, not merely a settings/profile form.

Explorer, Career Vault, Career Library, CareerAsana handoff, recommendations, learning guidance, dashboard and the future advisor should consume the same resolved career context instead of independently interpreting profile fields.

### Context hierarchy

1. **Persistent profile context** — durable facts explicitly supplied or confirmed by the user.
2. **Career history / background** — education, experience and knowledge records.
3. **Persistent career state** — active goals, directions, interests and Vault items.
4. **Current exploration context** — answers or temporary corrections for this exploration.
5. **Entry-point context** — e.g. a Vault thought, selected Career Library career, or handoff.
6. **Derived context** — deterministic inferences such as professional stage from experience.
7. **AI suggestions** — advisory only; never silently overwrite persistent context or make a canonical choice without user confirmation.

### Resolution rule

> Known → reuse it.  
> Uncertain or stale → surface it for confirmation.  
> Unknown → ask.  
> User correction during an exploration → use it for that exploration without silently mutating the persistent profile.

## Profile model

The profile editor should be organized around the information the rest of Career Diya actually needs.

### 1. Career identity & current context

- audience: parent / student / professional
- current career stage
- current / most recent role
- role family
- industry
- experience
- location / country where relevant

### 2. Education & background

- education records
- fields of study
- institutions
- graduation/current-study state
- experience / knowledge streams
- role family and duration for each stream

### 3. Career direction

- interests
- goals
- active career directions
- paused / historical directions remain available

### 4. Capabilities & preferences

- strengths
- development areas
- learning preferences
- constraints/preferences when supported

The profile editor is an input surface; it is not the decision engine.

## Dashboard role

The dashboard becomes a **Career Workspace / context summary**, not a second profile editor.

It should show:

- current context at a glance
- active career direction(s)
- current exploration state
- important Vault thoughts
- recommended next action
- context freshness/completeness where useful

It should not claim "Profile 100%" merely because an exploration has been completed.

## Explorer integration

Explorer receives a resolved context object and an adaptive question plan.

For each conceptual signal:

- known value → prefilled/skipped
- uncertain value → confirmation
- missing value → question

The seven conceptual signals remain stable for the decision engine; the UI no longer requires seven visible questions for every user.

## Separation of durable and temporary state

Persistent profile data must never be overwritten merely because a user changes an answer during an exploration.

Example:

Profile:
- audience = professional
- current role = Application Engineer

Exploration:
- user changes stage to mid-career

The exploration uses mid-career; the profile remains unchanged unless the user explicitly edits/saves the profile.

## Implementation direction

Introduce a reusable CareerContextResolver before page-specific logic:

    Persistent Profile
          +
       Background
          +
    Career State / Vault
          +
      Entry Context
          +
     User Corrections
          ↓
    Resolved Career Context
          ↓
    Adaptive Question Planner
          ↓
    Decision / Recommendation / Handoff

The resolver should be deterministic for known profile facts. AI may enrich ambiguous free text or suggest mappings, but AI does not own canonical profile state.

## Immediate implications

- Fix profile persistence before further Explorer intelligence work.
- Make profile save/read authoritative from `core.profile` and related background tables.
- Remove stale localStorage audience as an authority.
- Ensure every Explorer entry path uses the context resolver.
- Expose audience/stage as editable persistent context rather than hiding it in URL/localStorage.
- Preserve raw user-entered role/career language even when a role-family/canonical mapping is unavailable.
- Keep historical explorations immutable snapshots.

## Non-goals

This ADR does not introduce a complete career ontology, memory graph, AI career agent, or new recommendation algorithm. It establishes the persistent context contract those later capabilities can consume.
