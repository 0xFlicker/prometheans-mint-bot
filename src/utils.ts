import { utils, BigNumberish } from "ethers";

export function rankToEmber(rank: number, level: number): number {
  return rank * 5 - (level - 1);
}

export function toFixedGwei(num: BigNumberish, place: number = 2): string {
  return Number(utils.formatUnits(num, "gwei")).toFixed(place);
}
