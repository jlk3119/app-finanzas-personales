import { buildMonthlyWorkbook, exportMonthlyXLSX } from "../exportXLSX";
import type { Expense, Budget, Category } from "@/types";
import type { Worksheet } from "exceljs";

const baseCategory: Category = {
  id: "cat1", user_id: "u1", name: "Alimentación", icon: "🍔", color: "#f00",
  is_system: false, parent_id: null, created_at: "2024-01-01",
};

const subCategory: Category = {
  id: "sub1", user_id: "u1", name: "Restaurantes", icon: "🍕", color: "#0f0",
  is_system: false, parent_id: "cat1", created_at: "2024-01-01",
};

const expense: Expense = {
  id: "e1", user_id: "u1", category_id: "cat1", amount: 50000,
  description: "Mercado", date: "2026-09-10", created_at: "2026-09-10",
};

const expenseWithSub: Expense = {
  id: "e2", user_id: "u1", category_id: "sub1", amount: 30000,
  description: "Almuerzo", date: "2026-09-11", created_at: "2026-09-11",
};

const budget: Budget = {
  id: "b1", user_id: "u1", category_id: "cat1", period: "monthly",
  amount: 200000, year: 2026, month: 9, week: null, created_at: "2026-01-01",
};

function cellText(sheet: Worksheet, row: number, col: number): string {
  return String(sheet.getRow(row).getCell(col).value ?? "");
}

function findRowByLabel(sheet: Worksheet, label: string): number {
  for (let r = 1; r <= sheet.rowCount; r++) {
    if (cellText(sheet, r, 1).includes(label)) return r;
  }
  return -1;
}

describe("buildMonthlyWorkbook", () => {
  it("crea una hoja de Presupuestos y una de Gastos", async () => {
    const wb = await buildMonthlyWorkbook([expense], [budget], [baseCategory], 9, 2026);
    expect(wb.worksheets.map((s) => s.name)).toEqual(["Presupuestos", "Gastos"]);
  });

  it("titula las hojas con el mes y año en español", async () => {
    const wb = await buildMonthlyWorkbook([expense], [budget], [baseCategory], 9, 2026);
    expect(cellText(wb.getWorksheet("Presupuestos")!, 1, 1)).toBe("Presupuestos — Septiembre 2026");
    expect(cellText(wb.getWorksheet("Gastos")!, 1, 1)).toBe("Gastos — Septiembre 2026");
  });

  it("registra el gasto con su categoría y monto", async () => {
    const wb = await buildMonthlyWorkbook([expense], [budget], [baseCategory], 9, 2026);
    const sheet = wb.getWorksheet("Gastos")!;
    expect(cellText(sheet, 4, 1)).toBe("2026-09-10");
    expect(cellText(sheet, 4, 2)).toBe("Mercado");
    expect(cellText(sheet, 4, 3)).toBe("Alimentación");
    expect(sheet.getRow(4).getCell(5).value).toBe(50000);
  });

  it("muestra la categoría padre y la subcategoría para gastos de subcategoría", async () => {
    const wb = await buildMonthlyWorkbook([expenseWithSub], [budget], [baseCategory, subCategory], 9, 2026);
    const sheet = wb.getWorksheet("Gastos")!;
    expect(cellText(sheet, 4, 3)).toBe("Alimentación");
    expect(cellText(sheet, 4, 4)).toBe("Restaurantes");
  });

  it("aplica formato de moneda COP a los montos", async () => {
    const wb = await buildMonthlyWorkbook([expense], [budget], [baseCategory], 9, 2026);
    expect(wb.getWorksheet("Gastos")!.getRow(4).getCell(5).numFmt).toBe('"$"#,##0');
    const budgetSheet = wb.getWorksheet("Presupuestos")!;
    const row = findRowByLabel(budgetSheet, "Alimentación");
    expect(budgetSheet.getRow(row).getCell(2).numFmt).toBe('"$"#,##0');
  });

  it("calcula el total de gastos con una fórmula SUM", async () => {
    const wb = await buildMonthlyWorkbook([expense, expenseWithSub], [budget], [baseCategory, subCategory], 9, 2026);
    const sheet = wb.getWorksheet("Gastos")!;
    const totalRow = sheet.rowCount;
    expect(cellText(sheet, totalRow, 4)).toBe("Total gastos");
    expect(sheet.getRow(totalRow).getCell(5).value).toMatchObject({ formula: "SUM(E4:E5)" });
  });

  it("registra presupuesto, gastado y disponible por categoría", async () => {
    const wb = await buildMonthlyWorkbook([expense], [budget], [baseCategory], 9, 2026);
    const sheet = wb.getWorksheet("Presupuestos")!;
    const row = sheet.getRow(findRowByLabel(sheet, "Alimentación"));
    expect(row.getCell(2).value).toBe(200000);
    expect(row.getCell(3).value).toBe(50000);
    expect(row.getCell(4).value).toBe(150000);
    expect(row.getCell(5).value).toBeCloseTo(0.25);
  });

  it("incluye el presupuesto global cuando category_id es null", async () => {
    const globalBudget: Budget = {
      id: "bg", user_id: "u1", category_id: null, period: "monthly",
      amount: 500000, year: 2026, month: 9, week: null, created_at: "2026-01-01",
    };
    const wb = await buildMonthlyWorkbook([expense], [globalBudget], [baseCategory], 9, 2026);
    expect(findRowByLabel(wb.getWorksheet("Presupuestos")!, "Global (total)")).toBeGreaterThan(0);
  });

  it("resalta en rojo la categoría cuyo gasto excede el presupuesto", async () => {
    const overspend: Expense = { ...expense, id: "e9", amount: 250000 };
    const wb = await buildMonthlyWorkbook([overspend], [budget], [baseCategory], 9, 2026);
    const sheet = wb.getWorksheet("Presupuestos")!;
    const row = sheet.getRow(findRowByLabel(sheet, "Alimentación"));
    expect(row.font?.color?.argb).toBe("FFB91C1C");
  });

  it("desglosa las subcategorías con gasto bajo su categoría padre", async () => {
    const wb = await buildMonthlyWorkbook([expenseWithSub], [budget], [baseCategory, subCategory], 9, 2026);
    const sheet = wb.getWorksheet("Presupuestos")!;
    const subRow = findRowByLabel(sheet, "Restaurantes");
    expect(subRow).toBeGreaterThan(findRowByLabel(sheet, "Alimentación"));
    expect(sheet.getRow(subRow).getCell(3).value).toBe(30000);
  });

  it("no falla cuando el mes no tiene gastos ni presupuestos", async () => {
    const wb = await buildMonthlyWorkbook([], [], [], 9, 2026);
    const sheet = wb.getWorksheet("Gastos")!;
    expect(sheet.getRow(sheet.rowCount).getCell(5).value).toBe(0);
  });

  it("ignora presupuestos de otros meses o periodos", async () => {
    const otherMonth: Budget = { ...budget, id: "b2", month: 8 };
    const weekly: Budget = { ...budget, id: "b3", period: "weekly", week: 1 };
    const wb = await buildMonthlyWorkbook([expense], [otherMonth, weekly], [baseCategory], 9, 2026);
    const sheet = wb.getWorksheet("Presupuestos")!;
    expect(findRowByLabel(sheet, "Alimentación")).toBe(-1);
  });
});

describe("exportMonthlyXLSX", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete (window as unknown as { AndroidDownloader?: unknown }).AndroidDownloader;
  });

  it("descarga el archivo con el nombre del mes correspondiente", async () => {
    const mockClick = jest.fn();
    const mockLink = { href: "", download: "", rel: "", click: mockClick };
    global.URL.createObjectURL = jest.fn(() => "blob:mock");
    global.URL.revokeObjectURL = jest.fn();
    jest.spyOn(document, "createElement").mockReturnValueOnce(mockLink as unknown as HTMLElement);
    jest.spyOn(document.body, "appendChild").mockImplementation((n) => n);
    jest.spyOn(document.body, "removeChild").mockImplementation((n) => n);

    await exportMonthlyXLSX([expense], [budget], [baseCategory], 9, 2026);

    expect(mockClick).toHaveBeenCalledTimes(1);
    expect(mockLink.download).toBe("misfinanzas_2026-09.xlsx");
  }, 30000);

  it("usa el puente nativo de Android cuando está disponible (APK)", async () => {
    const saveBase64File = jest.fn();
    (window as unknown as { AndroidDownloader: unknown }).AndroidDownloader = { saveBase64File };
    const createObjectURL = jest.fn(() => "blob:mock");
    global.URL.createObjectURL = createObjectURL;

    await exportMonthlyXLSX([expense], [budget], [baseCategory], 9, 2026);

    expect(saveBase64File).toHaveBeenCalledTimes(1);
    const [base64, filename, mime] = saveBase64File.mock.calls[0];
    expect(base64.length).toBeGreaterThan(0);
    expect(filename).toBe("misfinanzas_2026-09.xlsx");
    expect(mime).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(createObjectURL).not.toHaveBeenCalled();
  }, 30000);
});
