import { normalize, matchCategory } from "../parse-expense";
import type { Category } from "@/types";

const cat = (id: string, name: string, parent_id: string | null = null): Category => ({
  id,
  user_id: "u1",
  name,
  icon: "💸",
  color: "#000",
  is_system: false,
  parent_id,
  created_at: "",
});

const categories: Category[] = [
  cat("alim", "Alimentación"),
  cat("merc", "Mercado", "alim"),
  cat("rest", "Restaurante", "alim"),
  cat("trans", "Transporte"),
  cat("ocio", "Ocio"),
];

describe("normalize", () => {
  it("quita tildes y pasa a minúsculas", () => {
    expect(normalize("Alimentación")).toBe("alimentacion");
    expect(normalize("  ÓCIO ")).toBe("ocio");
  });
});

describe("matchCategory", () => {
  it("encuentra una categoría raíz por nombre exacto", () => {
    expect(matchCategory("Transporte", categories)).toEqual({ categoryId: "trans", subCategoryId: null });
  });

  it("ignora mayúsculas y tildes", () => {
    expect(matchCategory("alimentacion", categories)).toEqual({ categoryId: "alim", subCategoryId: null });
  });

  it("cuando el match es una subcategoría devuelve también su categoría padre", () => {
    expect(matchCategory("Restaurante", categories)).toEqual({ categoryId: "alim", subCategoryId: "rest" });
  });

  it("hace match parcial por inclusión", () => {
    expect(matchCategory("super mercado", categories)).toEqual({ categoryId: "alim", subCategoryId: "merc" });
  });

  it("devuelve nulls cuando ninguna categoría aplica", () => {
    expect(matchCategory("Viajes a Marte", categories)).toEqual({ categoryId: null, subCategoryId: null });
  });

  it("devuelve nulls con entrada vacía o null", () => {
    expect(matchCategory(null, categories)).toEqual({ categoryId: null, subCategoryId: null });
    expect(matchCategory("   ", categories)).toEqual({ categoryId: null, subCategoryId: null });
  });
});
