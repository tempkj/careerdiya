# Prompt contracts (reserved pointer)

The prompt **templates** live in `packages/prompts/` (first-class artifacts). This folder is for the
prompt **contract** view when needed: the registry index (version → purpose → model → file → hash)
that the DB seed (migration step 16) and `prompt_registry` consume. Generate from packages/prompts.
