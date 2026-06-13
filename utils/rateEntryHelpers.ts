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
