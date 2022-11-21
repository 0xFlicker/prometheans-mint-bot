import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, run } = hre;

  const prometheansTest = await deployments.get("PrometheansTest");

  await run("verify:verify", {
    address: prometheansTest.address,
    constructorArguments: prometheansTest.args,
    contract: "contracts/PrometheansTest.sol:PrometheansTest",
  });

  const prometheansSafeMint = await deployments.get("PrometheansSafeMint");

  await run("verify:verify", {
    address: prometheansSafeMint.address,
    constructorArguments: prometheansSafeMint.args,
    contract: "contracts/PrometheansSafeMinter.sol:PrometheansSafeMint",
  });
};
export default func;
func.tags = ["verify"];
