import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network, run, ethers } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const result = await deploy("PrometheansTest", {
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: 5,
  });

  await deploy("PrometheansSafeMint", {
    from: deployer,
    args: [result.address],
    log: true,
    waitConfirmations: 5,
  });
};
export default func;
func.tags = ["deploy"];
