import { difficulties } from "@/constants/rate";
import type {
  DesignWiseDifficulty,
  DifficultyRate,
  FilledRate,
  PolRate,
} from "@/services/api";
import type { Product } from "@/types/product";

export interface CategoryRates {
  polRate?: number;
  prpRate?: number;
  dhagaRate?: number;
}

export function filRateForDifficulty(
  difficultyRates: DifficultyRate[],
  code: string,
  custType: string
): number | undefined {
  const apiEntry = difficultyRates.find((r) => r.code === code);
  if (apiEntry) {
    if (custType === "O") return apiEntry.normalRate ?? undefined;
    if (custType === "B") return apiEntry.brandRate ?? undefined;
    return undefined;
  }
  const local = (difficulties as Record<string, number>)[code];
  return local;
}

export function categoryRatesFor(
  polRates: PolRate[],
  polCtg: string,
  custType: string
): CategoryRates {
  const normalized = normalizeDmCtg(polCtg);
  const entry = polRates.find(
    (r) => r.category.trim().toUpperCase() === normalized
  );
  if (!entry) return {};
  if (custType === "O") {
    return {
      polRate: entry.normalPol ?? undefined,
      prpRate: entry.normalPrp ?? undefined,
      dhagaRate: entry.normalDhaga ?? undefined,
    };
  }
  if (custType === "B") {
    return {
      polRate: entry.brandPol ?? undefined,
      prpRate: entry.brandPrp ?? undefined,
      dhagaRate: entry.brandDhaga ?? undefined,
    };
  }
  return {};
}

const DESIGN_DIFFICULTY_RATE_SUFFIX = /(D\d+|E\d+|M\d+|SP)$/;

export function buildDesignDifficultiesByDmCtg(
  items: DesignWiseDifficulty[]
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const item of items) {
    const key = item.dmCtg.trim().toUpperCase();
    const list = map.get(key) ?? [];
    if (!list.includes(item.designDifficulty)) {
      list.push(item.designDifficulty);
      map.set(key, list);
    }
  }
  for (const [, list] of map) {
    list.sort();
  }
  return map;
}

export function buildDifficultyToDmCtgMap(
  items: DesignWiseDifficulty[]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of items) {
    map.set(item.designDifficulty, item.dmCtg.trim().toUpperCase());
  }
  return map;
}

const normalizeDmCtg = (value?: string | null): string => {
  const normalized = (value ?? "").trim().toUpperCase();
  if (!normalized || normalized === "—") return "";
  return normalized;
};

/** Resolve the DmCtg key used for design-wise difficulty and POL dropdowns. */
export function resolveProductDmCtg(
  product: Product,
  byDmCtg: Map<string, string[]>,
  difficultyToDmCtg: Map<string, string>,
  filled?: FilledRate
): string {
  const candidates: string[] = [];

  const push = (value?: string | null) => {
    const normalized = normalizeDmCtg(value);
    if (normalized) candidates.push(normalized);
  };

  push(product.polCtg);
  push(product.tpRmCtg);
  push(filled?.dmCtg);

  for (const difficulty of [
    filled?.difficulty,
    product.difficulty,
  ]) {
    const code = (difficulty ?? "").trim();
    if (!code || code === "—") continue;
    const fromMap = difficultyToDmCtg.get(code);
    if (fromMap) candidates.push(fromMap);
  }

  for (const candidate of candidates) {
    if (byDmCtg.has(candidate)) return candidate;
  }

  for (const difficulty of [filled?.difficulty, product.difficulty]) {
    const code = (difficulty ?? "").trim();
    if (!code || code === "—") continue;
    const fromMap = difficultyToDmCtg.get(code);
    if (fromMap) return fromMap;
  }

  return candidates[0] ?? "";
}

export function designDifficultiesForDmCtg(
  byDmCtg: Map<string, string[]>,
  dmCtg: string
): string[] {
  const normalized = normalizeDmCtg(dmCtg);
  if (!normalized) return [];
  return byDmCtg.get(normalized) ?? [];
}

export function resolveDefaultDesignDifficulty(
  options: string[],
  productDifficulty?: string
): string | undefined {
  if (!options.length) return undefined;
  const normalized = (productDifficulty ?? "").trim();
  if (normalized && normalized !== "—" && options.includes(normalized)) {
    return normalized;
  }
  return options[0];
}

export function filRateForDesignDifficulty(
  difficultyRates: DifficultyRate[],
  designDifficulty: string,
  custType: string
): number | undefined {
  const direct = filRateForDifficulty(
    difficultyRates,
    designDifficulty,
    custType
  );
  if (direct !== undefined) return direct;

  const match = designDifficulty.match(DESIGN_DIFFICULTY_RATE_SUFFIX);
  if (match) {
    return filRateForDifficulty(difficultyRates, match[1], custType);
  }

  return undefined;
}

export function polSpForDmCtg(
  polRates: PolRate[],
  dmCtg: string
): string | undefined {
  const normalized = normalizeDmCtg(dmCtg);
  const entry = polRates.find(
    (r) => r.category.trim().toUpperCase() === normalized
  );
  return entry?.polSp || undefined;
}

export function polDropdownOptionsForDmCtg(
  polRates: PolRate[],
  dmCtg: string
): string[] {
  const normalized = normalizeDmCtg(dmCtg);
  if (!normalized) return [];
  const polSp = polSpForDmCtg(polRates, normalized);
  if (polSp && polSp !== normalized) return [normalized, polSp];
  return [normalized];
}

/** @deprecated Use polDropdownOptionsForDmCtg */
export function polSpOptionsForDmCtg(
  polRates: PolRate[],
  dmCtg: string
): string[] {
  return polDropdownOptionsForDmCtg(polRates, dmCtg);
}

export function patchFromDmCtg(
  polRates: PolRate[],
  dmCtg: string,
  custType: string
): {
  dmCtg: string;
  polSp?: undefined;
  polRate?: number;
  prpRate?: number;
  dhagaRate?: number;
} {
  const rates = categoryRatesFor(polRates, dmCtg, custType);
  return {
    dmCtg,
    polSp: undefined,
    polRate: rates.polRate,
    prpRate: rates.prpRate,
    dhagaRate: rates.dhagaRate,
  };
}

export function isPolSpCode(polRates: PolRate[], code: string): boolean {
  return polRates.some((r) => r.polSp === code);
}

export function patchFromPolSp(
  polRates: PolRate[],
  polSp: string,
  custType: string
): {
  polSp: string;
  dmCtg?: string;
  polRate?: number;
  prpRate?: number;
  dhagaRate?: number;
} {
  const entry = polRates.find((r) => r.polSp === polSp);
  if (!entry) return { polSp };
  const rates = categoryRatesFor(polRates, entry.category, custType);
  return {
    polSp,
    dmCtg: entry.category,
    ...rates,
  };
}

export function polCategoryCodesFrom(polRates: PolRate[]): string[] {
  return Array.from(
    new Set(polRates.map((r) => r.category).filter(Boolean))
  ).sort();
}

/** Build a display row for manager rate entry from get-Filled-Rates. */
export function productForFilledRate(
  filled: FilledRate,
  existing?: Product,
  difficultyToDmCtg?: Map<string, string>
): Product {
  const dmCtgFromDifficulty = (difficulty?: string): string => {
    const code = (difficulty ?? "").trim();
    if (!code || code === "—") return "";
    return difficultyToDmCtg?.get(code) ?? "";
  };

  if (existing) {
    const resolvedDmCtg =
      normalizeDmCtg(existing.polCtg) ||
      normalizeDmCtg(existing.tpRmCtg) ||
      normalizeDmCtg(filled.dmCtg) ||
      dmCtgFromDifficulty(filled.difficulty) ||
      dmCtgFromDifficulty(existing.difficulty);
    return resolvedDmCtg ? { ...existing, polCtg: resolvedDmCtg } : existing;
  }
  const stubDmCtg =
    normalizeDmCtg(filled.dmCtg) || dmCtgFromDifficulty(filled.difficulty);
  return {
    id: `filled__${filled.designId}`,
    designCode: filled.designId,
    managerName: "—",
    managerShort: "—",
    custType: "O",
    numberOfParts: 0,
    manufacturer: "—",
    dep: "—",
    polCtg: stubDmCtg || "—",
    difficulty: filled.difficulty,
    filRate: filled.filRate,
    polRate: filled.polRate,
    prpRate: filled.prpRate,
    dhagaRate: filled.dhagaRate,
    custCode: "—",
  };
}
