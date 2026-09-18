-- ---------------------------------------------------------------------------------------
-- DevNews v2.1 — what an article is built on, and what the reader works with
--
-- Additive and re-runnable: nothing is dropped except the read-model view, which is
-- recreated below with one more column. Existing analyses keep an empty technologies
-- array until they are re-analysed; ranking treats that as "no stack signal", never as a
-- mismatch, so editions carry on working while the backfill runs.
--
-- The vocabulary itself lives in web/src/lib/taxonomy.json. Ids are stored here, so they
-- are added, never renamed.
-- ---------------------------------------------------------------------------------------

-- What the model read the article to be about, folded onto known ids where it could be.
alter table analyses add column if not exists technologies text[] not null default '{}';
create index if not exists analyses_technologies on analyses using gin (technologies);

-- The reader's own answers, collected during onboarding and editable afterwards.
alter table profiles add column if not exists technologies       text[] not null default '{}';
alter table profiles add column if not exists muted_technologies text[] not null default '{}';
-- What they do: one of the roles offered in onboarding. Free text is never stored here.
alter table profiles add column if not exists role               text;
-- Their own words, at most 150 of them, kept verbatim so it can be shown back and edited.
alter table profiles add column if not exists interest_text      text;
-- What the model made of those words: the ids it proposed and which the reader kept, so
-- the interpretation can be explained later without asking a model again.
alter table profiles add column if not exists interest_profile   jsonb  not null default '{}'::jsonb;
alter table profiles add column if not exists interest_read_at   timestamptz;
-- Null until onboarding is finished: the site sends a reader without it back to set up.
alter table profiles add column if not exists onboarded_at       timestamptz;

-- ---------------------------------------------------------------------------------------
-- Read model, recreated with technologies
-- ---------------------------------------------------------------------------------------

-- security_invoker so the caller's RLS applies, exactly as in the v2 migration.
drop view if exists article_cards;
create view article_cards with (security_invoker = true) as
select a.id,
       a.url,
       a.domain,
       a.title,
       a.description,
       a.word_count,
       a.published_at,
       a.first_seen_at,
       an.summary,
       an.takeaway,
       an.kind,
       an.topics,
       an.technologies,
       an.audience,
       an.novelty,
       an.depth,
       an.impact,
       an.confidence,
       an.is_cs,
       an.thread_id,
       an.thread_relation,
       t.slug  as thread_slug,
       t.title as thread_title,
       coalesce((
         select jsonb_agg(jsonb_build_object(
                  'source', m.source_id, 'url', m.discussion_url,
                  'points', m.points, 'comments', m.comments)
                order by m.points desc nulls last)
         from mentions m where m.article_id = a.id
       ), '[]'::jsonb) as mentions
from articles a
join analyses an on an.article_id = a.id
left join threads t on t.id = an.thread_id;
