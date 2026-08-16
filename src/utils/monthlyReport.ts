import type { Expense, Budget, Category } from "@/types";

export const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export type ExpenseRow = {
  date: string;
  description: string;
  categoryName: string;
  subCategoryName: string;
  amount: number;
};

export type BudgetRow = {
  label: string;
  isSubRow: boolean;
  budgeted: number | null;
  spent: number;
  available: number | null;
  usedPct: number | null;
};

export type MonthlyReport = {
  monthLabel: string;
  expenseRows: ExpenseRow[];
  budgetRows: BudgetRow[];
  totalSpent: number;
};

export function buildMonthlyReport(
  expenses: Expense[],
  budgets: Budget[],
  categories: Category[],
  month: number,
  year: number,
): MonthlyReport {
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const monthlyBudgets = budgets.filter(
    (b) => b.period === "monthly" && b.year === year && b.month === month,
  );

  const expenseRows: ExpenseRow[] = expenses.map((e) => {
    const cat = e.category_id ? categoryMap.get(e.category_id) : null;
    const parentCat = cat?.parent_id ? categoryMap.get(cat.parent_id) : null;
    return {
      date: e.date,
      description: e.description ?? "",
      categoryName: parentCat ? parentCat.name : (cat?.name ?? "Sin categoría"),
      subCategoryName: parentCat ? (cat?.name ?? "") : "",
      amount: Number(e.amount),
    };
  });

  const totalSpent = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const budgetRows: BudgetRow[] = [];

  const globalBudget = monthlyBudgets.find((b) => b.category_id === null);
  if (globalBudget) {
    const budgeted = Number(globalBudget.amount);
    budgetRows.push({
      label: "Global (total)",
      isSubRow: false,
      budgeted,
      spent: totalSpent,
      available: Math.max(0, budgeted - totalSpent),
      usedPct: budgeted > 0 ? totalSpent / budgeted : null,
    });
  }

  for (const budget of monthlyBudgets.filter((b) => b.category_id !== null)) {
    const cat = budget.category_id ? categoryMap.get(budget.category_id) : null;
    if (!cat) continue;

    const subCategories = categories.filter((c) => c.parent_id === cat.id);
    const allIds = [cat.id, ...subCategories.map((c) => c.id)];
    const spent = expenses
      .filter((e) => allIds.includes(e.category_id ?? ""))
      .reduce((s, e) => s + Number(e.amount), 0);
    const budgeted = Number(budget.amount);

    budgetRows.push({
      label: cat.name,
      isSubRow: false,
      budgeted,
      spent,
      available: budgeted - spent,
      usedPct: budgeted > 0 ? spent / budgeted : 0,
    });

    for (const sub of subCategories) {
      const subSpent = expenses
        .filter((e) => e.category_id === sub.id)
        .reduce((s, e) => s + Number(e.amount), 0);
      if (subSpent > 0) {
        budgetRows.push({
          label: sub.name,
          isSubRow: true,
          budgeted: null,
          spent: subSpent,
          available: null,
          usedPct: null,
        });
      }
    }
  }

  return {
    monthLabel: `${MONTHS[month - 1]} ${year}`,
    expenseRows,
    budgetRows,
    totalSpent,
  };
}

export function monthlyFilename(month: number, year: number, extension: string): string {
  return `misfinanzas_${year}-${String(month).padStart(2, "0")}.${extension}`;
}
