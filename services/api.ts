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
