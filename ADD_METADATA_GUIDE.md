import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET = process.env.PINATA_SECRET;

if (!PINATA_API_KEY || !PINATA_SECRET) {
  console.error('❌ Please set PINATA_API_KEY and PINATA_SECRET in .env file');
  process.exit(1);
}

console.log('🚀 Uploading Aeko Token Metadata to IPFS...\n');

// Upload file to Pinata
async function uploadFile(filePath, fileName) {
  try {
    const data = new FormData();
    data.append('file', fs.createReadStream(filePath));
    data.append('pinataMetadata', JSON.stringify({
      name: fileName
    }));
    data.append('pinataOptions', JSON.stringify({
      cidVersion: 0
    }));

    const response = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', data, {
      maxContentLength: 'Infinity',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${data._boundary}`,
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET
      }
    });

    return response.data.IpfsHash;
  } catch (error) {
    console.error('Error uploading file:', error.response?.data || error.message);
    throw error;
  }
}

// Upload JSON to Pinata
async function uploadJSON(jsonData, fileName) {
  try {
    const response = await axios.post('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      pinataContent: jsonData,
      pinataMetadata: {
        name: fileName
      }
    }, {
      headers: {
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET
      }
    });

    return response.data.IpfsHash;
  } catch (error) {
    console.error('Error uploading JSON:', error.response?.data || error.message);
    throw error;
  }
}

async function uploadTokenMetadata() {
  try {
    // Step 1: Upload logo (if exists)
    let logoHash = null;
    const logoPath = './token-assets/aeko-logo.png';
    
    if (fs.existsSync(logoPath)) {
      console.log('📸 Uploading token logo...');
      logoHash = await uploadFile(logoPath, 'aeko-logo.png');
      console.log('✅ Logo uploaded to IPFS:', `https://ipfs.io/ipfs/${logoHash}`);
    } else {
      console.log('⚠️  Logo not found at', logoPath);
      console.log('💡 Using placeholder image URL');
      logoHash = 'QmNNrMz7nAjKGJKwg1vNQ7aJLcFGAu7h7eBUBXGKLzx9dC'; // Placeholder
    }

    // Step 2: Create metadata JSON
    const metadata = {
      name: "Aeko Coin",
      symbol: "AEKO",
      description: "The native token of the Aeko social media platform, enabling creators to monetize content, trade NFTs, and participate in a decentralized creator economy.",
      image: `https://ipfs.io/ipfs/${logoHash}`,
      external_url: "https://aeko.io",
      properties: {
        category: "utility",
        files: [
          {
            uri: `https://ipfs.io/ipfs/${logoHash}`,
            type: "image/png"
          }
        ]
      },
      attributes: [
        {
          trait_type: "Total Supply",
          value: "1,000,000,000"
        },
        {
          trait_type: "Decimals", 
          value: "9"
        },
        {
          trait_type: "Network",
          value: "Solana"
        },
        {
          trait_type: "Use Case",
          value: "Social Media Platform"
        },
        {
          trait_type: "Launch Date",
          value: "2024"
        }
      ],
      tags: [
        "social-media",
        "creator-economy",
        "nft", 
        "defi"
      ]
    };

    // Step 3: Upload metadata JSON
    console.log('\n📄 Uploading metadata JSON...');
    const metadataHash = await uploadJSON(metadata, 'aeko-token-metadata.json');
    console.log('✅ Metadata uploaded to IPFS:', `https://ipfs.io/ipfs/${metadataHash}`);

    // Step 4: Save results
    const result = {
      logoHash,
      metadataHash,
      logoUrl: `https://ipfs.io/ipfs/${logoHash}`,
      metadataUrl: `https://ipfs.io/ipfs/${metadataHash}`,
      uploadedAt: new Date().toISOString()
    };

    fs.writeFileSync('./token-metadata-ipfs.json', JSON.stringify(result, null, 2));
    
    console.log('\n🎉 Upload completed successfully!');
    console.log('📍 Logo URL:', result.logoUrl);
    console.log('📍 Metadata URL:', result.metadataUrl);
    console.log('📝 Results saved to: token-metadata-ipfs.json');
    
    console.log('\n🔧 Next Step: Run the metadata update script');
    console.log('Command: node update-token-metadata.js');

    return result;

  } catch (error) {
    console.error('❌ Upload failed:', error.message);
    process.exit(1);
  }
}

uploadTokenMetadata();