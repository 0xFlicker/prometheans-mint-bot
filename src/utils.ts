import { utils, BigNumberish } from "ethers";

export function rankToEmber(rank: number, level: number): number {
  // Monks can have levels 1 to 5 if rank > 0
  level = rank > 0 ? level - 1 : 1;
  return rank * 5 - level;
}

export function toFixedGwei(num: BigNumberish, place: number = 2): string {
  return Number(utils.formatUnits(num, "gwei")).toFixed(place);
}
