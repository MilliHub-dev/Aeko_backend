const axios = require("axios");
const FormData = require("form-data");
require("dotenv").config();

const pinataApiKey = process.env.PINATA_API_KEY;
const pinataSecret = process.env.PINATA_SECRET;

const uploadToIPFS = async (fileBuffer, fileName) => {
  const formData = new FormData();
  formData.append("file", fileBuffer, fileName);

  const options = JSON.stringify({ cidVersion: 0 });
  formData.append("pinataOptions", options);

  try {
    const res = await axios.post("https://api.pinata.cloud/pinning/pinFileToIPFS", formData, {
      headers: {
        Authorization: `Bearer ${pinataSecret}`,
        "pinata_api_key": pinataApiKey,
        ...formData.getHeaders(),
      },
    });
    return res.data.IpfsHash;
  } catch (error) {
    console.error("IPFS Upload Error", error);
    return null;
  }
};

module.exports = { uploadToIPFS };
