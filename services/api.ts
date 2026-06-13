import axios from "axios";
import type { Product } from "@/types/product";
import type { Profile, Role } from "@/types/profile";

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

export interface DesignApprovalsParams {
  /** ISO date string in yyyy-mm-dd format, inclusive. */
  fromDate: string;
  /** ISO date string in yyyy-mm-dd format, inclusive. */
  toDate: string;
  /**
   * Raw EmpRoleid value from the login response — always sent so the SP
   * can scope its result set to what the role is allowed to see.
   */
  roleId: string;
  /**
   * Only set when the logged-in user is a MANAGER. Omit for FIL / POL.
   * When omitted the field is not added to the request body at all.
   */
  managerName?: string;
}

export async function fetchDesignApprovals(
  params: DesignApprovalsParams
): Promise<Product[]> {
  // Field names mirror the stored procedure parameters
  // (USP_Design_approval_Automation @FromDate, @ToDate, @roleId,
  // @managerName), so the casing is what the SP expects rather than our
  // snake_case convention used elsewhere.
  const body = new URLSearchParams();
  body.append("FromDate", params.fromDate);
  body.append("ToDate", params.toDate);
  body.append("roleId", params.roleId);
  if (params.managerName !== undefined && params.managerName !== "") {
    body.append("managerName", params.managerName);
  }

  const response = await apiClient.post<DesignApprovalResponse>(
    "/get-Design-approval-Automation",
    body,
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
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
  polSp: string;
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
  POL_SP?: string | null;
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
      const polSp = (row?.POL_SP ?? "").trim();
      if (!category) return null;
      return {
        category,
        polSp,
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

export interface FilRatePayload {
  user_id: string;
  design_id: string;
  difficulty: string;
  fil_rate: number;
}

export interface FilRateResponse {
  status: string;
  action?: string;
  data?: unknown;
  message: string | string[];
}

export async function submitFilRate(
  payload: FilRatePayload
): Promise<FilRateResponse> {
  // The CodeIgniter controller reads via $this->input->post(...), which
  // expects application/x-www-form-urlencoded.
  const body = new URLSearchParams();
  body.append("user_id", payload.user_id);
  body.append("design_id", payload.design_id);
  body.append("difficulty", payload.difficulty);
  body.append("fil_rate", String(payload.fil_rate));

  const response = await apiClient.post<FilRateResponse>(
    "/add-FIL-Rate",
    body,
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  return response.data;
}

export interface PolRatePayload {
  user_id: string;
  design_id: string;
  pol_rate: number;
  prp_rate: number;
  dhaga_rate: number;
}

export interface PolRateResponse {
  status: string;
  action?: string;
  data?: unknown;
  message: string | string[];
}

export async function submitPolRate(
  payload: PolRatePayload
): Promise<PolRateResponse> {
  const body = new URLSearchParams();
  body.append("user_id", payload.user_id);
  body.append("design_id", payload.design_id);
  body.append("pol_rate", String(payload.pol_rate));
  body.append("prp_rate", String(payload.prp_rate));
  body.append("dhaga_rate", String(payload.dhaga_rate));

  const response = await apiClient.post<PolRateResponse>(
    "/add-POL-Rate",
    body,
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  return response.data;
}

export interface ManagerRatePayload {
  user_id: string;
  design_id: string;
  difficulty: string;
  manager_fil_rate: number;
  manager_pol_rate: number;
  manager_prp_rate: number;
  manager_dhaga_rate: number;
}

export interface ManagerRateResponse {
  status: string;
  action?: string;
  data?: unknown;
  message: string | string[];
}

export async function submitManagerRate(
  payload: ManagerRatePayload
): Promise<ManagerRateResponse> {
  const body = new URLSearchParams();
  body.append("user_id", payload.user_id);
  body.append("design_id", payload.design_id);
  body.append("difficulty", payload.difficulty);
  body.append("manager_fil_rate", String(payload.manager_fil_rate));
  body.append("manager_pol_rate", String(payload.manager_pol_rate));
  body.append("manager_prp_rate", String(payload.manager_prp_rate));
  body.append("manager_dhaga_rate", String(payload.manager_dhaga_rate));

  const response = await apiClient.post<ManagerRateResponse>(
    "/add-Manager-Rate",
    body,
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  return response.data;
}

export interface SubmittedFilRate {
  designId: string;
  difficulty: string;
  filRate: number;
  filSubmittedAt?: string;
}

export interface SubmittedPolRate {
  designId: string;
  polRate: number;
  prpRate: number;
  dhagaRate: number;
  polSubmittedAt?: string;
}

interface SubmittedRateRow {
  design_id: string | null;
  difficulty: string | null;
  fil_rate: string | null;
  fil_submitted_at: string | null;
  pol_rate: string | null;
  prp_rate: string | null;
  dhaga_rate: string | null;
  pol_submitted_at: string | null;
}

interface SubmittedRatesResponse {
  status: string;
  data: SubmittedRateRow[];
  total?: number;
  message?: string;
}

export async function fetchFilRatesByUser(
  userId: string
): Promise<SubmittedFilRate[]> {
  const body = new URLSearchParams();
  body.append("user_id", userId);

  const response = await apiClient.post<SubmittedRatesResponse>(
    "/get-FIL-Rates-By-User",
    body,
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  const list = response.data?.data ?? [];
  return list
    .map<SubmittedFilRate | null>((row) => {
      const designId = (row?.design_id ?? "").trim();
      const difficulty = (row?.difficulty ?? "").trim();
      const filRate = parseNullableRate(row?.fil_rate);
      if (!designId || !difficulty || filRate === null) return null;
      return {
        designId,
        difficulty,
        filRate,
        filSubmittedAt: row?.fil_submitted_at ?? undefined,
      };
    })
    .filter((r): r is SubmittedFilRate => r !== null);
}

export async function fetchPolRatesByUser(
  userId: string
): Promise<SubmittedPolRate[]> {
  const body = new URLSearchParams();
  body.append("user_id", userId);

  const response = await apiClient.post<SubmittedRatesResponse>(
    "/get-POL-Rates-By-User",
    body,
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  const list = response.data?.data ?? [];
  return list
    .map<SubmittedPolRate | null>((row) => {
      const designId = (row?.design_id ?? "").trim();
      const polRate = parseNullableRate(row?.pol_rate);
      const prpRate = parseNullableRate(row?.prp_rate);
      const dhagaRate = parseNullableRate(row?.dhaga_rate);
      if (
        !designId ||
        polRate === null ||
        prpRate === null ||
        dhagaRate === null
      ) {
        return null;
      }
      return {
        designId,
        polRate,
        prpRate,
        dhagaRate,
        polSubmittedAt: row?.pol_submitted_at ?? undefined,
      };
    })
    .filter((r): r is SubmittedPolRate => r !== null);
}

/** One row from Tbl_Design_Rates where both FIL and POL are COMPLETED. */
export interface FilledRate {
  designId: string;
  difficulty: string;
  filRate: number;
  filSubmittedAt?: string;
  polRate: number;
  prpRate: number;
  dhagaRate: number;
  polSubmittedAt?: string;
  dmCtg?: string;
}

interface FilledRateRow {
  design_id?: string | null;
  difficulty?: string | null;
  fil_rate?: string | null;
  fil_submitted_at?: string | null;
  pol_rate?: string | null;
  prp_rate?: string | null;
  dhaga_rate?: string | null;
  pol_submitted_at?: string | null;
  dm_ctg?: string | null;
  DmCtg?: string | null;
}

interface FilledRatesResponse {
  status: string;
  data: FilledRateRow[];
  total?: number;
  message?: string;
}

interface CompletedDesignIdRow {
  design_id?: string | null;
}

interface CompletedDesignIdsResponse {
  status: string;
  data: CompletedDesignIdRow[];
  total?: number;
  message?: string;
}

function mapCompletedDesignIds(rows: CompletedDesignIdRow[]): string[] {
  return rows
    .map((row) => (row?.design_id ?? "").trim())
    .filter(Boolean);
}

/** design_ids where fil_status = COMPLETED (FIL rate entry). */
export async function fetchCompletedFilDesignIds(): Promise<string[]> {
  const response = await apiClient.post<CompletedDesignIdsResponse>(
    "/get-completed-fil"
  );
  return mapCompletedDesignIds(response.data?.data ?? []);
}

/** design_ids where pol_status = COMPLETED (POL rate entry). */
export async function fetchCompletedPolDesignIds(): Promise<string[]> {
  const response = await apiClient.post<CompletedDesignIdsResponse>(
    "/get-completed-pol"
  );
  return mapCompletedDesignIds(response.data?.data ?? []);
}

/**
 * Designs where fil_status and pol_status are both COMPLETED — used to
 * populate the manager's rate-entry queue and read-only FIL/POL columns.
 */
export async function fetchFilledRates(): Promise<FilledRate[]> {
  const response = await apiClient.post<FilledRatesResponse>(
    "/get-Filled-Rates"
  );
  const list = response.data?.data ?? [];
  return list
    .map<FilledRate | null>((row) => {
      const designId = (row?.design_id ?? "").trim();
      const difficulty = (row?.difficulty ?? "").trim();
      const filRate = parseNullableRate(row?.fil_rate);
      const polRate = parseNullableRate(row?.pol_rate);
      const prpRate = parseNullableRate(row?.prp_rate);
      const dhagaRate = parseNullableRate(row?.dhaga_rate);
      const dmCtg = (row?.dm_ctg ?? row?.DmCtg ?? "").trim() || undefined;
      if (
        !designId ||
        !difficulty ||
        filRate === null ||
        polRate === null ||
        prpRate === null ||
        dhagaRate === null
      ) {
        return null;
      }
      return {
        designId,
        difficulty,
        filRate,
        filSubmittedAt: row?.fil_submitted_at ?? undefined,
        polRate,
        prpRate,
        dhagaRate,
        polSubmittedAt: row?.pol_submitted_at ?? undefined,
        dmCtg,
      };
    })
    .filter((r): r is FilledRate => r !== null);
}

// ---------------------------------------------------------------------------
// Login (POST /report-login)
// ---------------------------------------------------------------------------

// Map the backend's EmpRoleid value to our internal Role union.
// Confirmed values from EmployeeMaster:
//   4 -> MANAGER
//   6 -> FIL
// POL's EmpRoleid hasn't been confirmed yet; add it here when known.
export const ROLE_BY_EMP_ROLE_ID: Record<string, Role> = {
  "4": "MANAGER",
  "6": "FIL",
};

// EmpCode-specific overrides. These win over ROLE_BY_EMP_ROLE_ID and are
// used when the same EmpRoleid is shared across multiple business roles
// and we have to disambiguate by EmpCode. Keys are normalized to uppercase
// at lookup time, so "fw1950" / "FW1950" both match.
export const ROLE_BY_EMP_CODE: Record<string, Role> = {
  "31615": "POL",
  "FW1950": "FIL",
};

const ROLE_BY_EMP_CODE_NORMALIZED: Record<string, Role> = Object.fromEntries(
  Object.entries(ROLE_BY_EMP_CODE).map(([k, v]) => [k.trim().toUpperCase(), v])
);

export function resolveRoleFromEmpRoleId(
  empRoleId: string | number | null | undefined
): Role | null {
  if (empRoleId === null || empRoleId === undefined) return null;
  const key = String(empRoleId).trim();
  return ROLE_BY_EMP_ROLE_ID[key] ?? null;
}

/**
 * Resolve the effective UI role for a logged-in user.
 *
 * Order of precedence:
 *   1. EmpCode override (ROLE_BY_EMP_CODE)  — handles cases like a single
 *      "Operator" role-id covering both POL and FIL employees.
 *   2. EmpRoleid mapping (ROLE_BY_EMP_ROLE_ID).
 */
export function resolveRole(
  empCode: string | null | undefined,
  empRoleId: string | number | null | undefined
): Role | null {
  if (empCode) {
    const codeKey = String(empCode).trim().toUpperCase();
    if (codeKey && codeKey in ROLE_BY_EMP_CODE_NORMALIZED) {
      return ROLE_BY_EMP_CODE_NORMALIZED[codeKey];
    }
  }
  return resolveRoleFromEmpRoleId(empRoleId);
}

interface LoginResponseData {
  EmpUniqid: string | number | null;
  EmpName: string | null;
  EmpRoleid: string | number | null;
  AttendanceEmpCode: string | null;
  supervisor_code: string | null;
  supervisor_name: string | null;
  cell_id: string | null;
  process_id: string | null;
}

interface LoginResponse {
  status: string;
  is_logedin?: number;
  data?: LoginResponseData;
  message: string | string[];
}

const messageOf = (m: string | string[] | undefined): string =>
  Array.isArray(m) ? m.join(", ") : m ?? "";

/**
 * POST /report-login with EmpCode + password.
 *
 * On 4xx the server still returns a JSON body with a friendly message
 * (e.g. "User not found", "Incorrect password") — we surface that as the
 * thrown Error's message rather than a generic axios error.
 */
export async function loginWithEmpCode(
  empCode: string,
  password: string
): Promise<Profile> {
  const body = new URLSearchParams();
  body.append("EmpCode", empCode);
  body.append("password", password);

  let payload: LoginResponse;
  try {
    const response = await apiClient.post<LoginResponse>(
      "/report-login",
      body,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    payload = response.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.data) {
      const data = err.response.data as Partial<LoginResponse>;
      const msg = messageOf(data.message);
      throw new Error(msg || "Login failed.");
    }
    throw err instanceof Error ? err : new Error("Login failed.");
  }

  if (payload.status !== "1" || !payload.data) {
    throw new Error(messageOf(payload.message) || "Login failed.");
  }

  const role = resolveRole(empCode, payload.data.EmpRoleid);
  if (!role) {
    throw new Error(
      `This account's role (EmpRoleid = ${payload.data.EmpRoleid ?? "?"}) ` +
        `is not configured for the report. Contact an administrator.`
    );
  }

  return {
    userId: String(payload.data.EmpUniqid ?? "").trim(),
    empCode: empCode.trim(),
    name: (payload.data.EmpName ?? empCode).trim(),
    role,
    empRoleId: String(payload.data.EmpRoleid ?? "").trim(),
    attendanceEmpCode: payload.data.AttendanceEmpCode ?? undefined,
    supervisorCode: payload.data.supervisor_code ?? undefined,
    supervisorName: payload.data.supervisor_name ?? undefined,
    cellId: payload.data.cell_id ?? undefined,
    processId: payload.data.process_id ?? undefined,
  };
}
