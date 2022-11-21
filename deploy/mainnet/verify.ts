import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, run } = hre;

  const prometheansSafeMint = await deployments.get("PrometheansSafeMint");

  await run("verify:verify", {
    address: prometheansSafeMint.address,
    constructorArguments: prometheansSafeMint.args,
    contract: "contracts/PrometheansSafeMinter.sol:PrometheansSafeMint",
  });
};
export default func;
func.tags = ["verify"];
