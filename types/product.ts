export type CustomerType = "O" | "B" | "S" | "P";
export type Difficulty = "RGE1" | "RGE2" | "RGE3" | "RGE4";

export interface Product {
  id: string;
  managerName: string;
  managerShort: string;
  custType: CustomerType;
  designCode: string;
  numberOfParts: number;
  imageUrl?: string;
  manufacturer: string;
  dep: string;
  polCtg: string;
  difficulty: Difficulty;
  filRate: number;
  polRate: number;
  prpRate: number;
  dhagaRate: number;
  custCode: string;
}

export const totalRate = (p: Product): number =>
  p.filRate + p.polRate + p.prpRate + p.dhagaRate;
