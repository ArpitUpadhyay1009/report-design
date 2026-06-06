import axios from "axios";
import type { Product } from "@/types/product";

const API_BASE = "https://unitab.unidesign-jewel.com/tab_app/index.php";

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

export interface DesignApprovalRow {
  PlatinumOrderHead: string | null;
  IncCmType: string | null;
  DmParts: string | null;
  OdDmCd: string | null;
  Manufacturer: string | null;
  LocPrntCd: string | null;
  Difficulty: string | null;
  " FIL RATE": string | null;
  "POL RATE": string | null;
  "PRP RATE": string | null;
  "DHAGA RATE": string | null;
  ClientCode: string | null;
  DmCtg: string | null;
  TpRmCtg: string | null;
  Image: string | null;
}

interface DesignApprovalResponse {
  data: DesignApprovalRow[];
  status: string;
  message: string;
}

const toNumber = (v: string | null | undefined): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const shortName = (full: string): string => {
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const last = parts[parts.length - 1];
  return `${first[0].toUpperCase()}${last.toUpperCase()}`;
};

const normalizeImageUrl = (raw: string | null | undefined): string | undefined => {
  if (!raw) return undefined;
  let url = raw.trim().replace(/\\/g, "/");
  url = url.replace(/([^:])\/{2,}/g, "$1/");
  try {
    return encodeURI(url);
  } catch {
    return undefined;
  }
};

const mapRow = (row: DesignApprovalRow, index: number): Product => {
  const manager = row.PlatinumOrderHead ?? "Unassigned";
  const designCode = row.OdDmCd ?? `UNKNOWN-${index}`;
  const manufacturer = row.Manufacturer ?? "—";
  const clientCode = row.ClientCode ?? "—";

  return {
    id: `${designCode}__${manufacturer}__${clientCode}__${index}`,
    managerName: manager,
    managerShort: shortName(manager),
    custType: (row.IncCmType ?? "O").trim(),
    designCode,
    numberOfParts: toNumber(row.DmParts),
    imageUrl: normalizeImageUrl(row.Image),
    manufacturer,
    dep: row.LocPrntCd ?? "—",
    polCtg: row.DmCtg ?? "—",
    tpRmCtg: row.TpRmCtg ?? undefined,
    difficulty: (row.Difficulty ?? "—").trim(),
    filRate: toNumber(row[" FIL RATE"]),
    polRate: toNumber(row["POL RATE"]),
    prpRate: toNumber(row["PRP RATE"]),
    dhagaRate: toNumber(row["DHAGA RATE"]),
    custCode: clientCode,
  };
};

export async function fetchDesignApprovals(): Promise<Product[]> {
  const response = await apiClient.post<DesignApprovalResponse>(
    "/get-Design-approval-Automation"
  );

  const rows = response.data?.data ?? [];
  return rows.map(mapRow);
}

export interface DifficultyRate {
  code: string;
  normalRate: number | null;
  brandRate: number | null;
}

interface DifficultyHeaderRow {
  Difficulty: string | null;
  NormalRate: string | null;
  BrandRate: string | null;
}

interface DifficultyHeadersResponse {
  status: string;
  data: DifficultyHeaderRow[];
  total?: number;
  message?: string;
}

const parseNullableRate = (v: string | null | undefined): number | null => {
  if (v === null || v === undefined) return null;
  const trimmed = v.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
};

export async function fetchDifficultyHeaders(): Promise<DifficultyRate[]> {
  const response = await apiClient.post<DifficultyHeadersResponse>(
    "/get-Difficulty-Headers"
  );
  const list = response.data?.data ?? [];
  return list
    .map<DifficultyRate | null>((row) => {
      const code = (row?.Difficulty ?? "").trim();
      if (!code) return null;
      return {
        code,
        normalRate: parseNullableRate(row?.NormalRate),
        brandRate: parseNullableRate(row?.BrandRate),
      };
    })
    .filter((r): r is DifficultyRate => r !== null);
}

export interface PolRate {
  category: string;
  normalPol: number | null;
  normalPrp: number | null;
  normalDhaga: number | null;
  brandPol: number | null;
  brandPrp: number | null;
  brandDhaga: number | null;
}

interface PolRateRow {
  DmCtg: string | null;
  Normal_Pol: string | null;
  Normal_Prp: string | null;
  Normal_Dhaga: string | null;
  Brand_Pol: string | null;
  Brand_Prp: string | null;
  Brand_Dhaga: string | null;
}

interface PolRatesResponse {
  status: string;
  data: PolRateRow[];
  total?: number;
  message?: string;
}

export async function fetchPolRates(): Promise<PolRate[]> {
  const response = await apiClient.post<PolRatesResponse>("/get-Pol-Rates");
  const list = response.data?.data ?? [];
  return list
    .map<PolRate | null>((row) => {
      const category = (row?.DmCtg ?? "").trim();
      if (!category) return null;
      return {
        category,
        normalPol: parseNullableRate(row?.Normal_Pol),
        normalPrp: parseNullableRate(row?.Normal_Prp),
        normalDhaga: parseNullableRate(row?.Normal_Dhaga),
        brandPol: parseNullableRate(row?.Brand_Pol),
        brandPrp: parseNullableRate(row?.Brand_Prp),
        brandDhaga: parseNullableRate(row?.Brand_Dhaga),
      };
    })
    .filter((r): r is PolRate => r !== null);
}
