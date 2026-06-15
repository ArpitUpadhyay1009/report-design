export type CustomerType = string;
export type Difficulty = string;

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
  tpRmCtg?: string;
  difficulty: Difficulty;
  filRate: number;
  polRate: number;
  prpRate: number;
  dhagaRate: number;
  custCode: string;
}

export const totalRate = (p: Product): number =>
  p.filRate + p.polRate + p.prpRate;
