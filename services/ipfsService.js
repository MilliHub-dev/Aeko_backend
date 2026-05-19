import FormData from "form-data";
import axios from "axios";

const PINATA_API_KEY    = process.env.PINATA_API_KEY;
const PINATA_SECRET     = process.env.PINATA_SECRET;
const PINATA_BASE_URL   = "https://api.pinata.cloud";

const pinataHeaders = {
  pinata_api_key:        PINATA_API_KEY,
  pinata_secret_api_key: PINATA_SECRET,
};

/**
 * Upload a JSON object to IPFS via Pinata.
 * Returns the IPFS URI: ipfs://<CID>
 */
export async function uploadJSON(json, name = "metadata.json") {
  const res = await axios.post(
    `${PINATA_BASE_URL}/pinning/pinJSONToIPFS`,
    { pinataContent: json, pinataMetadata: { name } },
    { headers: pinataHeaders },
  );
  return `ipfs://${res.data.IpfsHash}`;
}

/**
 * Upload a file buffer to IPFS via Pinata.
 * Returns the IPFS URI: ipfs://<CID>
 */
export async function uploadFile(buffer, filename, mimeType) {
  const form = new FormData();
  form.append("file", buffer, { filename, contentType: mimeType });
  form.append("pinataMetadata", JSON.stringify({ name: filename }));

  const res = await axios.post(
    `${PINATA_BASE_URL}/pinning/pinFileToIPFS`,
    form,
    { headers: { ...pinataHeaders, ...form.getHeaders() } },
  );
  return `ipfs://${res.data.IpfsHash}`;
}

/**
 * Upload NFT image + metadata in one call.
 * Returns { uri, imageUri } ready to pass to buildMintNft.
 */
export async function uploadNftMetadata({ imageBuffer, imageMimeType, imageFilename, name, description, attributes = [] }) {
  const imageUri = await uploadFile(imageBuffer, imageFilename, imageMimeType);

  const metadata = {
    name,
    description,
    image:      imageUri,
    attributes,
  };

  const uri = await uploadJSON(metadata, `${name.replace(/\s+/g, "_")}_metadata.json`);
  return { uri, imageUri };
}
