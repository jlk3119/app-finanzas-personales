import type { Expense, Budget, Category } from "@/types";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function escapeCell(value: string | number | null | undefined): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(escapeCell).join(",");
}

export function buildMonthlyCSVContent(
  expenses: Expense[],
  budgets: Budget[],
  categories: Category[],
  month: number,
  year: number,
): string {
  const monthLabel = `${MONTHS[month - 1]} ${year}`;
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const monthlyBudgets = budgets.filter(
    (b) => b.period === "monthly" && b.year === year && b.month === month,
  );

  const rows: string[] = [];

  // Section: Gastos
  rows.push(buildRow([`Gastos - ${monthLabel}`]));
  rows.push(buildRow(["Fecha", "Descripción", "Categoría", "Subcategoría", "Monto (COP)"]));

  for (const e of expenses) {
    const cat = e.category_id ? categoryMap.get(e.category_id) : null;
    const parentCat = cat?.parent_id ? categoryMap.get(cat.parent_id) : null;
    const categoryName = parentCat ? parentCat.name : (cat?.name ?? "Sin categoría");
    const subCategoryName = parentCat ? (cat?.name ?? "") : "";
    rows.push(buildRow([e.date, e.description, categoryName, subCategoryName, Number(e.amount)]));
  }

  const totalGastos = expenses.reduce((s, e) => s + Number(e.amount), 0);
  rows.push(buildRow(["", "", "", "Total gastos", totalGastos]));
  rows.push("");

  // Section: Presupuestos
  rows.push(buildRow([`Presupuestos - ${monthLabel}`]));
  rows.push(buildRow(["Categoría", "Presupuesto (COP)", "Gastado (COP)", "Disponible (COP)", "% Usado"]));

  const globalBudget = monthlyBudgets.find((b) => b.category_id === null);
  if (globalBudget) {
    rows.push(buildRow(["Global (total)", Number(globalBudget.amount), totalGastos, Math.max(0, Number(globalBudget.amount) - totalGastos), `${Math.round((totalGastos / Number(globalBudget.amount)) * 100)}%`]));
  }

  for (const budget of monthlyBudgets.filter((b) => b.category_id !== null)) {
    const cat = budget.category_id ? categoryMap.get(budget.category_id) : null;
    if (!cat) continue;

    const subIds = categories.filter((c) => c.parent_id === cat.id).map((c) => c.id);
    const allIds = [cat.id, ...subIds];
    const spent = expenses
      .filter((e) => allIds.includes(e.category_id ?? ""))
      .reduce((s, e) => s + Number(e.amount), 0);
    const budgetAmt = Number(budget.amount);
    const available = budgetAmt - spent;
    const pct = budgetAmt > 0 ? Math.round((spent / budgetAmt) * 100) : 0;

    rows.push(buildRow([cat.name, budgetAmt, spent, available, `${pct}%`]));

    for (const sub of categories.filter((c) => c.parent_id === cat.id)) {
      const subSpent = expenses
        .filter((e) => e.category_id === sub.id)
        .reduce((s, e) => s + Number(e.amount), 0);
      if (subSpent > 0) {
        rows.push(buildRow([`  └ ${sub.name}`, "", subSpent, "", ""]));
      }
    }
  }

  return rows.join("\n");
}

export function exportMonthlyCSV(
  expenses: Expense[],
  budgets: Budget[],
  categories: Category[],
  month: number,
  year: number,
): void {
  const csv = buildMonthlyCSVContent(expenses, budgets, categories, month, year);
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `misfinanzas_${year}-${String(month).padStart(2, "0")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
