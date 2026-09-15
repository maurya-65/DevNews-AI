# Legacy design documents

The v0 and v1 designs, kept for the reasoning they record. None of this describes the
running system — see `docs/ARCHITECTURE.md` and `supabase/migrations/` for that.

- `pipeline.md`, `schema.sql` — the original v1 target design (embeddings, deep pass).
- `schema-v0*.sql` — the single-user v0 schema and its patches.
- `schema-v1-multiuser.sql` — v1's per-user verdicts; superseded by the v2 migration.
