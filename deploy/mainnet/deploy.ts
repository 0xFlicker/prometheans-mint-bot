import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network, run, ethers } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy("PrometheansSafeMint", {
    from: deployer,
    args: ["0xc4a5025c4563ad0acc09d92c2506e6744dad58eb"],
    log: true,
    waitConfirmations: 5,
  });
};
export default func;
func.tags = ["deploy"];
