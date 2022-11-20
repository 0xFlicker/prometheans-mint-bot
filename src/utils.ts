import { utils, BigNumberish } from "ethers";

export function rankToEmber(rank: number): number {
  return rank * 5;
}

export function toFixedGwei(num: BigNumberish, place: number = 2): string {
  return Number(utils.formatUnits(num, "gwei")).toFixed(place);
}
