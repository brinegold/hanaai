# Address Recovery - Summary

## What You Have

- **File:** `addresses_with_balances.json` - Contains ~100 wallet addresses with ~0.0009 BNB each
- **Total BNB:** ~0.085 BNB (approximately $30-50 depending on price)
- **Generation Method:** Deterministic from userId + WALLET_SEED using SHA256

## What Was Created

I've created 4 recovery tools for you:

### 1. **quick-recover.ts** (Main Tool)
- Fast address recovery using address mapping
- Finds userId for each address
- Recovers private keys
- Saves to `recovered_addresses.json`

**Usage:**
```bash
npx ts-node quick-recover.ts
npx ts-node quick-recover.ts --seed "your-seed" --max-id 50000
```

### 2. **transfer-recovered-bnb.ts** (Transfer Tool)
- Interactive BNB transfer script
- Transfers from recovered addresses to your wallet
- Saves transfer results
- Handles gas fees automatically

**Usage:**
```bash
npx ts-node transfer-recovered-bnb.ts
```

### 3. **recover-addresses.ts** (Advanced Tool)
- Detailed recovery with logging
- Batch operations
- More control over process
- Useful for debugging

### 4. **Documentation**
- `RECOVERY_README.md` - Quick start guide
- `RECOVERY_GUIDE.md` - Detailed technical guide
- This file - Overview

## How to Use (3 Steps)

### Step 1: Recover Addresses
```bash
npx ts-node quick-recover.ts
```

**What happens:**
- Reads `addresses_with_balances.json`
- Generates addresses for userIds 1-10000
- Matches them with your addresses
- Creates `recovered_addresses.json` with private keys

**Expected output:**
```
✓ Matched: 95
✗ Not found: 5
Total BNB: 0.0855
```

### Step 2: Transfer BNB
```bash
npx ts-node transfer-recovered-bnb.ts
```

**What happens:**
- Loads recovered addresses
- Asks for your target wallet address
- Transfers BNB to your wallet
- Creates `transfer_results.json`

**You'll be asked:**
```
Enter target wallet address: 0x...
Leave BNB for gas fees (default 0.0001): 
Proceed with transfer? (yes/no): yes
```

### Step 3: Verify & Clean Up
```bash
# Check results
cat transfer_results.json

# Delete sensitive file (IMPORTANT!)
rm recovered_addresses.json
```

## Key Information

### Wallet Seed
The addresses were generated using:
```
seed = `${userId}-${WALLET_SEED}`
```

**Default:** `'default-seed'`

If you used a custom seed, use:
```bash
npx ts-node quick-recover.ts --seed "your-custom-seed"
```

### Search Range
By default, searches userIds 1-10000. If you generated more:
```bash
npx ts-node quick-recover.ts --max-id 50000
```

### Gas Fees
- Each transfer costs ~0.00001-0.00005 BNB
- Script reserves 0.0001 BNB per address by default
- Adjustable in transfer script

## Security Checklist

- ✅ `recovered_addresses.json` contains all private keys
- ✅ **NEVER** commit to git
- ✅ **NEVER** share with anyone
- ✅ **DELETE** after transferring funds
- ✅ Keep your `.env` WALLET_SEED safe

## Troubleshooting

### Addresses not found?
1. Check your WALLET_SEED value
2. Increase search range: `--max-id 50000`
3. Verify addresses are from this system

### Transfer failed?
1. Ensure target address is valid
2. Check network connectivity
3. Verify sufficient gas fees

### Performance slow?
- Searching 10,000 userIds takes ~2 minutes
- Searching 50,000 userIds takes ~10 minutes
- This is normal

## File Outputs

### recovered_addresses.json
```json
{
  "recoveredAt": "2024-01-15T10:30:00.000Z",
  "walletSeed": "default-seed",
  "totalRecovered": 95,
  "totalBNB": 0.0855,
  "addresses": [
    {
      "userId": 1,
      "address": "0x...",
      "privateKey": "0x...",
      "bnbBalance": 0.0009
    }
  ]
}
```

### transfer_results.json
```json
{
  "transferredAt": "2024-01-15T11:00:00.000Z",
  "totalTransfers": 95,
  "successful": 94,
  "failed": 1,
  "skipped": 0,
  "results": [...]
}
```

## Next Steps

1. **Prepare:** Ensure you have a target wallet address ready
2. **Recover:** Run `quick-recover.ts`
3. **Review:** Check `recovered_addresses.json`
4. **Transfer:** Run `transfer-recovered-bnb.ts`
5. **Verify:** Check `transfer_results.json`
6. **Cleanup:** Delete `recovered_addresses.json`

## Technical Details

### How Recovery Works

```
Input: addresses_with_balances.json
  ↓
Generate all possible addresses (userId 1 to N)
  ↓
Create address → userId mapping
  ↓
Match input addresses with generated addresses
  ↓
Extract private keys for matches
  ↓
Output: recovered_addresses.json
```

### How Transfer Works

```
For each recovered address:
  1. Get current BNB balance
  2. Calculate transfer amount (balance - gas fee)
  3. Get current nonce
  4. Build transaction
  5. Sign with private key
  6. Send to blockchain
  7. Record transaction hash
```

## Estimated Timeline

| Step | Time | Notes |
|------|------|-------|
| Recovery | 2-10 min | Depends on search range |
| Transfer | 5-30 min | Depends on number of addresses |
| Total | 10-40 min | Includes delays between transactions |

## Support

For detailed information, see:
- `RECOVERY_README.md` - Quick reference
- `RECOVERY_GUIDE.md` - Complete guide
- Script comments - Implementation details

## Summary

You now have tools to:
1. ✅ Recover private keys from your addresses
2. ✅ Transfer BNB to your main wallet
3. ✅ Track all transactions
4. ✅ Maintain security throughout

**Total BNB to recover:** ~0.085 BNB
**Estimated value:** $30-50 USD

---

**Created:** 2024-01-15
**Version:** 1.0.0
**Status:** Ready to use
