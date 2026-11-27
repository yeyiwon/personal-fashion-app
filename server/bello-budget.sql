-- Apply to the BELLO project only. The server stores billing reservations and opaque job references.
create table if not exists public.bello_reservations (
  kind text not null, job uuid not null, fingerprint text not null, usage_day date not null,
  units integer not null check(units>0), reference text, primary key(kind,job)
);
alter table public.bello_reservations enable row level security;
revoke all on public.bello_reservations from public, anon, authenticated;
create index if not exists bello_usage_day on public.bello_reservations(kind,usage_day);
create or replace function public.bello_reserve(p_kind text,p_job uuid,p_fingerprint text,p_units integer,p_limit integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare prior public.bello_reservations; today date:=(current_timestamp at time zone 'UTC')::date;
begin
 if p_kind not in ('fashn','openai') or p_units<=0 or p_limit<=0 or p_limit>10000 then raise exception 'invalid budget'; end if;
 perform pg_advisory_xact_lock(hashtextextended('bello.'||p_kind,0));
 select * into prior from public.bello_reservations where kind=p_kind and job=p_job;
 if found then
   if prior.fingerprint<>p_fingerprint then return jsonb_build_object('state','conflict'); end if;
   return jsonb_build_object('state','existing','reference',prior.reference);
 end if;
 if (select coalesce(sum(units),0) from public.bello_reservations where kind=p_kind and usage_day=today)+p_units>p_limit then return jsonb_build_object('state','limit'); end if;
 insert into public.bello_reservations values(p_kind,p_job,p_fingerprint,today,p_units,null);
 return jsonb_build_object('state','reserved');
end; $$;
create or replace function public.bello_record_job(p_kind text,p_job uuid,p_reference text)
returns void language sql security definer set search_path='' as $$
 update public.bello_reservations set reference=p_reference where kind=p_kind and job=p_job and reference is null;
$$;
revoke execute on function public.bello_reserve(text,uuid,text,integer,integer),public.bello_record_job(text,uuid,text) from public,anon,authenticated;
grant execute on function public.bello_reserve(text,uuid,text,integer,integer),public.bello_record_job(text,uuid,text) to service_role;

