create table if not exists manual_costs (
  id uuid primary key default uuid_generate_v4(),
  cost_date date,
  description text,
  amount numeric,
  point_of_sale_id uuid references points_of_sale(id),
  category_id uuid references categories(id),
  is_general boolean default false,
  installment_months integer,
  note text,
  created_at timestamp default now()
);
