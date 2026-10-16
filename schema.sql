-- MOA Community database setup
-- Run the entire file in Supabase Dashboard > SQL Editor.
-- Public posts/comments are readable by everyone. Writes are restricted to the owner.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(btrim(nickname)) between 2 and 18),
  bio text not null default '' check (char_length(bio) <= 180),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_nickname_chars check (nickname ~ '^[가-힣a-zA-Z0-9._-]+$')
);

-- Case-insensitive uniqueness, including nicknames with whitespace around them.
create unique index if not exists profiles_nickname_unique_ci
  on public.profiles (lower(btrim(nickname)));

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 90),
  content text not null check (char_length(btrim(content)) between 1 and 6000),
  image_url text,
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_user_id_idx on public.posts (user_id);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 1500),
  created_at timestamptz not null default now()
);

create index if not exists comments_post_id_created_at_idx on public.comments (post_id, created_at);
create index if not exists comments_user_id_idx on public.comments (user_id);

-- Automatically create a profile after an Auth user is created. The uniqueness rule
-- is enforced here too, not only by the website's form.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  picked_nickname text;
begin
  picked_nickname := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'nickname'), ''),
    'moa_' || left(new.id::text, 8)
  );
  insert into public.profiles (id, nickname)
  values (new.id, picked_nickname);
  return new;
exception when unique_violation then
  raise exception 'NICKNAME_TAKEN' using errcode = '23505';
end;
$$;

drop trigger if exists on_auth_user_created_moa on auth.users;
create trigger on_auth_user_created_moa
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at
before update on public.posts
for each row execute procedure public.set_updated_at();

-- Row Level Security is required because the app connects from a public browser.
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;

-- Profiles expose only nickname and bio to the app; email addresses remain in Auth.
drop policy if exists "Moa profiles are readable" on public.profiles;
create policy "Moa profiles are readable"
  on public.profiles for select to anon, authenticated
  using (true);

drop policy if exists "Members update their own profile" on public.profiles;
create policy "Members update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Posts can be read without an account. Owners can create, update and delete their posts.
drop policy if exists "Moa posts are readable" on public.posts;
create policy "Moa posts are readable"
  on public.posts for select to anon, authenticated
  using (true);

drop policy if exists "Members create their own posts" on public.posts;
create policy "Members create their own posts"
  on public.posts for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Members update their own posts" on public.posts;
create policy "Members update their own posts"
  on public.posts for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Members delete their own posts" on public.posts;
create policy "Members delete their own posts"
  on public.posts for delete to authenticated
  using (user_id = (select auth.uid()));

-- Comments are visible below public posts; a member can only create/delete their own.
drop policy if exists "Moa comments are readable" on public.comments;
create policy "Moa comments are readable"
  on public.comments for select to anon, authenticated
  using (true);

drop policy if exists "Members create their own comments" on public.comments;
create policy "Members create their own comments"
  on public.comments for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.posts where public.posts.id = post_id)
  );

drop policy if exists "Members delete their own comments" on public.comments;
create policy "Members delete their own comments"
  on public.comments for delete to authenticated
  using (user_id = (select auth.uid()));

-- Explicit grants work alongside RLS. Policies alone do not grant table privileges.
grant select on public.profiles to anon, authenticated;
grant update (nickname, bio) on public.profiles to authenticated;
grant select on public.posts to anon, authenticated;
grant insert, update, delete on public.posts to authenticated;
grant select on public.comments to anon, authenticated;
grant insert, delete on public.comments to authenticated;

-- Public bucket: images may be displayed in the feed. Uploads/deletes are restricted
-- to the signed-in member's own first-level folder (auth.uid()).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-images',
  'post-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Moa post images are publicly readable" on storage.objects;
create policy "Moa post images are publicly readable"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'post-images');

drop policy if exists "Members upload their own post images" on storage.objects;
create policy "Members upload their own post images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Members delete their own post images" on storage.objects;
create policy "Members delete their own post images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
