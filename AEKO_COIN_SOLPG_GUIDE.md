# 🪙 Creating Aeko Coin using Solana Playground (Solpg)

## 🚀 **What is Solana Playground?**

**Solana Playground (Solpg)** is a browser-based IDE that allows you to write, deploy, and test Solana programs without any local setup. Perfect for creating the Aeko token!

**Access**: [https://beta.solpg.io](https://beta.solpg.io)

---

## 🎯 **Aeko Token Specifications**

```javascript
Token Details:
- Name: Aeko Coin
- Symbol: AEKO
- Decimals: 9 (like SOL)
- Total Supply: 1,000,000,000 AEKO
- Network: Solana Devnet (for testing) / Mainnet (for production)
- Standard: SPL Token
- Features: Mintable, Burnable, Transfer restrictions (optional)
```

---

## 📝 **Step-by-Step Guide**

### **Step 1: Access Solana Playground**

1. Go to [https://beta.solpg.io](https://beta.solpg.io)
2. Connect your Solana wallet (Phantom, Solflare, etc.)
3. Make sure you're on **Devnet** for testing
4. Get some Devnet SOL from the faucet if needed

### **Step 2: Create New Project**

1. Click **"New Project"**
2. Select **"Anchor"** framework
3. Name it **"aeko-coin"**
4. Choose **"Token Program"** template

---

## 💻 **Aeko Token Program Code**

### **`programs/aeko-coin/src/lib.rs`**

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, MintTo, Burn, Transfer};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("YOUR_PROGRAM_ID_WILL_BE_GENERATED");

#[program]
pub mod aeko_coin {
    use super::*;

    // Initialize the Aeko token
    pub fn initialize_token(
        ctx: Context<InitializeToken>,
        decimals: u8,
        name: String,
        symbol: String,
        uri: String,
    ) -> Result<()> {
        let token_info = &mut ctx.accounts.token_info;
        token_info.authority = ctx.accounts.authority.key();
        token_info.mint = ctx.accounts.mint.key();
        token_info.name = name;
        token_info.symbol = symbol;
        token_info.uri = uri;
        token_info.decimals = decimals;
        token_info.total_supply = 0;
        token_info.is_paused = false;
        
        msg!("Aeko Token initialized successfully!");
        msg!("Name: {}", token_info.name);
        msg!("Symbol: {}", token_info.symbol);
        msg!("Decimals: {}", token_info.decimals);
        
        Ok(())
    }

    // Mint Aeko tokens
    pub fn mint_tokens(
        ctx: Context<MintTokens>,
        amount: u64,
    ) -> Result<()> {
        let token_info = &mut ctx.accounts.token_info;
        
        require!(!token_info.is_paused, ErrorCode::TokenPaused);
        require!(
            ctx.accounts.authority.key() == token_info.authority,
            ErrorCode::UnauthorizedMint
        );

        // Mint tokens to the destination account
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.destination.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        
        token::mint_to(cpi_ctx, amount)?;
        
        // Update total supply
        token_info.total_supply = token_info.total_supply
            .checked_add(amount)
            .ok_or(ErrorCode::MathOverflow)?;

        msg!("Minted {} AEKO tokens", amount);
        msg!("Total supply: {}", token_info.total_supply);
        
        Ok(())
    }

    // Transfer tokens with platform fee
    pub fn transfer_with_fee(
        ctx: Context<TransferWithFee>,
        amount: u64,
        fee_percentage: u16, // Fee in basis points (100 = 1%)
    ) -> Result<()> {
        let token_info = &ctx.accounts.token_info;
        require!(!token_info.is_paused, ErrorCode::TokenPaused);

        // Calculate fee amount
        let fee_amount = (amount as u128)
            .checked_mul(fee_percentage as u128)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(10000)
            .ok_or(ErrorCode::MathOverflow)? as u64;
            
        let transfer_amount = amount
            .checked_sub(fee_amount)
            .ok_or(ErrorCode::InsufficientFunds)?;

        // Transfer main amount to recipient
        if transfer_amount > 0 {
            let cpi_accounts = Transfer {
                from: ctx.accounts.from.to_account_info(),
                to: ctx.accounts.to.to_account_info(),
                authority: ctx.accounts.from_authority.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
            
            token::transfer(cpi_ctx, transfer_amount)?;
        }

        // Transfer fee to platform account
        if fee_amount > 0 {
            let cpi_accounts = Transfer {
                from: ctx.accounts.from.to_account_info(),
                to: ctx.accounts.fee_account.to_account_info(),
                authority: ctx.accounts.from_authority.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
            
            token::transfer(cpi_ctx, fee_amount)?;
        }

        msg!("Transferred {} AEKO (fee: {})", transfer_amount, fee_amount);
        
        Ok(())
    }

    // Burn tokens (for deflationary mechanics)
    pub fn burn_tokens(
        ctx: Context<BurnTokens>,
        amount: u64,
    ) -> Result<()> {
        let token_info = &mut ctx.accounts.token_info;
        
        let cpi_accounts = Burn {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.from.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        
        token::burn(cpi_ctx, amount)?;
        
        // Update total supply
        token_info.total_supply = token_info.total_supply
            .checked_sub(amount)
            .ok_or(ErrorCode::InsufficientSupply)?;

        msg!("Burned {} AEKO tokens", amount);
        msg!("Total supply: {}", token_info.total_supply);
        
        Ok(())
    }

    // Pause/unpause token operations (emergency feature)
    pub fn set_pause_state(
        ctx: Context<SetPauseState>,
        is_paused: bool,
    ) -> Result<()> {
        let token_info = &mut ctx.accounts.token_info;
        
        require!(
            ctx.accounts.authority.key() == token_info.authority,
            ErrorCode::UnauthorizedOperation
        );

        token_info.is_paused = is_paused;
        
        msg!("Token pause state set to: {}", is_paused);
        
        Ok(())
    }

    // Update token metadata
    pub fn update_metadata(
        ctx: Context<UpdateMetadata>,
        name: Option<String>,
        symbol: Option<String>,
        uri: Option<String>,
    ) -> Result<()> {
        let token_info = &mut ctx.accounts.token_info;
        
        require!(
            ctx.accounts.authority.key() == token_info.authority,
            ErrorCode::UnauthorizedOperation
        );

        if let Some(new_name) = name {
            token_info.name = new_name;
        }
        if let Some(new_symbol) = symbol {
            token_info.symbol = new_symbol;
        }
        if let Some(new_uri) = uri {
            token_info.uri = new_uri;
        }

        msg!("Token metadata updated");
        
        Ok(())
    }
}

// Context structs
#[derive(Accounts)]
pub struct InitializeToken<'info> {
    #[account(
        init,
        payer = authority,
        space = TokenInfo::SIZE,
        seeds = [b"token_info", mint.key().as_ref()],
        bump
    )]
    pub token_info: Account<'info, TokenInfo>,
    
    #[account(
        init,
        payer = authority,
        mint::decimals = 9,
        mint::authority = authority,
    )]
    pub mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(
        mut,
        seeds = [b"token_info", mint.key().as_ref()],
        bump
    )]
    pub token_info: Account<'info, TokenInfo>,
    
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub destination: Account<'info, TokenAccount>,
    
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct TransferWithFee<'info> {
    #[account(
        seeds = [b"token_info", from.mint.key().as_ref()],
        bump
    )]
    pub token_info: Account<'info, TokenInfo>,
    
    #[account(mut)]
    pub from: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub to: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub fee_account: Account<'info, TokenAccount>,
    
    pub from_authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    #[account(
        mut,
        seeds = [b"token_info", mint.key().as_ref()],
        bump
    )]
    pub token_info: Account<'info, TokenInfo>,
    
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub from: Account<'info, TokenAccount>,
    
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SetPauseState<'info> {
    #[account(
        mut,
        seeds = [b"token_info", token_info.mint.key().as_ref()],
        bump
    )]
    pub token_info: Account<'info, TokenInfo>,
    
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateMetadata<'info> {
    #[account(
        mut,
        seeds = [b"token_info", token_info.mint.key().as_ref()],
        bump
    )]
    pub token_info: Account<'info, TokenInfo>,
    
    pub authority: Signer<'info>,
}

// Data structures
#[account]
pub struct TokenInfo {
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub decimals: u8,
    pub total_supply: u64,
    pub is_paused: bool,
}

impl TokenInfo {
    pub const SIZE: usize = 8 + // discriminator
        32 + // authority
        32 + // mint
        4 + 50 + // name (max 50 chars)
        4 + 10 + // symbol (max 10 chars)
        4 + 200 + // uri (max 200 chars)
        1 + // decimals
        8 + // total_supply
        1; // is_paused
}

// Error codes
#[error_code]
pub enum ErrorCode {
    #[msg("Token operations are currently paused")]
    TokenPaused,
    
    #[msg("Unauthorized mint operation")]
    UnauthorizedMint,
    
    #[msg("Unauthorized operation")]
    UnauthorizedOperation,
    
    #[msg("Math overflow")]
    MathOverflow,
    
    #[msg("Insufficient funds")]
    InsufficientFunds,
    
    #[msg("Insufficient supply for burn")]
    InsufficientSupply,
}
```

### **`Anchor.toml`**

```toml
[features]
seeds = false
skip-lint = false

[programs.devnet]
aeko_coin = "YOUR_PROGRAM_ID"

[registry]
url = "https://api.apr.dev"

[provider]
cluster = "devnet"
wallet = "~/.config/solana/id.json"

[scripts]
test = "yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts"

[toolchain]
```

### **`tests/aeko-coin.ts`**

```typescript
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AekoCoin } from "../target/types/aeko_coin";
import { 
  createMint, 
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID 
} from "@solana/spl-token";
import { assert } from "chai";

describe("aeko-coin", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.AekoCoin as Program<AekoCoin>;
  const authority = provider.wallet;

  let mint: anchor.web3.PublicKey;
  let tokenInfo: anchor.web3.PublicKey;
  let userTokenAccount: anchor.web3.PublicKey;

  before(async () => {
    // Create mint
    mint = await createMint(
      provider.connection,
      authority.payer,
      authority.publicKey,
      authority.publicKey,
      9 // decimals
    );

    // Find token info PDA
    [tokenInfo] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("token_info"), mint.toBuffer()],
      program.programId
    );

    // Create user token account
    const userTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      authority.payer,
      mint,
      authority.publicKey
    );
    userTokenAccount = userTokenAccountInfo.address;
  });

  it("Initialize Aeko Token", async () => {
    const tx = await program.methods
      .initializeToken(
        9, // decimals
        "Aeko Coin", // name
        "AEKO", // symbol
        "https://aeko.io/token-metadata.json" // uri
      )
      .accounts({
        tokenInfo,
        mint,
        authority: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    console.log("Initialize transaction signature", tx);

    // Verify token info
    const tokenInfoAccount = await program.account.tokenInfo.fetch(tokenInfo);
    assert.equal(tokenInfoAccount.name, "Aeko Coin");
    assert.equal(tokenInfoAccount.symbol, "AEKO");
    assert.equal(tokenInfoAccount.decimals, 9);
    assert.equal(tokenInfoAccount.totalSupply.toNumber(), 0);
    assert.equal(tokenInfoAccount.isPaused, false);
  });

  it("Mint Aeko Tokens", async () => {
    const mintAmount = new anchor.BN(1000000000 * 10**9); // 1 billion tokens

    const tx = await program.methods
      .mintTokens(mintAmount)
      .accounts({
        tokenInfo,
        mint,
        destination: userTokenAccount,
        authority: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("Mint transaction signature", tx);

    // Verify total supply updated
    const tokenInfoAccount = await program.account.tokenInfo.fetch(tokenInfo);
    assert.equal(tokenInfoAccount.totalSupply.toString(), mintAmount.toString());
  });

  it("Transfer with fee", async () => {
    // Create another user account for testing
    const recipient = anchor.web3.Keypair.generate();
    const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      authority.payer,
      mint,
      recipient.publicKey
    );

    // Create fee account (platform treasury)
    const feeAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      authority.payer,
      mint,
      authority.publicKey // Using authority as fee collector for test
    );

    const transferAmount = new anchor.BN(1000 * 10**9); // 1000 tokens
    const feePercentage = 250; // 2.5%

    const tx = await program.methods
      .transferWithFee(transferAmount, feePercentage)
      .accounts({
        tokenInfo,
        from: userTokenAccount,
        to: recipientTokenAccount.address,
        feeAccount: feeAccount.address,
        fromAuthority: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("Transfer with fee transaction signature", tx);
  });

  it("Burn tokens", async () => {
    const burnAmount = new anchor.BN(100 * 10**9); // 100 tokens

    const tx = await program.methods
      .burnTokens(burnAmount)
      .accounts({
        tokenInfo,
        mint,
        from: userTokenAccount,
        authority: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("Burn transaction signature", tx);

    // Verify total supply decreased
    const tokenInfoAccount = await program.account.tokenInfo.fetch(tokenInfo);
    console.log("Total supply after burn:", tokenInfoAccount.totalSupply.toString());
  });

  it("Pause and unpause token", async () => {
    // Pause token
    let tx = await program.methods
      .setPauseState(true)
      .accounts({
        tokenInfo,
        authority: authority.publicKey,
      })
      .rpc();

    console.log("Pause transaction signature", tx);

    let tokenInfoAccount = await program.account.tokenInfo.fetch(tokenInfo);
    assert.equal(tokenInfoAccount.isPaused, true);

    // Unpause token
    tx = await program.methods
      .setPauseState(false)
      .accounts({
        tokenInfo,
        authority: authority.publicKey,
      })
      .rpc();

    console.log("Unpause transaction signature", tx);

    tokenInfoAccount = await program.account.tokenInfo.fetch(tokenInfo);
    assert.equal(tokenInfoAccount.isPaused, false);
  });
});
```

---

## 🚀 **Deployment Steps in Solpg**

### **Step 3: Build the Program**

1. In Solpg, click **"Build"** button
2. Wait for compilation to complete
3. Fix any compilation errors if they occur

### **Step 4: Deploy to Devnet**

1. Make sure you have Devnet SOL in your wallet
2. Click **"Deploy"** button
3. Confirm the transaction in your wallet
4. Copy the **Program ID** that's generated

### **Step 5: Run Tests**

1. Click **"Test"** tab
2. Run the test suite to verify everything works
3. Check the console for transaction signatures

### **Step 6: Initialize Your Token**

```javascript
// In the Solpg terminal, run:
anchor test

// Or manually call the initialize function
anchor run initialize_token
```

---

## 🔧 **Token Metadata JSON**

Create this metadata file and host it on IPFS:

### **`aeko-token-metadata.json`**

```json
{
  "name": "Aeko Coin",
  "symbol": "AEKO",
  "description": "The native cryptocurrency of the Aeko social media platform. Use AEKO for NFT purchases, stream donations, giveaways, and platform rewards.",
  "image": "https://aeko.io/images/aeko-coin-logo.png",
  "external_url": "https://aeko.io",
  "properties": {
    "category": "fungible",
    "creators": [
      {
        "address": "YOUR_AUTHORITY_WALLET_ADDRESS",
        "share": 100
      }
    ]
  },
  "attributes": [
    {
      "trait_type": "Token Type",
      "value": "Utility Token"
    },
    {
      "trait_type": "Network",
      "value": "Solana"
    },
    {
      "trait_type": "Use Case",
      "value": "Social Media Platform Currency"
    },
    {
      "trait_type": "Total Supply",
      "value": "1,000,000,000"
    },
    {
      "trait_type": "Decimals",
      "value": "9"
    }
  ],
  "uses": [
    "NFT Marketplace Purchases",
    "Stream Donations",
    "Community Giveaways",
    "Platform Rewards",
    "User-to-User Transfers"
  ]
}
```

---

## 🔗 **Integration with Backend**

### **Update Your Backend Configuration**

```javascript
// In your .env file
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
AEKO_TOKEN_MINT=YOUR_DEPLOYED_TOKEN_MINT_ADDRESS
AEKO_PROGRAM_ID=YOUR_DEPLOYED_PROGRAM_ID
SOLANA_PRIVATE_KEY=YOUR_PLATFORM_WALLET_PRIVATE_KEY
```

### **Update `utils/solanaBlockchain.js`**

```javascript
// Replace the initializeAekoToken function
export const initializeAekoToken = async () => {
  // Token is already deployed via Solpg
  AEKO_TOKEN_MINT = new PublicKey(process.env.AEKO_TOKEN_MINT);
  console.log('Using deployed Aeko Token:', AEKO_TOKEN_MINT.toString());
  
  return {
    mintAddress: AEKO_TOKEN_MINT.toString(),
    programId: process.env.AEKO_PROGRAM_ID,
    initialSupply: AEKO_INITIAL_SUPPLY
  };
};
```

---

## 📊 **Solpg Deployment Checklist**

### **✅ Pre-Deployment**
- [ ] Wallet connected to Solpg
- [ ] Sufficient Devnet SOL for deployment
- [ ] Token metadata uploaded to IPFS
- [ ] Program code reviewed and tested

### **✅ Deployment Process**
- [ ] Code compiled successfully
- [ ] Program deployed to Devnet
- [ ] Program ID copied and saved
- [ ] Token initialized with metadata
- [ ] Initial supply minted to treasury

### **✅ Post-Deployment**
- [ ] Tests run successfully
- [ ] Token mint address configured in backend
- [ ] Program ID added to environment variables
- [ ] Integration tests with existing API
- [ ] Token functionality verified

---

## 🎯 **Advanced Features**

### **Token Economics Features**
- ✅ **Mintable** - Platform can mint new tokens for rewards
- ✅ **Burnable** - Deflationary mechanism for token burns
- ✅ **Transfer Fees** - Platform can collect fees on transfers
- ✅ **Pausable** - Emergency pause functionality
- ✅ **Metadata Updates** - Can update token information

### **Platform Integration**
- ✅ **NFT Marketplace** - Use AEKO for NFT purchases
- ✅ **Stream Donations** - Tip streamers with AEKO
- ✅ **Giveaways** - Mass distribution of tokens
- ✅ **Rewards System** - Platform rewards in AEKO
- ✅ **User Transfers** - P2P token transfers

---

## 🔧 **Troubleshooting**

### **Common Issues**
1. **Insufficient SOL** - Get more Devnet SOL from faucet
2. **Compilation Errors** - Check Rust syntax and dependencies
3. **Deployment Failures** - Verify wallet connection and SOL balance
4. **Test Failures** - Check account states and transaction ordering

### **Debug Tips**
- Use `console.log()` in tests for debugging
- Check Solana Explorer for transaction details
- Verify account balances before operations
- Use Solpg's built-in debugging tools

---

## 🎉 **Next Steps**

1. **Deploy on Solpg** following the steps above
2. **Test all functionality** using the provided test suite
3. **Update your backend** with the new token addresses
4. **Create token metadata** and upload to IPFS
5. **Integrate with your existing API** endpoints
6. **Deploy to Mainnet** when ready for production

---

**🚀 Your Aeko Coin will be live on Solana once deployed through Solpg!**

**Access Solana Playground at: [https://beta.solpg.io](https://beta.solpg.io)**