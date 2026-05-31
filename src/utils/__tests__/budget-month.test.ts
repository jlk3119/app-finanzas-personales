import { getDefaultBudgetMonth } from "../budget-month";

describe("getDefaultBudgetMonth", () => {
  it("devuelve el mes calendario actual cuando no hay cierres", () => {
    const result = getDefaultBudgetMonth([], new Date(2026, 4, 31)); // 31 mayo 2026
    expect(result).toEqual({ year: 2026, month: 5 });
  });

  it("salta un mes cerrado y avanza al siguiente", () => {
    const result = getDefaultBudgetMonth([{ year: 2026, month: 5 }], new Date(2026, 4, 31));
    expect(result).toEqual({ year: 2026, month: 6 });
  });

  it("salta varios meses cerrados consecutivos", () => {
    const closures = [
      { year: 2026, month: 5 },
      { year: 2026, month: 6 },
    ];
    const result = getDefaultBudgetMonth(closures, new Date(2026, 4, 31));
    expect(result).toEqual({ year: 2026, month: 7 });
  });

  it("nunca retrocede aunque un mes anterior esté cerrado", () => {
    const result = getDefaultBudgetMonth([{ year: 2026, month: 3 }], new Date(2026, 4, 15));
    expect(result).toEqual({ year: 2026, month: 5 });
  });

  it("hace rollover de diciembre a enero del año siguiente", () => {
    const result = getDefaultBudgetMonth([{ year: 2026, month: 12 }], new Date(2026, 11, 31));
    expect(result).toEqual({ year: 2027, month: 1 });
  });
});
