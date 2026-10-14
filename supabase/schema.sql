-- AdmitTwo schema
-- Run this in the Supabase SQL editor after creating a project.
-- The browser only uses the anon key. Do not put the service role key in the app.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  manage_token_hash text not null,
  sender_name text not null,
  recipient_name text,
  title text not null,
  event_date date not null,
  event_time text not null,
  location text,
  message text not null,
  note text,
  audio_path text,
  audio_duration numeric(6, 2),
  rsvp_status text not null default 'pending' check (rsvp_status in ('pending', 'accepted', 'declined')),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  constraint invitations_public_id_format check (public_id ~ '^[A-Za-z0-9_-]{8,40}$'),
  constraint invitations_sender_len check (char_length(sender_name) between 1 and 60),
  constraint invitations_title_len check (char_length(title) between 1 and 80),
  constraint invitations_message_len check (char_length(message) between 1 and 500)
);

create index if not exists invitations_public_id_idx on public.invitations (public_id);

alter table public.invitations enable row level security;
revoke all on table public.invitations from anon, authenticated;

create or replace function public.create_invitation(
  p_public_id text,
  p_manage_token text,
  p_sender_name text,
  p_recipient_name text,
  p_title text,
  p_event_date date,
  p_event_time text,
  p_location text,
  p_message text,
  p_note text
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  if p_public_id is null or p_public_id !~ '^[A-Za-z0-9_-]{8,40}$' then
    raise exception 'The invitation id is not valid.';
  end if;
  if p_manage_token is null or char_length(p_manage_token) < 16 then
    raise exception 'The sender key is not valid.';
  end if;
  if p_sender_name is null or char_length(btrim(p_sender_name)) not between 1 and 60 then
    raise exception 'Add your name.';
  end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 80 then
    raise exception 'Give the invitation a title.';
  end if;
  if p_message is null or char_length(btrim(p_message)) not between 1 and 500 then
    raise exception 'Write a short invitation.';
  end if;
  if p_event_date is null or p_event_time is null or p_event_time !~ '^\d{2}:\d{2}(:\d{2})?$' then
    raise exception 'Choose a date and time.';
  end if;

  v_hash := encode(extensions.digest(p_manage_token, 'sha256'), 'hex');

  insert into public.invitations (
    public_id, manage_token_hash, sender_name, recipient_name, title,
    event_date, event_time, location, message, note
  ) values (
    p_public_id,
    v_hash,
    btrim(p_sender_name),
    nullif(btrim(coalesce(p_recipient_name, '')), ''),
    btrim(p_title),
    p_event_date,
    p_event_time,
    nullif(btrim(coalesce(p_location, '')), ''),
    btrim(p_message),
    nullif(btrim(coalesce(p_note, '')), '')
  );

  return jsonb_build_object('public_id', p_public_id);
end;
$$;

create or replace function public.attach_audio(
  p_public_id text,
  p_manage_token text,
  p_audio_path text,
  p_audio_duration numeric
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  v_hash := encode(extensions.digest(p_manage_token, 'sha256'), 'hex');
  if p_audio_path is null or p_audio_path !~ ('^' || p_public_id || '/[A-Za-z0-9._-]+$') then
    raise exception 'The voice message couldn’t be attached.';
  end if;

  update public.invitations
  set audio_path = p_audio_path,
      audio_duration = p_audio_duration
  where public_id = p_public_id
    and manage_token_hash = v_hash;

  if not found then
    raise exception 'The voice message couldn’t be attached.';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.invitation_json(rec public.invitations)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'public_id', rec.public_id,
    'sender_name', rec.sender_name,
    'recipient_name', rec.recipient_name,
    'title', rec.title,
    'event_date', rec.event_date,
    'event_time', rec.event_time,
    'location', rec.location,
    'message', rec.message,
    'note', rec.note,
    'audio_path', rec.audio_path,
    'audio_duration', rec.audio_duration,
    'rsvp_status', rec.rsvp_status,
    'responded_at', rec.responded_at,
    'created_at', rec.created_at
  );
$$;

create or replace function public.get_invitation(p_public_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.invitations;
begin
  select * into v_row from public.invitations where public_id = p_public_id;
  if not found then
    return null;
  end if;
  return public.invitation_json(v_row);
end;
$$;

create or replace function public.get_managed_invitation(p_public_id text, p_manage_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row public.invitations;
  v_hash text;
begin
  v_hash := encode(extensions.digest(coalesce(p_manage_token, ''), 'sha256'), 'hex');
  select * into v_row
  from public.invitations
  where public_id = p_public_id
    and manage_token_hash = v_hash;
  if not found then
    return null;
  end if;
  return public.invitation_json(v_row);
end;
$$;

create or replace function public.respond_invitation(p_public_id text, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.invitations;
begin
  if p_status not in ('accepted', 'declined') then
    raise exception 'Choose accept or decline.';
  end if;

  update public.invitations
  set rsvp_status = p_status,
      responded_at = now()
  where public_id = p_public_id
    and rsvp_status = 'pending'
  returning * into v_row;

  if not found then
    select * into v_row from public.invitations where public_id = p_public_id;
    if not found then
      return null;
    end if;
  end if;

  return public.invitation_json(v_row);
end;
$$;

revoke all on function public.create_invitation(text, text, text, text, text, date, text, text, text, text) from public;
revoke all on function public.attach_audio(text, text, text, numeric) from public;
revoke all on function public.get_invitation(text) from public;
revoke all on function public.get_managed_invitation(text, text) from public;
revoke all on function public.respond_invitation(text, text) from public;
revoke all on function public.invitation_json(public.invitations) from public, anon, authenticated;

grant execute on function public.create_invitation(text, text, text, text, text, date, text, text, text, text) to anon, authenticated;
grant execute on function public.attach_audio(text, text, text, numeric) to anon, authenticated;
grant execute on function public.get_invitation(text) to anon, authenticated;
grant execute on function public.get_managed_invitation(text, text) to anon, authenticated;
grant execute on function public.respond_invitation(text, text) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'invitation-audio',
  'invitation-audio',
  true,
  2097152,
  array['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-m4a', 'audio/aac']
)
on conflict (id) do update
set public = true,
    file_size_limit = 2097152;

drop policy if exists "AdmitTwo upload audio" on storage.objects;
create policy "AdmitTwo upload audio"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'invitation-audio'
  and (storage.foldername(name))[1] is not null
);
