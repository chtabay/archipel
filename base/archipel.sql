-- L’archipel : la base de l’archipel partagé, telle qu’elle est dans le projet Supabase de Pyramides
-- (migration « archipel_iles_partagees »). Gardée ici pour la lire et pouvoir la recréer ; rien ne l’applique tout seul.
-- Le site n’y accède que par les trois fonctions publiques, avec la clé publique de serveur.js.

-- L’archipel : les îles partagées, dans un espace à part de la base, sans aucun lien avec Pyramides.
-- On n’y garde que la forme visible de chaque île : jamais un texte, une case, une date, un nom ni une adresse.
-- On n’y entre que par trois fonctions publiques : poser une île ou la faire grandir, lire l’archipel, retirer son île.

create schema if not exists archipel;
comment on schema archipel is 'L’archipel : la forme des îles partagées. Jamais un texte, une case, une date, un nom ni une adresse.';
revoke all on schema archipel from public, anon, authenticated;

create sequence if not exists archipel.rangs; -- l’ordre des arrivées et des croissances, à la place d’une date
revoke all on sequence archipel.rangs from public, anon, authenticated;

create table if not exists archipel.iles (
  id uuid primary key default gen_random_uuid(),
  rang bigint not null,
  jeton bytea not null,   -- l’empreinte du jeton secret gardé sur le téléphone : lui seul peut faire grandir ou retirer l’île
  forme jsonb not null,   -- ce que les autres voient
  x real not null,        -- sa place dans l’archipel
  z real not null
);
create index if not exists iles_rang on archipel.iles (rang desc);
alter table archipel.iles enable row level security; -- aucune politique : on ne passe que par les fonctions
revoke all on archipel.iles from public, anon, authenticated;

create table if not exists archipel.debit (minute bigint primary key, n integer not null); -- un garde-fou contre les rafales, sans rien sur personne
alter table archipel.debit enable row level security;
revoke all on archipel.debit from public, anon, authenticated;

-- un nombre JSON entre deux bornes ; entier si demandé
create or replace function archipel.nombre(j jsonb, mini numeric, maxi numeric, entier boolean default false) returns boolean
language plpgsql immutable set search_path = '' as $$
declare v numeric;
begin
  if j is null or jsonb_typeof(j) <> 'number' then return false; end if;
  v := (j #>> '{}')::numeric;
  return v between mini and maxi and (not entier or v = trunc(v));
end $$;

-- une case de l’île : deux entiers de 0 à 9
create or replace function archipel.case_valide(j jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
begin
  if j is null or jsonb_typeof(j) <> 'array' then return false; end if;
  if jsonb_array_length(j) <> 2 then return false; end if;
  return archipel.nombre(j -> 0, 0, 9, true) and archipel.nombre(j -> 1, 0, 9, true);
end $$;

-- la forme d’une île : seulement ce que la 3D dessine, et rien d’autre
create or replace function archipel.forme_valide(f jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare c jsonb; e text;
begin
  if f is null or jsonb_typeof(f) <> 'object' then return false; end if;
  if octet_length(f::text) > 16000 then return false; end if;
  if exists (select 1 from jsonb_object_keys(f) k where k not in ('paysage', 'graine', 'taille', 'climat', 'phare', 'choses')) then return false; end if;
  if coalesce(f ->> 'paysage', '') not in ('prairie', 'automne', 'tropique', 'neige', 'lande') then return false; end if;
  if coalesce(f ->> 'climat', '') not in ('N', 'AS', 'ES', 'AD', 'ED') then return false; end if;
  if not archipel.nombre(f -> 'graine', 1, 2147483647, true) then return false; end if;
  if not archipel.nombre(f -> 'taille', 1, 100, true) then return false; end if;
  if f ? 'phare' and jsonb_typeof(f -> 'phare') <> 'null' then
    if not archipel.case_valide(f -> 'phare') then return false; end if;
  end if;
  if jsonb_typeof(f -> 'choses') is distinct from 'array' then return false; end if;
  if jsonb_array_length(f -> 'choses') > 80 then return false; end if;
  for c in select value from jsonb_array_elements(f -> 'choses') loop
    if jsonb_typeof(c) <> 'object' then return false; end if;
    if exists (select 1 from jsonb_object_keys(c) k where k not in ('famille', 'espece', 'stade', 'case', 'etats', 'textes', 'v')) then return false; end if;
    if coalesce(c ->> 'famille', '') not in ('arbre', 'pierre', 'maison', 'culture', 'meteo', 'caillou') then return false; end if;
    if coalesce(c ->> 'espece', '') not in ('pin', 'nu', 'feuillu', 'fleuri', 'sombre', 'moussue', 'cairn', 'galet', 'pierre', 'cloture', 'volets', 'pont', 'banc', 'maison', 'feu', 'puits', 'champ', 'barque', 'orage', 'pluie', 'fleurs', 'etang', 'caillou') then return false; end if;
    if not archipel.nombre(c -> 'stade', 0, 3, true) then return false; end if;
    if not archipel.nombre(c -> 'textes', 0, 3, true) then return false; end if;
    if not archipel.nombre(c -> 'v', 0, 1) then return false; end if;
    if not archipel.case_valide(c -> 'case') then return false; end if;
    if jsonb_typeof(c -> 'etats') is distinct from 'array' then return false; end if;
    if jsonb_array_length(c -> 'etats') > 9 then return false; end if;
    for e in select value from jsonb_array_elements_text(c -> 'etats') loop
      if e not in ('ferme', 'lueur', 'boucle', 'double', 'pluie', 'mousse', 'fissure', 'caillou', 'clos') then return false; end if;
    end loop;
  end loop;
  return true;
end $$;

-- poser une île dans l’archipel, ou la faire grandir avec son jeton
create or replace function public.archipel_poser(p_jeton text, p_forme jsonb, p_x real default null, p_z real default null, p_ile uuid default null)
returns table (ile uuid, ordre bigint)
language plpgsql security definer set search_path = '' as $$
declare
  empreinte bytea;
  minute_ bigint := floor(extract(epoch from clock_timestamp()) / 60);
  compte integer;
  r bigint;
  i uuid;
begin
  if p_jeton is null or p_jeton !~ '^[0-9a-f]{64}$' then raise exception 'jeton invalide'; end if;
  if not archipel.forme_valide(p_forme) then raise exception 'forme invalide'; end if;
  empreinte := extensions.digest(p_jeton, 'sha256');
  if p_ile is null then
    if p_x is null or p_z is null or abs(p_x) > 40 or abs(p_z) > 60 then raise exception 'place invalide'; end if;
    insert into archipel.debit as d (minute, n) values (minute_, 1)
      on conflict (minute) do update set n = d.n + 1 returning d.n into compte;
    delete from archipel.debit where minute < minute_ - 10;
    if compte > 30 then raise exception 'l’archipel reçoit trop d’îles en ce moment'; end if;
    r := nextval('archipel.rangs');
    insert into archipel.iles (rang, jeton, forme, x, z) values (r, empreinte, p_forme, p_x, p_z) returning id into i;
  else
    r := nextval('archipel.rangs');
    update archipel.iles set forme = p_forme, rang = r where id = p_ile and jeton = empreinte returning id into i;
    if i is null then raise exception 'île inconnue'; end if;
  end if;
  return query select i, r;
end $$;

-- lire l’archipel : les îles les plus récentes, ou celles arrivées et grandies depuis un rang
create or replace function public.archipel_lire(p_depuis bigint default 0, p_limite integer default 60)
returns table (ile uuid, ordre bigint, forme jsonb, x real, z real, total bigint)
language sql stable security definer set search_path = '' as $$
  select i.id, i.rang, i.forme, i.x, i.z, (select count(*) from archipel.iles)
  from archipel.iles i
  where i.rang > coalesce(p_depuis, 0)
  order by i.rang desc
  limit least(greatest(coalesce(p_limite, 60), 1), 150)
$$;

-- retirer son île, avec son jeton
create or replace function public.archipel_retirer(p_ile uuid, p_jeton text)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_ile is null or p_jeton is null or p_jeton !~ '^[0-9a-f]{64}$' then return false; end if;
  delete from archipel.iles where id = p_ile and jeton = extensions.digest(p_jeton, 'sha256');
  return found;
end $$;

revoke all on function archipel.nombre(jsonb, numeric, numeric, boolean) from public, anon, authenticated;
revoke all on function archipel.case_valide(jsonb) from public, anon, authenticated;
revoke all on function archipel.forme_valide(jsonb) from public, anon, authenticated;
revoke all on function public.archipel_poser(text, jsonb, real, real, uuid) from public, anon, authenticated;
revoke all on function public.archipel_lire(bigint, integer) from public, anon, authenticated;
revoke all on function public.archipel_retirer(uuid, text) from public, anon, authenticated;
grant execute on function public.archipel_poser(text, jsonb, real, real, uuid) to anon, authenticated;
grant execute on function public.archipel_lire(bigint, integer) to anon, authenticated;
grant execute on function public.archipel_retirer(uuid, text) to anon, authenticated;
comment on function public.archipel_poser(text, jsonb, real, real, uuid) is 'L’archipel : poser une île, ou la faire grandir avec son jeton. Seulement sa forme.';
comment on function public.archipel_lire(bigint, integer) is 'L’archipel : les îles les plus récentes, ou celles arrivées et grandies depuis un rang.';
comment on function public.archipel_retirer(uuid, text) is 'L’archipel : retirer son île, avec son jeton.';
