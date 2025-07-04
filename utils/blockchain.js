const { ethers } = require("ethers");
require("dotenv").config();

const provider = new ethers.providers.JsonRpcProvider(process.env.POLYGON_ZKEVM_RPC);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, ["function createPost(string memory _ipfsHash)"], wallet);

const createPostOnBlockchain = async (ipfsHash) => {
  const tx = await contract.createPost(ipfsHash);
  await tx.wait();
  return tx.hash;
};

module.exports = { createPostOnBlockchain };
