export type Category = {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  is_system: boolean;
  created_at: string;
};

export type Expense = {
  id: string;
  user_id: string;
  category_id: string | null;
  amount: number;
  description: string | null;
  date: string;
  created_at: string;
  categories?: Category;
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

export type Income = {
  id: string;
  user_id: string;
  account_id: string | null;
  amount: number;
  description: string | null;
  date: string;
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
  created_at: string;
};
