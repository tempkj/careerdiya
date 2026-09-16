# ADR-006: Single Coach agent + tools, not multi-agent

**Status:** Accepted

## Context
The first 100 users judge usefulness, not agent count.

## Decision
One agent, one prompt, five tools (twin/blueprint/planner/knowledge/outcome). Tools are the future agent seams. The Coach emits signals; it never writes the Twin.

## Consequences
Lower cost/complexity; graduate to multi-agent only when prompt maintainability or context limits force it.
