-- ============================================================
-- Navalha — estrutura de assinaturas, agenda e pagamentos
-- Rode no SQL Editor do Supabase. Depende de public.enterprise e public.users.
-- ============================================================
create extension if not exists btree_gist;

create table public.services (
  id uuid primary key default gen_random_uuid(),
  enterprise_id uuid not null references public.enterprise(id) on delete cascade,
  name text not null,
  minutes int not null check (minutes > 0),
  price numeric(10,2) not null check (price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  enterprise_id uuid not null references public.enterprise(id) on delete cascade,
  name text not null,
  description text,
  type text not null check (type in ('single', 'monthly')),   -- avulso | mensal
  price numeric(10,2) not null check (price >= 0),
  cuts_included int not null check (cuts_included > 0),
  validity_days int not null default 30 check (validity_days > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  enterprise_id uuid not null references public.enterprise(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'overdue', 'canceled', 'expired')),
  cuts_total int not null,
  cuts_used int not null default 0,
  renew boolean not null default true,            -- false = cancelou: vale até o fim do período
  current_period_start timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.subscriptions (enterprise_id, status);
create index on public.subscriptions (user_id);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  enterprise_id uuid not null references public.enterprise(id) on delete cascade,
  client_id uuid not null references public.users(id),
  barber_id uuid not null references public.users(id),
  service_id uuid not null references public.services(id),
  subscription_id uuid not null references public.subscriptions(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'done', 'noshow', 'canceled')),
  created_at timestamptz not null default now(),
  -- impede dois agendamentos confirmados sobrepostos para o mesmo barbeiro
  constraint appointments_no_overlap exclude using gist
    (barber_id with =, tstzrange(starts_at, ends_at) with &&) where (status = 'confirmed')
);
create index on public.appointments (enterprise_id, starts_at);
create index on public.appointments (client_id, starts_at);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  enterprise_id uuid not null references public.enterprise(id) on delete cascade,
  user_id uuid not null references public.users(id),
  subscription_id uuid not null references public.subscriptions(id),
  amount numeric(10,2) not null,
  method text not null default 'pix',
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  gateway text,
  gateway_id text unique,
  checkout_url text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.payments (enterprise_id, status, paid_at);

-- ---------- Funções (atômicas) ----------

-- Agenda usando 1 crédito (reservado enquanto o agendamento está "confirmed").
create or replace function public.book_appointment(
  p_enterprise uuid, p_client uuid, p_barber uuid, p_service uuid, p_starts timestamptz
) returns public.appointments language plpgsql security definer set search_path = public as $$
declare svc public.services; sub public.subscriptions; appt public.appointments;
begin
  select * into svc from services where id = p_service and enterprise_id = p_enterprise and active;
  if svc.id is null then raise exception 'SERVICE_NOT_FOUND'; end if;
  if not exists (select 1 from users where id = p_barber and enterprise_id = p_enterprise) then
    raise exception 'BARBER_NOT_FOUND';
  end if;
  if p_starts <= now() then raise exception 'PAST_TIME'; end if;

  select s.* into sub from subscriptions s
   where s.user_id = p_client and s.enterprise_id = p_enterprise
     and s.status = 'active' and s.current_period_end >= p_starts
     and s.cuts_used + (select count(*) from appointments a
                         where a.subscription_id = s.id and a.status = 'confirmed') < s.cuts_total
   order by s.current_period_end
   limit 1
   for update of s;
  if sub.id is null then raise exception 'NO_CREDITS'; end if;

  insert into appointments (enterprise_id, client_id, barber_id, service_id, subscription_id, starts_at, ends_at)
  values (p_enterprise, p_client, p_barber, p_service, sub.id, p_starts, p_starts + make_interval(mins => svc.minutes))
  returning * into appt;
  return appt;
end $$;

-- Conclui o atendimento e consome o crédito.
create or replace function public.complete_appointment(p_enterprise uuid, p_id uuid)
returns public.appointments language plpgsql security definer set search_path = public as $$
declare appt public.appointments;
begin
  update appointments set status = 'done'
   where id = p_id and enterprise_id = p_enterprise and status = 'confirmed'
   returning * into appt;
  if appt.id is null then raise exception 'NOT_FOUND_OR_CLOSED'; end if;

  update subscriptions s
     set cuts_used = s.cuts_used + 1,
         status = case when s.cuts_used + 1 >= s.cuts_total
                        and (select type from plans where id = s.plan_id) = 'single'
                       then 'expired' else s.status end
   where s.id = appt.subscription_id;
  return appt;
end $$;

-- Confirma pagamento (idempotente) e ativa/renova a assinatura.
create or replace function public.mark_payment_paid(p_gateway_id text)
returns public.subscriptions language plpgsql security definer set search_path = public as $$
declare pay public.payments; sub public.subscriptions; pl public.plans;
begin
  update payments set status = 'paid', paid_at = now()
   where gateway_id = p_gateway_id and status = 'pending'
   returning * into pay;
  if pay.id is null then return null; end if;          -- já processado

  select * into sub from subscriptions where id = pay.subscription_id for update;
  select * into pl from plans where id = sub.plan_id;
  update subscriptions
     set status = 'active', cuts_used = 0, cuts_total = pl.cuts_included,
         current_period_start = now(),
         current_period_end = greatest(now(), coalesce(sub.current_period_end, now()))
                              + make_interval(days => pl.validity_days)
   where id = sub.id
   returning * into sub;
  return sub;
end $$;

-- Rodada diária: vencidas viram "overdue" (mensal), "canceled" (mensal sem renovar) ou "expired" (avulso).
create or replace function public.expire_subscriptions() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with u as (
    update subscriptions s
       set status = case when p.type = 'monthly' and s.renew then 'overdue'
                         when p.type = 'monthly' then 'canceled'
                         else 'expired' end
      from plans p
     where p.id = s.plan_id and s.status = 'active' and s.current_period_end < now()
    returning 1)
  select count(*) into n from u;
  return n;
end $$;

-- ---------- Views dos relatórios ----------
create or replace view public.v_monthly_revenue with (security_invoker = on) as
select p.enterprise_id,
       date_trunc('month', p.paid_at at time zone 'America/Sao_Paulo')::date as month,
       pl.type as plan_type,
       sum(p.amount) as total,
       count(*) as payments
  from payments p
  join subscriptions s on s.id = p.subscription_id
  join plans pl on pl.id = s.plan_id
 where p.status = 'paid'
 group by 1, 2, 3;

create or replace view public.v_barber_cuts with (security_invoker = on) as
select enterprise_id, barber_id,
       date_trunc('month', starts_at at time zone 'America/Sao_Paulo')::date as month,
       count(*) as cuts
  from appointments
 where status = 'done'
 group by 1, 2, 3;

-- ---------- Segurança: só o backend (service role) acessa ----------
alter table public.services enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.appointments enable row level security;
alter table public.payments enable row level security;

revoke all on public.services, public.plans, public.subscriptions, public.appointments, public.payments,
              public.v_monthly_revenue, public.v_barber_cuts from anon, authenticated;
revoke execute on function public.book_appointment, public.complete_appointment,
                           public.mark_payment_paid, public.expire_subscriptions from public, anon, authenticated;
