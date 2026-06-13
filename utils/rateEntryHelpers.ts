import { difficulties } from "@/constants/rate";
import type { DifficultyRate, FilledRate, PolRate } from "@/services/api";
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
  const entry = polRates.find((r) => r.category === polCtg);
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

export function polSpForDmCtg(
  polRates: PolRate[],
  dmCtg: string
): string | undefined {
  const entry = polRates.find((r) => r.category === dmCtg);
  return entry?.polSp || undefined;
}

export function polDropdownOptionsForDmCtg(
  polRates: PolRate[],
  dmCtg: string
): string[] {
  const normalized = dmCtg.trim();
  if (!normalized || normalized === "—") return [];
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
  existing?: Product
): Product {
  if (existing) return existing;
  return {
    id: `filled__${filled.designId}`,
    designCode: filled.designId,
    managerName: "—",
    managerShort: "—",
    custType: "O",
    numberOfParts: 0,
    manufacturer: "—",
    dep: "—",
    polCtg: filled.dmCtg ?? "—",
    difficulty: filled.difficulty,
    filRate: filled.filRate,
    polRate: filled.polRate,
    prpRate: filled.prpRate,
    dhagaRate: filled.dhagaRate,
    custCode: "—",
  };
}
