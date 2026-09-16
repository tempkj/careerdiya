# @careerasana/shared (reserved)

Home for **domain primitives** shared across modules: branded ID types, enum mirrors of the DB
controlled vocabulary, value objects (Confidence, etc.), and common validation. Modules import from
here instead of reaching across each other (reinforces invariant A1).

Deliberately **empty** until a second real consumer exists — an empty shared package becomes a junk
drawer. Reserve the location; add contents when duplication actually appears.
