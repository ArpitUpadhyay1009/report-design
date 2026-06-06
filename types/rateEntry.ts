export type RateRole = "FIL" | "POL" | "MANAGER";

export interface RateEntry {
  difficulty?: string;
  filRate?: number;
  dmCtg?: string;
  polCode?: string;
  polRate?: number;
  prpCode?: string;
  prpRate?: number;
  dhagaCode?: string;
  dhagaRate?: number;
}

export type ProductRateEntries = Partial<Record<RateRole, RateEntry>>;

export type RateEntries = Record<string, ProductRateEntries>;
