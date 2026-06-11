import { buildMonthlyCSVContent, exportMonthlyCSV } from "../exportCSV";
import type { Expense, Budget, Category } from "@/types";

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
  description: "Mercado", date: "2024-05-10", created_at: "2024-05-10",
};

const expenseWithSub: Expense = {
  id: "e2", user_id: "u1", category_id: "sub1", amount: 30000,
  description: "Almuerzo", date: "2024-05-11", created_at: "2024-05-11",
};

const budget: Budget = {
  id: "b1", user_id: "u1", category_id: "cat1", period: "monthly",
  amount: 200000, year: 2024, month: 5, week: null, created_at: "2024-01-01",
};

describe("buildMonthlyCSVContent", () => {
  it("incluye el nombre correcto del mes y año", () => {
    const csv = buildMonthlyCSVContent([expense], [], [baseCategory], 5, 2024);
    expect(csv).toContain("Mayo 2024");
  });

  it("incluye cabeceras de gastos", () => {
    const csv = buildMonthlyCSVContent([expense], [budget], [baseCategory], 5, 2024);
    expect(csv).toContain("Fecha");
    expect(csv).toContain("Descripción");
    expect(csv).toContain("Monto (COP)");
  });

  it("incluye cabeceras de presupuestos", () => {
    const csv = buildMonthlyCSVContent([expense], [budget], [baseCategory], 5, 2024);
    expect(csv).toContain("Presupuesto (COP)");
    expect(csv).toContain("Gastado (COP)");
    expect(csv).toContain("% Usado");
  });

  it("incluye los datos del gasto", () => {
    const csv = buildMonthlyCSVContent([expense], [], [baseCategory], 5, 2024);
    expect(csv).toContain("2024-05-10");
    expect(csv).toContain("Mercado");
    expect(csv).toContain("50000");
  });

  it("muestra la categoría padre para gastos de subcategoría", () => {
    const csv = buildMonthlyCSVContent([expenseWithSub], [budget], [baseCategory, subCategory], 5, 2024);
    expect(csv).toContain("Alimentación");
    expect(csv).toContain("Restaurantes");
  });

  it("escapa comas y comillas en los datos", () => {
    const expenseWithComma: Expense = {
      id: "e3", user_id: "u1", category_id: null, amount: 10000,
      description: 'Compra "especial", mercado', date: "2024-05-12", created_at: "2024-05-12",
    };
    const csv = buildMonthlyCSVContent([expenseWithComma], [], [], 5, 2024);
    expect(csv).toContain('"Compra ""especial"", mercado"');
  });

  it("muestra Sin categoría para gastos sin categoría", () => {
    const noCatExpense: Expense = {
      id: "e4", user_id: "u1", category_id: null, amount: 5000,
      description: "Misc", date: "2024-05-13", created_at: "2024-05-13",
    };
    const csv = buildMonthlyCSVContent([noCatExpense], [], [], 5, 2024);
    expect(csv).toContain("Sin categoría");
  });

  it("calcula el total de gastos correctamente", () => {
    const expenses = [expense, expenseWithSub];
    const csv = buildMonthlyCSVContent(expenses, [], [baseCategory, subCategory], 5, 2024);
    expect(csv).toContain("80000");
  });

  it("no falla con listas vacías", () => {
    expect(() => buildMonthlyCSVContent([], [], [], 1, 2024)).not.toThrow();
  });

  it("incluye presupuesto global cuando category_id es null", () => {
    const globalBudget: Budget = {
      id: "bg", user_id: "u1", category_id: null, period: "monthly",
      amount: 500000, year: 2024, month: 5, week: null, created_at: "2024-01-01",
    };
    const csv = buildMonthlyCSVContent([expense], [globalBudget], [baseCategory], 5, 2024);
    expect(csv).toContain("Global (total)");
  });
});

describe("exportMonthlyCSV", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete (window as unknown as { AndroidDownloader?: unknown }).AndroidDownloader;
  });

  it("descarga en el navegador adjuntando el enlace al DOM y liberando la URL después", async () => {
    jest.useFakeTimers();
    const mockRevokeObjectURL = jest.fn();
    const mockClick = jest.fn();
    const mockLink = { href: "", download: "", rel: "", click: mockClick };

    global.URL.createObjectURL = jest.fn(() => "blob:mock");
    global.URL.revokeObjectURL = mockRevokeObjectURL;
    jest.spyOn(document, "createElement").mockReturnValueOnce(mockLink as unknown as HTMLElement);
    const appendSpy = jest.spyOn(document.body, "appendChild").mockImplementation((n) => n);
    const removeSpy = jest.spyOn(document.body, "removeChild").mockImplementation((n) => n);

    await exportMonthlyCSV([expense], [budget], [baseCategory], 5, 2024);

    expect(mockClick).toHaveBeenCalledTimes(1);
    expect(mockLink.download).toBe("misfinanzas_2024-05.csv");
    // El enlace debe estar en el DOM al hacer click (necesario en Firefox)
    expect(appendSpy).toHaveBeenCalledWith(mockLink);
    expect(removeSpy).toHaveBeenCalledWith(mockLink);
    // La URL no se libera de inmediato (evita abortar la descarga)
    expect(mockRevokeObjectURL).not.toHaveBeenCalled();
    jest.runAllTimers();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:mock");
    jest.useRealTimers();
  });

  it("usa el puente nativo de Android cuando está disponible (APK)", async () => {
    const saveBase64File = jest.fn();
    (window as unknown as { AndroidDownloader: unknown }).AndroidDownloader = { saveBase64File };
    const createObjectURL = jest.fn(() => "blob:mock");
    global.URL.createObjectURL = createObjectURL;

    await exportMonthlyCSV([expense], [budget], [baseCategory], 5, 2024);

    expect(saveBase64File).toHaveBeenCalledTimes(1);
    const [base64, filename, mime] = saveBase64File.mock.calls[0];
    expect(typeof base64).toBe("string");
    expect(base64.length).toBeGreaterThan(0);
    expect(filename).toBe("misfinanzas_2024-05.csv");
    expect(mime).toBe("text/csv");
    // No debe usar la descarga por blob del navegador
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});
