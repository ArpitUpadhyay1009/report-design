export type Role = "POL" | "FIL" | "MANAGER";

export interface Profile {
  name: string;
  email: string;
  role: Role;
  userId: string;
  password: string;
}
