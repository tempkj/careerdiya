# Event contracts (reserved)

OpenAPI is not the only contract. **Event schemas are contracts too.** The MVP is deliberately
synchronous (Blueprint §4: 8 events, in-process reactions, no bus), so formal event schemas are not
load-bearing yet. Author them here when:
- the event-driven architecture lands (Blueprint §11.4), or
- the `user_event` / activity stream arrives (DB §12 / API roadmap §12).
Each event gets a versioned JSON Schema; the envelope follows the Blueprint event contract.
