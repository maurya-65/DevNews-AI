-- DevNews v2 schema.
--
-- Paste into the Supabase SQL editor, or `supabase db push`. Safe to re-run: every
-- statement is IF NOT EXISTS / OR REPLACE / DROP ... IF EXISTS first.
--
-- Additive by design. The v1 tables (runs, items, verdicts, preferences) and the v1 views
-- are left exactly as they were, so nothing already stored is lost and rolling back is
-- just pointing the code at the old branch. They can be dropped once v2 has run for a
-- while; see the bottom of this file.
--
-- The shape, in one paragraph: the pipeline understands each article ONCE (articles,
-- mentions, analyses, threads — shared, and readable by anyone), and personal ranking
-- happens in code per reader (editions, edition_items — private). What a reader does
-- (saves, votes, events) feeds a learned taste table the ranker reads next morning. No
-- step makes a model call per user, so adding readers costs nothing.

-- ---------------------------------------------------------------------------------------
-- Pipeline bookkeeping
-- ---------------------------------------------------------------------------------------

create table if not exists sources (
  id                   text primary key,                -- 'hn', 'lobsters', 'arxiv', 'github', 'blogs'
  kind                 text not null check (kind in ('hn', 'lobsters', 'rss', 'arxiv', 'github')),
  name                 text not null,
  config               jsonb not null default '{}',
  quota                int  not null default 10 check (quota between 0 and 200),
  enabled              boolean not null default true,
  last_ok_at           timestamptz,
  last_error           text,
  consecutive_failures int  not null default 0,
  created_at           timestamptz not null default now()
);

create table if not exists pipeline_runs (
  id          bigserial primary key,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      text not null default 'running' check (status in ('running', 'ok', 'partial', 'failed')),
  stats       jsonb not null default '{}',
  error       text
);
create index if not exists pipeline_runs_started on pipeline_runs (started_at desc);

-- One row per stage per run, so the status page can say where a run spent its time and
-- which stage broke, instead of a single opaque error string.
create table if not exists run_stages (
  run_id      bigint not null references pipeline_runs(id) on delete cascade,
  stage       text not null,
  status      text not null check (status in ('ok', 'failed', 'skipped')),
  started_at  timestamptz not null,
  finished_at timestamptz not null,
  detail      jsonb not null default '{}',
  primary key (run_id, stage)
);

-- Every model call, kept for the free-tier budget: tokens per stage per day is the only
-- way to see a prompt change quietly doubling usage.
create table if not exists llm_calls (
  id            bigserial primary key,
  run_id        bigint references pipeline_runs(id) on delete cascade,
  stage         text not null,
  provider      text not null,
  model         text not null,
  ok            boolean not null,
  input_tokens  int,
  output_tokens int,
  latency_ms    int,
  error         text,
  created_at    timestamptz not null default now()
);
create index if not exists llm_calls_run on llm_calls (run_id);

-- ---------------------------------------------------------------------------------------
-- Shared editorial data
-- ---------------------------------------------------------------------------------------

-- One row per piece of writing, however many places linked to it. canonical_url is the
-- identity: the same post on HN and Lobsters is one article with two mentions.
create table if not exists articles (
  id            bigserial primary key,
  canonical_url text not null unique,
  url           text not null,
  domain        text not null,
  title         text not null,
  description   text,               -- what the source or the page's own metadata said
  excerpt       text,               -- the opening of the extracted article text, capped
  word_count    int,
  fetch_status  text not null default 'pending'
                check (fetch_status in ('pending', 'ok', 'skipped', 'failed', 'blocked')),
  published_at  timestamptz,
  first_seen_at timestamptz not null default now(),
  first_run_id  bigint references pipeline_runs(id) on delete set null,
  search        tsvector generated always as (
                  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                  setweight(to_tsvector('english', coalesce(description, '')), 'C')
                ) stored
);
create index if not exists articles_first_seen on articles (first_seen_at desc);
create index if not exists articles_search on articles using gin (search);

-- Where an article was linked, with that community's signal. Cross-posting is itself a
-- relevance signal, so duplicates are recorded here rather than thrown away.
create table if not exists mentions (
  id             bigserial primary key,
  article_id     bigint not null references articles(id) on delete cascade,
  source_id      text   not null references sources(id),
  external_id    text   not null,
  discussion_url text,
  points         int,
  comments       int,
  source_rank    int,
  tags           text[] not null default '{}',
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  run_id         bigint references pipeline_runs(id) on delete set null,
  unique (source_id, external_id)
);
create index if not exists mentions_article on mentions (article_id);

-- A story that develops over days. Created only when a second article joins it, so a
-- month of runs does not leave hundreds of one-article "threads".
create table if not exists threads (
  id               bigserial primary key,
  slug             text not null unique,
  title            text not null,
  summary          text,
  first_seen_at    timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  article_count    int not null default 0
);
create index if not exists threads_activity on threads (last_activity_at desc);

-- The model's reading of an article. Written once, used for every reader. Scores are the
-- model's; the quality number the ranker uses is computed in code from them.
create table if not exists analyses (
  article_id      bigint primary key references articles(id) on delete cascade,
  run_id          bigint references pipeline_runs(id) on delete set null,
  provider        text not null,
  model           text not null,
  is_cs           boolean not null,
  kind            text not null,
  topics          text[] not null default '{}',
  audience        text not null check (audience in ('newcomer', 'practitioner', 'expert')),
  novelty         numeric(3,1) not null check (novelty between 0 and 10),
  depth           numeric(3,1) not null check (depth between 0 and 10),
  impact          numeric(3,1) not null check (impact between 0 and 10),
  confidence      numeric(3,2) not null check (confidence between 0 and 1),
  summary         text not null,
  takeaway        text,
  thread_id       bigint references threads(id) on delete set null,
  thread_relation text check (thread_relation in ('opens', 'advances', 'reacts', 'context')),
  thread_hint     text,           -- the story name the model proposed, kept until a second article matches it
  analyzed_at     timestamptz not null default now(),
  search          tsvector generated always as (
                    setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
                    setweight(to_tsvector('english', coalesce(takeaway, '')), 'C')
                  ) stored
);
create index if not exists analyses_thread on analyses (thread_id);
create index if not exists analyses_topics on analyses using gin (topics);
create index if not exists analyses_search on analyses using gin (search);

-- ---------------------------------------------------------------------------------------
-- Readers
-- ---------------------------------------------------------------------------------------

-- profiles already exists (v1). v2 keeps level, select_count (edition size), min_score
-- (quality bar) and topics (explicit interests), and adds the rest.
alter table profiles add column if not exists muted_topics     text[]  not null default '{}';
alter table profiles add column if not exists muted_kinds      text[]  not null default '{}';
alter table profiles add column if not exists muted_domains    text[]  not null default '{}';
alter table profiles add column if not exists sources_off      text[]  not null default '{}';
alter table profiles add column if not exists include_general  boolean not null default false;
alter table profiles add column if not exists email_digest     boolean not null default false;
alter table profiles add column if not exists feed_token       uuid    not null default gen_random_uuid();
alter table profiles add column if not exists taste_updated_at timestamptz;
create unique index if not exists profiles_feed_token on profiles (feed_token);

-- Carry v1 choices across. Each statement is a set union, so re-running changes nothing.
update profiles set topics = array_replace(topics, 'career', 'practice')
where 'career' = any(topics);

update profiles p set muted_kinds = coalesce((
  select array_agg(distinct k) from unnest(p.muted_kinds || array(
    select case a when 'launches' then 'launch' when 'releases' then 'release' when 'listicles' then 'listicle' end
    from unnest(p.avoid) a)) k
  where k is not null), '{}')
where p.avoid && array['launches', 'releases', 'listicles'];

update profiles p set muted_topics = coalesce((
  select array_agg(distinct t) from unnest(p.muted_topics || array(
    select case a when 'business' then 'industry' when 'crypto' then 'crypto-web3' end
    from unnest(p.avoid) a)) t
  where t is not null), '{}')
where p.avoid && array['business', 'crypto'];

-- Learned preference weights, one per signal: 'topic:databases', 'kind:postmortem',
-- 'domain:jvns.ca', 'source:lobsters'. Written by the pipeline from events; never by
-- the reader directly.
create table if not exists taste (
  user_id    uuid not null references auth.users(id) on delete cascade,
  key        text not null,
  weight     numeric(4,3) not null default 0 check (weight between -1 and 1),
  evidence   int  not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

create table if not exists editions (
  id              bigserial primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  run_id          bigint references pipeline_runs(id) on delete set null,
  edition_date    date not null,
  status          text not null check (status in ('ok', 'quiet')),
  item_count      int  not null default 0,
  candidate_count int  not null default 0,
  emailed_at      timestamptz,             -- set once sent, so a rerun never emails twice
  created_at      timestamptz not null default now(),
  unique (user_id, edition_date)
);
create index if not exists editions_user_date on editions (user_id, edition_date desc);

-- Every candidate the reader was ranked against, not only the kept ones: `components`
-- is the score broken into its parts, which is what the lab page shows when a ranking
-- looks wrong.
create table if not exists edition_items (
  edition_id bigint not null references editions(id) on delete cascade,
  article_id bigint not null references articles(id) on delete cascade,
  user_id    uuid   not null references auth.users(id) on delete cascade,
  rank       int    not null,
  score      numeric(7,3) not null,
  selected   boolean not null,
  components jsonb  not null default '{}',
  why        text,
  primary key (edition_id, article_id)
);
create index if not exists edition_items_user_selected on edition_items (user_id, article_id) where selected;

create table if not exists saves (
  user_id    uuid   not null references auth.users(id) on delete cascade,
  article_id bigint not null references articles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, article_id)
);

create table if not exists votes (
  user_id    uuid     not null references auth.users(id) on delete cascade,
  article_id bigint   not null references articles(id) on delete cascade,
  value      smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (user_id, article_id)
);

-- Append-only. saves and votes hold current state for the UI; this holds what happened
-- and when, which is what learning needs.
create table if not exists events (
  id         bigserial primary key,
  user_id    uuid   not null references auth.users(id) on delete cascade,
  article_id bigint references articles(id) on delete cascade,
  kind       text   not null check (kind in ('open', 'hide', 'save', 'unsave', 'up', 'down', 'unvote')),
  created_at timestamptz not null default now()
);
create index if not exists events_user_time on events (user_id, created_at);

-- ---------------------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------------------

alter table sources       enable row level security;
alter table pipeline_runs enable row level security;
alter table run_stages    enable row level security;
alter table llm_calls     enable row level security;   -- no policies: service key only
alter table articles      enable row level security;
alter table mentions      enable row level security;
alter table threads       enable row level security;
alter table analyses      enable row level security;
alter table taste         enable row level security;
alter table editions      enable row level security;
alter table edition_items enable row level security;
alter table saves         enable row level security;
alter table votes         enable row level security;
alter table events        enable row level security;

-- Shared editorial data is public. None of it is personal, and a signed-out visitor
-- seeing real stories on the front page and thread pages is the product's best pitch.
do $$
declare t text;
begin
  foreach t in array array['sources', 'pipeline_runs', 'run_stages', 'articles', 'mentions', 'threads', 'analyses'] loop
    execute format('drop policy if exists "public read" on %I', t);
    execute format('create policy "public read" on %I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

-- Personal data: each reader sees only their own rows.
do $$
declare t text;
begin
  foreach t in array array['taste', 'editions', 'edition_items', 'saves', 'votes', 'events'] loop
    execute format('drop policy if exists "read own" on %I', t);
    execute format('create policy "read own" on %I for select to authenticated using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- What a reader may change themselves. Editions, edition_items and taste are written only
-- by the pipeline (service key), so they get no write policies.
drop policy if exists "insert own" on saves;
drop policy if exists "delete own" on saves;
create policy "insert own" on saves for insert to authenticated with check (auth.uid() = user_id);
create policy "delete own" on saves for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "insert own" on votes;
drop policy if exists "update own" on votes;
drop policy if exists "delete own" on votes;
create policy "insert own" on votes for insert to authenticated with check (auth.uid() = user_id);
create policy "update own" on votes for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own" on votes for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "insert own" on events;
create policy "insert own" on events for insert to authenticated with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------------------
-- Read models for the web app
-- ---------------------------------------------------------------------------------------

-- security_invoker so the caller's RLS applies. A view runs with its owner's rights by
-- default, which would bypass every policy above.
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

create or replace function search_articles(q text, max_results int default 30)
returns table (
  id bigint, title text, url text, domain text, summary text, kind text,
  topics text[], thread_slug text, first_seen_at timestamptz, rank real
)
language sql stable security invoker
set search_path = public
as $$
  select a.id, a.title, a.url, a.domain, an.summary, an.kind, an.topics, t.slug, a.first_seen_at,
         ts_rank(a.search || an.search, websearch_to_tsquery('english', q)) as rank
  from articles a
  join analyses an on an.article_id = a.id
  left join threads t on t.id = an.thread_id
  where (a.search || an.search) @@ websearch_to_tsquery('english', q)
  order by rank desc, a.first_seen_at desc
  limit least(greatest(max_results, 1), 100);
$$;
grant execute on function search_articles(text, int) to anon, authenticated;

-- ---------------------------------------------------------------------------------------
-- Retiring v1 (run by hand, later)
-- ---------------------------------------------------------------------------------------
-- Once v2 has produced editions for a week:
--   drop view if exists my_digest; drop view if exists my_runs;
--   drop table if exists verdicts; drop table if exists items; drop table if exists runs;
--   drop table if exists preferences;
--   alter table profiles drop column if exists avoid, drop column if exists profile,
--     drop column if exists hn_quota, drop column if exists lobsters_quota,
--     drop column if exists blogs_quota;
