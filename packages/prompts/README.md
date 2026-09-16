# @careerasana/prompts

Prompt templates as **first-class, versioned artifacts** — the missing half of a decision already
in the contract: `prompt_registry.template_ref` points at a file here, and `template_hash` is the
hash of that file. `generation_meta.promptVersion` on every AI artifact (Blueprint, CoachTurn,
Recommendation) is an FK to a registry row whose template lives here.

## Layout
```
prompts/
├─ coach/           # coach-prompt/vN
├─ activation/      # activation gap+first-action generation
├─ blueprint/       # blueprint-gen/vN
├─ recommendation/  # recommendation rationale
└─ shared/          # system preamble, safety, human-agency framing, output-schema fragments
```

## Rules (governance — like DB migrations)
- A prompt version is **immutable** once published; a change is a new version (e.g. `coach/v4.md`),
  never an in-place edit. Mirrors `readiness_spec` discipline (DB v1.3, A13).
- The registry seed (DB migration step 16) references the version id + file path + hash.
- Treat prompt diffs in review like schema diffs: they change model behavior.
