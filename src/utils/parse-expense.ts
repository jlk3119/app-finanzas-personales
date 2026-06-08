import type { Category } from "@/types";

export type ParsedExpense = {
  amount: number;
  description: string;
  categoryName: string | null;
  date: string; // YYYY-MM-DD
};

export type MatchedCategory = {
  categoryId: string | null; // categoría raíz (parent) seleccionada
  subCategoryId: string | null; // subcategoría, si el match fue una hija
};

/** minúsculas, sin tildes ni espacios sobrantes — para comparar nombres de forma tolerante. */
export function normalize(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Resuelve el nombre de categoría que devuelve la IA contra las categorías reales del usuario.
 * Si el match es una subcategoría, devuelve también su categoría padre para preseleccionar ambas.
 * Devuelve nulls cuando no hay una coincidencia razonable.
 */
export function matchCategory(name: string | null, categories: Category[]): MatchedCategory {
  const empty: MatchedCategory = { categoryId: null, subCategoryId: null };
  const target = normalize(name ?? "");
  if (!target) return empty;

  let match = categories.find((c) => normalize(c.name) === target);

  if (!match) {
    match = categories
      .filter((c) => {
        const n = normalize(c.name);
        return n.length >= 3 && (n.includes(target) || target.includes(n));
      })
      .sort((a, b) => normalize(b.name).length - normalize(a.name).length)[0];
  }

  if (!match) return empty;

  return match.parent_id
    ? { categoryId: match.parent_id, subCategoryId: match.id }
    : { categoryId: match.id, subCategoryId: null };
}
