import type { Expense, Budget, Category } from "@/types";
import type { Workbook, Worksheet, Row } from "exceljs";
import { buildMonthlyReport, monthlyFilename, type MonthlyReport } from "./monthlyReport";
import { downloadBlob } from "./download";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const COP_FORMAT = '"$"#,##0';
const PCT_FORMAT = "0%";

const TEAL = "FF0F766E";
const GOLD = "FFB4880B";
const WHITE = "FFFFFFFF";
const SOFT_GREY = "FFF1F5F4";
const OVER_BUDGET_TEXT = "FFB91C1C";
const OVER_BUDGET_FILL = "FFFEE2E2";

function styleTitle(row: Row, span: number, color: string): void {
  row.font = { bold: true, size: 14, color: { argb: WHITE } };
  row.height = 24;
  for (let i = 1; i <= span; i++) {
    const cell = row.getCell(i);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
    cell.alignment = { vertical: "middle" };
  }
}

function styleHeader(row: Row, span: number): void {
  row.font = { bold: true, color: { argb: WHITE } };
  row.height = 20;
  for (let i = 1; i <= span; i++) {
    const cell = row.getCell(i);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
    cell.alignment = { vertical: "middle", horizontal: i === 1 ? "left" : "right" };
  }
}

function styleTotal(row: Row, span: number): void {
  row.font = { bold: true };
  for (let i = 1; i <= span; i++) {
    const cell = row.getCell(i);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SOFT_GREY } };
    cell.border = { top: { style: "thin" } };
  }
}

function addBudgetSheet(workbook: Workbook, report: MonthlyReport): Worksheet {
  const sheet = workbook.addWorksheet("Presupuestos", {
    views: [{ state: "frozen", ySplit: 3 }],
  });

  sheet.columns = [
    { width: 32 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 12 },
  ];

  styleTitle(sheet.addRow([`Presupuestos — ${report.monthLabel}`]), 5, TEAL);
  sheet.mergeCells(1, 1, 1, 5);
  sheet.addRow([]);
  styleHeader(
    sheet.addRow(["Categoría", "Presupuesto", "Gastado", "Disponible", "% Usado"]),
    5,
  );

  const firstDataRow = sheet.rowCount + 1;

  for (const b of report.budgetRows) {
    const row = sheet.addRow([
      b.isSubRow ? `    └ ${b.label}` : b.label,
      b.budgeted,
      b.spent,
      b.available,
      b.usedPct,
    ]);

    row.getCell(2).numFmt = COP_FORMAT;
    row.getCell(3).numFmt = COP_FORMAT;
    row.getCell(4).numFmt = COP_FORMAT;
    row.getCell(5).numFmt = PCT_FORMAT;

    if (b.isSubRow) {
      row.font = { italic: true, color: { argb: "FF6B7280" } };
    } else if (b.budgeted !== null && b.spent > b.budgeted) {
      row.font = { color: { argb: OVER_BUDGET_TEXT }, bold: true };
      for (let i = 1; i <= 5; i++) {
        row.getCell(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: OVER_BUDGET_FILL } };
      }
    }
  }

  const lastDataRow = sheet.rowCount;
  const hasData = lastDataRow >= firstDataRow;
  const totalRow = sheet.addRow([
    "Total",
    hasData ? { formula: `SUM(B${firstDataRow}:B${lastDataRow})` } : 0,
    hasData ? { formula: `SUM(C${firstDataRow}:C${lastDataRow})` } : 0,
    hasData ? { formula: `SUM(D${firstDataRow}:D${lastDataRow})` } : 0,
    null,
  ]);
  totalRow.getCell(2).numFmt = COP_FORMAT;
  totalRow.getCell(3).numFmt = COP_FORMAT;
  totalRow.getCell(4).numFmt = COP_FORMAT;
  styleTotal(totalRow, 5);

  return sheet;
}

function addExpenseSheet(workbook: Workbook, report: MonthlyReport): Worksheet {
  const sheet = workbook.addWorksheet("Gastos", {
    views: [{ state: "frozen", ySplit: 3 }],
  });

  sheet.columns = [
    { width: 14 },
    { width: 34 },
    { width: 22 },
    { width: 22 },
    { width: 16 },
  ];

  styleTitle(sheet.addRow([`Gastos — ${report.monthLabel}`]), 5, GOLD);
  sheet.mergeCells(1, 1, 1, 5);
  sheet.addRow([]);
  styleHeader(
    sheet.addRow(["Fecha", "Descripción", "Categoría", "Subcategoría", "Monto"]),
    5,
  );

  const firstDataRow = sheet.rowCount + 1;

  for (const e of report.expenseRows) {
    const row = sheet.addRow([e.date, e.description, e.categoryName, e.subCategoryName, e.amount]);
    row.getCell(5).numFmt = COP_FORMAT;
  }

  const lastDataRow = sheet.rowCount;
  const hasData = lastDataRow >= firstDataRow;
  const totalRow = sheet.addRow([
    "",
    "",
    "",
    "Total gastos",
    hasData ? { formula: `SUM(E${firstDataRow}:E${lastDataRow})` } : 0,
  ]);
  totalRow.getCell(5).numFmt = COP_FORMAT;
  styleTotal(totalRow, 5);

  return sheet;
}

export async function buildMonthlyWorkbook(
  expenses: Expense[],
  budgets: Budget[],
  categories: Category[],
  month: number,
  year: number,
): Promise<Workbook> {
  const ExcelJS = await import("exceljs");
  const report = buildMonthlyReport(expenses, budgets, categories, month, year);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MisFinanzas";
  workbook.created = new Date();

  addBudgetSheet(workbook, report);
  addExpenseSheet(workbook, report);

  return workbook;
}

export async function exportMonthlyXLSX(
  expenses: Expense[],
  budgets: Budget[],
  categories: Category[],
  month: number,
  year: number,
): Promise<void> {
  const workbook = await buildMonthlyWorkbook(expenses, budgets, categories, month, year);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: XLSX_MIME });
  await downloadBlob(blob, monthlyFilename(month, year, "xlsx"), XLSX_MIME);
}
