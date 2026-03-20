-- PostgreSQL reference schema for production (v1 minimum)

create table if not exists organizations (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists users (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists memberships (
  id text primary key,
  organization_id text not null references organizations(id),
  user_id text not null references users(id),
  role text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists tenants (
  id text primary key,
  organization_id text not null references organizations(id),
  slug text not null unique,
  region text not null,
  status text not null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tenant_runtime_instances (
  id text primary key,
  tenant_id text not null references tenants(id),
  provider text not null,
  runtime_type text not null,
  status text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists plans (
  id text primary key,
  slug text not null unique,
  name text not null,
  monthly_quota_runs integer not null,
  monthly_storage_mb integer not null,
  max_users integer not null,
  allowed_channels jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists subscriptions (
  id text primary key,
  tenant_id text not null references tenants(id),
  plan_id text not null references plans(id),
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists entitlements (
  id text primary key,
  tenant_id text not null references tenants(id),
  key text not null,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists provider_connections (
  id text primary key,
  tenant_id text not null references tenants(id),
  provider text not null,
  kind text not null,
  encrypted_secret_ref text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists usage_events (
  id text primary key,
  tenant_id text not null references tenants(id),
  category text not null,
  metric text not null,
  amount numeric not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists quota_snapshots (
  id text primary key,
  tenant_id text not null references tenants(id),
  month_key text not null,
  runs_used integer not null,
  storage_mb_used integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, month_key)
);

create table if not exists channel_connections (
  id text primary key,
  tenant_id text not null references tenants(id),
  channel text not null,
  status text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, channel)
);

create table if not exists tenant_files (
  id text primary key,
  tenant_id text not null references tenants(id),
  storage_key text not null,
  file_name text not null,
  content_type text not null,
  size_bytes bigint not null,
  status text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists service_health_snapshots (
  id text primary key,
  tenant_id text not null references tenants(id),
  service text not null,
  status text not null,
  details jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now()
);

create table if not exists audit_events (
  id text primary key,
  tenant_id text,
  actor_user_id text,
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);