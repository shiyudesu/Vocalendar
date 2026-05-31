create table if not exists users (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  name text not null,
  settings jsonb not null default jsonb_build_object(
    'theme', 'system',
    'defaultView', 'week',
    'defaultReminderMinutes', 15,
    'voiceFeedback', true,
    'voiceSpeed', 1,
    'language', 'zh-CN'
  ),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_sessions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  refresh_token_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists events (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  title text not null,
  description text,
  start_time timestamptz not null,
  end_time timestamptz,
  all_day boolean not null default false,
  timezone text not null,
  location text,
  recurrence jsonb,
  priority text not null,
  tags jsonb not null default '[]'::jsonb,
  source text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists event_reminders (
  id text primary key,
  event_id text not null references events(id) on delete cascade,
  minutes_before integer not null,
  method text not null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists event_attendees (
  id text primary key,
  event_id text not null references events(id) on delete cascade,
  name text not null,
  email text,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists event_drafts (
  id text primary key,
  user_id text references users(id) on delete cascade,
  source text not null,
  source_text text not null,
  reference_at timestamptz not null,
  normalized_text text,
  parsed jsonb not null,
  missing_fields jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  can_save boolean not null default false,
  clarification_prompt text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists notifications (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  event_id text references events(id) on delete set null,
  title text not null,
  message text not null,
  time timestamptz not null,
  read boolean not null default false,
  snoozed_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists voice_history (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  kind text not null,
  provider text not null,
  language text not null,
  request_summary jsonb not null default '{}'::jsonb,
  result_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists realtime_outbox (
  id bigserial primary key,
  user_id text not null references users(id) on delete cascade,
  topic text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_sessions_user_id on user_sessions (user_id);
create index if not exists idx_events_user_id_start_time on events (user_id, start_time desc);
create index if not exists idx_events_user_id_updated_at on events (user_id, updated_at desc);
create index if not exists idx_event_reminders_event_id on event_reminders (event_id);
create index if not exists idx_event_attendees_event_id on event_attendees (event_id);
create index if not exists idx_event_drafts_user_id on event_drafts (user_id, updated_at desc);
create index if not exists idx_notifications_user_id_time on notifications (user_id, time desc);
create index if not exists idx_voice_history_user_id_created_at on voice_history (user_id, created_at desc);
create index if not exists idx_realtime_outbox_user_id_created_at on realtime_outbox (user_id, created_at desc);
