export type Company = {
  id: string;
  name: string;
  nit: string | null;
  join_code: string;
  created_at: string;
};

export type CompanyMember = {
  id: string;
  company_id: string;
  user_id: string;
  role: 'owner' | 'employee';
  created_at: string;
};

export type Category = {
  id: string;
  company_id: string;
  name: string;
  icon: string;
  color: string;
  is_system: boolean;
  parent_id: string | null;
  created_at: string;
};

export type Expense = {
  id: string;
  company_id: string;
  category_id: string | null;
  account_id?: string | null;
  amount: number;
  description: string | null;
  date: string;
  budget_period?: string | null;
  created_at: string;
  categories?: Category;
  accounts?: Account;
};

export type Budget = {
  id: string;
  company_id: string;
  category_id: string | null;
  period: "monthly" | "weekly";
  amount: number;
  year: number;
  month: number | null;
  week: number | null;
  created_at: string;
  categories?: Category;
};

export type Account = {
  id: string;
  company_id: string;
  name: string;
  balance: number;
  icon: string;
  color: string;
  created_at: string;
};

export type RecurringIncome = {
  id: string;
  company_id: string;
  account_id: string | null;
  name: string;
  amount: number;
  frequency: "monthly" | "biweekly" | "weekly";
  day_of_month: number | null;
  auto_assign: boolean;
  start_date: string | null;
  created_at: string;
  accounts?: Account;
};

export type Income = {
  id: string;
  company_id: string;
  account_id: string | null;
  amount: number;
  description: string | null;
  date: string;
  recurring_income_id: string | null;
  period_key: string | null;
  created_at: string;
  accounts?: Account;
};

export type Client = {
  id: string;
  company_id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
};

export type Order = {
  id: string;
  company_id: string;
  client_id: string | null;
  description: string;
  total_value: number;
  advance_payment: number;
  status: 'pending' | 'in_progress' | 'delivered' | 'cancelled';
  order_date: string;
  delivery_date: string | null;
  notes: string | null;
  created_at: string;
  clients?: Client;
};

export type Debt = {
  id: string;
  company_id: string;
  name: string;
  entity: string;
  total_amount: number;
  paid_amount: number;
  icon: string;
  notes: string | null;
  created_at: string;
};

export type MonthClosure = {
  id: string;
  company_id: string;
  year: number;
  month: number;
  closed_at: string;
};
