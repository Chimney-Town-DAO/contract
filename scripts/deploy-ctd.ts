import { ChimneyTownDAO, ChimneyTownDAO__factory } from "../types";
import dotenv from "dotenv";
dotenv.config();

const hre = require("hardhat");

async function main() {
  const ChimneyTownDAO: ChimneyTownDAO__factory =
    (await hre.ethers.getContractFactory(
      "ChimneyTownDAO"
    )) as ChimneyTownDAO__factory;
  if (process.env.BASE_URI == undefined) {
    throw Error("Empty base uri");
  }
  const ctd = await ChimneyTownDAO.deploy(process.env.BASE_URI);

  await ctd.deployed();

  console.log("deployed to:", ctd.address);
  console.log("tx hash:", ctd.deployTransaction.hash);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
