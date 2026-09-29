-- L’archipel : la base de l’archipel partagé, telle qu’elle est dans le projet Supabase de Pyramides
-- (migrations « archipel_iles_partagees », puis « archipel_familles_animaux_buissons » pour les animaux et les buissons,
-- « archipel_etat_commis » pour la petite pierre de ce que tu as fait, « archipel_routes » pour les routes entre les îles,
-- et « archipel_deplacer » pour qu’une île reste à côté d’une autre des siennes).
-- Gardée ici pour la lire et pouvoir la recréer ; rien ne l’applique tout seul.
-- Le site n’y accède que par ses fonctions publiques, avec la clé publique de serveur.js.

-- L’archipel : les îles partagées, dans un espace à part de la base, sans aucun lien avec Pyramides.
-- On n’y garde que la forme visible de chaque île : jamais un texte, une case, une date, un nom ni une adresse.
-- On n’y entre que par des fonctions publiques : poser une île ou la faire grandir, lire l’archipel, retirer son île ;
-- et pour les routes : partager son île par un lien, voir l’île d’un lien, tracer une route, la couper, lire les routes.

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
    if coalesce(c ->> 'famille', '') not in ('arbre', 'pierre', 'maison', 'culture', 'meteo', 'caillou', 'animal', 'buisson') then return false; end if;
    if coalesce(c ->> 'espece', '') not in ('pin', 'nu', 'feuillu', 'fleuri', 'sombre', 'moussue', 'cairn', 'galet', 'pierre', 'cloture', 'volets', 'pont', 'banc', 'maison', 'feu', 'puits', 'champ', 'barque', 'orage', 'pluie', 'fleurs', 'etang', 'caillou', 'lievre', 'chat', 'chevreuil', 'mouton', 'poule', 'ronce', 'buissonsec', 'buissonfleuri', 'baies', 'buisson') then return false; end if;
    if not archipel.nombre(c -> 'stade', 0, 3, true) then return false; end if;
    if not archipel.nombre(c -> 'textes', 0, 3, true) then return false; end if;
    if not archipel.nombre(c -> 'v', 0, 1) then return false; end if;
    if not archipel.case_valide(c -> 'case') then return false; end if;
    if jsonb_typeof(c -> 'etats') is distinct from 'array' then return false; end if;
    if jsonb_array_length(c -> 'etats') > 10 then return false; end if;
    for e in select value from jsonb_array_elements_text(c -> 'etats') loop
      if e not in ('ferme', 'lueur', 'boucle', 'double', 'pluie', 'mousse', 'fissure', 'caillou', 'commis', 'clos') then return false; end if;
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

-- ───────── Les routes entre les îles ─────────
-- Une île de l’archipel se partage par un lien : un code tiré au hasard sur le téléphone, dont la base ne garde que
-- l’empreinte. Qui a le lien voit l’île, et peut tracer une route entre elle et une des siennes. Une route ne porte rien :
-- ni mot, ni nom, ni date. Chacune des deux îles peut la couper, seule, à tout moment. Fermer le lien empêche d’autres
-- routes ; retirer une île efface ses routes et son lien.

create table if not exists archipel.partages (
  ile uuid primary key references archipel.iles (id) on delete cascade,
  code bytea not null unique -- l’empreinte du code ; le code lui-même n’est que dans le lien
);
alter table archipel.partages enable row level security; -- aucune politique : on ne passe que par les fonctions
revoke all on archipel.partages from public, anon, authenticated;

create table if not exists archipel.routes (
  a uuid not null references archipel.iles (id) on delete cascade,
  b uuid not null references archipel.iles (id) on delete cascade,
  primary key (a, b),
  check (a < b) -- une seule route entre deux îles
);
create index if not exists routes_b on archipel.routes (b);
alter table archipel.routes enable row level security;
revoke all on archipel.routes from public, anon, authenticated;

create table if not exists archipel.debit_routes (minute bigint primary key, n integer not null); -- un garde-fou contre les rafales de routes
alter table archipel.debit_routes enable row level security;
revoke all on archipel.debit_routes from public, anon, authenticated;

-- vrai si le jeton est celui de l’île
create or replace function archipel.a_moi(p_ile uuid, p_jeton text) returns boolean
language plpgsql stable set search_path = '' as $$
begin
  if p_ile is null or p_jeton is null or p_jeton !~ '^[0-9a-f]{64}$' then return false; end if;
  return exists (select 1 from archipel.iles i where i.id = p_ile and i.jeton = extensions.digest(p_jeton, 'sha256'));
end $$;

-- le code d’un lien : seize octets tirés au hasard, en 22 signes pour les adresses
create or replace function archipel.code_valide(p_code text) returns boolean
language sql immutable set search_path = '' as $$ select coalesce(p_code ~ '^[A-Za-z0-9_-]{22}$', false) $$;

-- partager son île : un lien neuf remplace l’ancien ; sans code, le lien est fermé et ne mène plus nulle part
create or replace function public.archipel_partager(p_ile uuid, p_jeton text, p_code text default null)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not archipel.a_moi(p_ile, p_jeton) then raise exception 'île inconnue'; end if;
  if p_code is null then delete from archipel.partages where ile = p_ile; return true; end if;
  if not archipel.code_valide(p_code) then raise exception 'code invalide'; end if;
  insert into archipel.partages as p (ile, code) values (p_ile, extensions.digest(p_code, 'sha256'))
    on conflict (ile) do update set code = excluded.code;
  return true;
end $$;

-- l’île d’un lien ouvert : sa forme et sa place ; rien si le lien est fermé
create or replace function public.archipel_voir(p_code text)
returns table (ile uuid, ordre bigint, forme jsonb, x real, z real)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not archipel.code_valide(p_code) then return; end if;
  return query select i.id, i.rang, i.forme, i.x, i.z from archipel.partages p join archipel.iles i on i.id = p.ile where p.code = extensions.digest(p_code, 'sha256');
end $$;

-- tracer une route entre une de ses îles et l’île d’un lien ouvert ; douze routes au plus par île
create or replace function public.archipel_relier(p_code text, p_ile uuid, p_jeton text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  autre uuid;
  minute_ bigint := floor(extract(epoch from clock_timestamp()) / 60);
  compte integer;
begin
  if not archipel.a_moi(p_ile, p_jeton) then raise exception 'île inconnue'; end if;
  if not archipel.code_valide(p_code) then raise exception 'lien fermé'; end if;
  select p.ile into autre from archipel.partages p where p.code = extensions.digest(p_code, 'sha256');
  if autre is null then raise exception 'lien fermé'; end if;
  if autre = p_ile then raise exception 'la même île'; end if;
  perform 1 from archipel.iles i where i.id in (p_ile, autre) order by i.id for update; -- deux routes en même temps : l’une attend l’autre
  if exists (select 1 from archipel.routes r where r.a = least(p_ile, autre) and r.b = greatest(p_ile, autre)) then return autre; end if;
  if (select count(*) from archipel.routes r where p_ile in (r.a, r.b)) >= 12 or (select count(*) from archipel.routes r where autre in (r.a, r.b)) >= 12 then raise exception 'trop de routes'; end if;
  insert into archipel.debit_routes as d (minute, n) values (minute_, 1)
    on conflict (minute) do update set n = d.n + 1 returning d.n into compte;
  delete from archipel.debit_routes where minute < minute_ - 10;
  if compte > 60 then raise exception 'l’archipel reçoit trop de routes en ce moment'; end if;
  insert into archipel.routes (a, b) values (least(p_ile, autre), greatest(p_ile, autre));
  return autre;
end $$;

-- couper une route, seul, depuis l’une ou l’autre île : vrai si elle existait
create or replace function public.archipel_couper(p_ile uuid, p_jeton text, p_autre uuid)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_autre is null or not archipel.a_moi(p_ile, p_jeton) then return false; end if;
  delete from archipel.routes where a = least(p_ile, p_autre) and b = greatest(p_ile, p_autre);
  return found;
end $$;

-- les routes qui touchent ces îles : deux îles, rien d’autre
create or replace function public.archipel_routes(p_iles uuid[])
returns table (a uuid, b uuid)
language sql stable security definer set search_path = '' as $$
  select r.a, r.b from archipel.routes r
  where cardinality(p_iles) <= 200 and (r.a = any (p_iles) or r.b = any (p_iles))
  limit 2400
$$;

-- les îles au bout des routes d’une de ses îles : leur forme et leur place
create or replace function public.archipel_voisines(p_ile uuid, p_jeton text)
returns table (ile uuid, ordre bigint, forme jsonb, x real, z real)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not archipel.a_moi(p_ile, p_jeton) then raise exception 'île inconnue'; end if;
  return query select i.id, i.rang, i.forme, i.x, i.z from archipel.routes r join archipel.iles i on i.id = (case when r.a = p_ile then r.b else r.a end) where p_ile in (r.a, r.b);
end $$;

revoke all on function archipel.a_moi(uuid, text) from public, anon, authenticated;
revoke all on function archipel.code_valide(text) from public, anon, authenticated;
revoke all on function public.archipel_partager(uuid, text, text) from public, anon, authenticated;
revoke all on function public.archipel_voir(text) from public, anon, authenticated;
revoke all on function public.archipel_relier(text, uuid, text) from public, anon, authenticated;
revoke all on function public.archipel_couper(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.archipel_routes(uuid[]) from public, anon, authenticated;
revoke all on function public.archipel_voisines(uuid, text) from public, anon, authenticated;
grant execute on function public.archipel_partager(uuid, text, text) to anon, authenticated;
grant execute on function public.archipel_voir(text) to anon, authenticated;
grant execute on function public.archipel_relier(text, uuid, text) to anon, authenticated;
grant execute on function public.archipel_couper(uuid, text, uuid) to anon, authenticated;
grant execute on function public.archipel_routes(uuid[]) to anon, authenticated;
grant execute on function public.archipel_voisines(uuid, text) to anon, authenticated;
comment on function public.archipel_partager(uuid, text, text) is 'L’archipel : partager son île par un lien, ou fermer le lien. Seule l’empreinte du code est gardée.';
comment on function public.archipel_voir(text) is 'L’archipel : l’île d’un lien ouvert, sa forme et sa place.';
comment on function public.archipel_relier(text, uuid, text) is 'L’archipel : tracer une route entre une de ses îles et l’île d’un lien ouvert.';
comment on function public.archipel_couper(uuid, text, uuid) is 'L’archipel : couper une route, seul, depuis l’une ou l’autre île.';
comment on function public.archipel_routes(uuid[]) is 'L’archipel : les routes qui touchent ces îles.';
comment on function public.archipel_voisines(uuid, text) is 'L’archipel : les îles au bout des routes d’une de ses îles.';

-- ───────── Deux îles côte à côte ─────────
-- Une nouvelle île peut se poser à côté d’une île d’avant de la même personne : collée à elle, ou au bout d’un pont. Le lien
-- reste sur son téléphone ; la base n’en sait rien. En grandissant, l’île s’écarte juste ce qu’il faut : sa place change,
-- avec son jeton, et rien d’autre. Le rang monte, pour que ceux qui regardent la voient bouger.

create or replace function public.archipel_deplacer(p_ile uuid, p_jeton text, p_x real, p_z real)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare i uuid;
begin
  if p_ile is null or p_jeton is null or p_jeton !~ '^[0-9a-f]{64}$' then raise exception 'île inconnue'; end if;
  if p_x is null or p_z is null or not (abs(p_x) <= 40 and abs(p_z) <= 60) then raise exception 'place invalide'; end if;
  update archipel.iles set x = p_x, z = p_z, rang = nextval('archipel.rangs')
    where id = p_ile and jeton = extensions.digest(p_jeton, 'sha256') returning id into i;
  if i is null then raise exception 'île inconnue'; end if;
  return true;
end $$;

revoke all on function public.archipel_deplacer(uuid, text, real, real) from public, anon, authenticated;
grant execute on function public.archipel_deplacer(uuid, text, real, real) to anon, authenticated;
comment on function public.archipel_deplacer(uuid, text, real, real) is 'L’archipel : déplacer son île, avec son jeton, pour qu’elle reste à côté d’une autre des siennes. Seulement sa place.';
