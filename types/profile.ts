export type Role = "POL" | "FIL" | "MANAGER";

export interface Profile {
  // The unique employee id we send to the rate-submission APIs as `user_id`.
  userId: string;
  // Login credential (server: EmpCode). Useful for display/audit.
  empCode: string;
  // Display name (server: EmpName).
  name: string;
  // Resolved role used for UI gating.
  role: Role;
  // Raw role id from the server (server: EmpRoleid). Kept for debugging /
  // future dynamic checks.
  empRoleId: string;
  // Optional auxiliary fields the API returns. Not currently displayed but
  // stored so we have them when needed.
  attendanceEmpCode?: string;
  supervisorCode?: string;
  supervisorName?: string;
  cellId?: string;
  processId?: string;
}
