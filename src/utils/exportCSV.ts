import type { Expense, Budget, Category } from "@/types";
import { buildMonthlyReport, monthlyFilename } from "./monthlyReport";
import { downloadBlob } from "./download";

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
  const report = buildMonthlyReport(expenses, budgets, categories, month, year);
  const rows: string[] = [];

  rows.push(buildRow([`Gastos - ${report.monthLabel}`]));
  rows.push(buildRow(["Fecha", "Descripción", "Categoría", "Subcategoría", "Monto (COP)"]));

  for (const e of report.expenseRows) {
    rows.push(buildRow([e.date, e.description, e.categoryName, e.subCategoryName, e.amount]));
  }

  rows.push(buildRow(["", "", "", "Total gastos", report.totalSpent]));
  rows.push("");

  rows.push(buildRow([`Presupuestos - ${report.monthLabel}`]));
  rows.push(buildRow(["Categoría", "Presupuesto (COP)", "Gastado (COP)", "Disponible (COP)", "% Usado"]));

  for (const b of report.budgetRows) {
    if (b.isSubRow) {
      rows.push(buildRow([`  └ ${b.label}`, "", b.spent, "", ""]));
    } else {
      const pct = b.usedPct === null ? 0 : Math.round(b.usedPct * 100);
      rows.push(buildRow([b.label, b.budgeted, b.spent, b.available, `${pct}%`]));
    }
  }

  return rows.join("\n");
}

export async function exportMonthlyCSV(
  expenses: Expense[],
  budgets: Budget[],
  categories: Category[],
  month: number,
  year: number,
): Promise<void> {
  const csv = buildMonthlyCSVContent(expenses, budgets, categories, month, year);
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  await downloadBlob(blob, monthlyFilename(month, year, "csv"), "text/csv");
}
