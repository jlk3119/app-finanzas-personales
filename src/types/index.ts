export type Category = {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  is_system: boolean;
  parent_id: string | null;
  created_at: string;
};

export type Expense = {
  id: string;
  user_id: string;
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
  user_id: string;
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
  user_id: string;
  name: string;
  balance: number;
  icon: string;
  color: string;
  created_at: string;
};

export type RecurringIncome = {
  id: string;
  user_id: string;
  account_id: string | null;
  name: string;
  amount: number;
  frequency: "monthly" | "biweekly" | "weekly";
  day_of_month: number | null;
  is_salary: boolean;
  auto_assign: boolean;
  start_date: string | null;
  created_at: string;
  accounts?: Account;
};

export type Income = {
  id: string;
  user_id: string;
  account_id: string | null;
  amount: number;
  description: string | null;
  date: string;
  recurring_income_id: string | null;
  period_key: string | null;
  created_at: string;
  accounts?: Account;
};

export type Goal = {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  icon: string;
  completed: boolean;
  category_id: string | null;
  created_at: string;
  categories?: Category;
};

export type Debt = {
  id: string;
  user_id: string;
  name: string;
  entity: string;
  total_amount: number;
  paid_amount: number;
  icon: string;
  color: string;
  notes: string | null;
  created_at: string;
};

export type MonthClosure = {
  id: string;
  user_id: string;
  year: number;
  month: number;
  closed_at: string;
};
