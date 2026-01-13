# ⚡ Quick Start - Address Recovery

## 🎯 Goal
Recover and transfer ~0.085 BNB from 100 generated addresses to your wallet.

## ⏱️ Time Required
- **Recovery:** 2-10 minutes
- **Transfer:** 5-30 minutes
- **Total:** 10-40 minutes

---

## 🚀 3-Step Process

### Step 1️⃣ Recover Addresses (2-10 min)

```bash
npx ts-node quick-recover.ts
```

**What happens:**
```
✓ Matched: 95
✗ Not found: 5
Total BNB: 0.0855
```

**Output file:** `recovered_addresses.json`

---

### Step 2️⃣ Transfer BNB (5-30 min)

```bash
npx ts-node transfer-recovered-bnb.ts
```

**You'll be asked:**
```
Enter target wallet address: 0x...
Leave BNB for gas fees (default 0.0001): [press Enter]
Proceed with transfer? (yes/no): yes
```

**What happens:**
```
[1/95] Transferring 0.0008 BNB from 0x...
  ✓ Success: 0x...
[2/95] Transferring 0.0008 BNB from 0x...
  ✓ Success: 0x...
...
```

**Output file:** `transfer_results.json`

---

### Step 3️⃣ Verify & Cleanup (1 min)

```bash
# Check results
cat transfer_results.json

# Delete sensitive file (IMPORTANT!)
rm recovered_addresses.json
```

---

## 📋 Checklist

- [ ] Have your target wallet address ready
- [ ] Run `quick-recover.ts`
- [ ] Verify `recovered_addresses.json` was created
- [ ] Run `transfer-recovered-bnb.ts`
- [ ] Check `transfer_results.json`
- [ ] Verify BNB in your wallet
- [ ] Delete `recovered_addresses.json`

---

## ⚠️ Important

### Before You Start
- ✅ Ensure you have a target wallet address
- ✅ Make sure you're on BSC testnet
- ✅ Have npm/node installed

### During Recovery
- ⏳ Don't interrupt the process
- 📊 Monitor the console output
- 🔍 Verify matched count

### During Transfer
- ✅ Double-check target address
- ⏳ Wait for all transfers to complete
- 📝 Save transfer results

### After Transfer
- 🗑️ **DELETE** `recovered_addresses.json`
- ✅ Verify funds in your wallet
- 📊 Keep `transfer_results.json` for records

---

## 🔑 Key Information

### Wallet Seed
If you used a custom seed during address generation:

```bash
npx ts-node quick-recover.ts --seed "your-custom-seed"
```

Default: `'default-seed'`

### Search Range
If you generated more than 10,000 addresses:

```bash
npx ts-node quick-recover.ts --max-id 50000
```

---

## 📊 What You'll Get

### recovered_addresses.json
```json
{
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
  "totalTransfers": 95,
  "successful": 94,
  "failed": 1,
  "results": [
    {
      "userId": 1,
      "address": "0x...",
      "status": "success",
      "txHash": "0x...",
      "amount": 0.0008
    }
  ]
}
```

---

## 🆘 Troubleshooting

### "No matching userId found"
```bash
# Try with custom seed
npx ts-node quick-recover.ts --seed "your-seed"

# Try larger search range
npx ts-node quick-recover.ts --max-id 50000
```

### "Transfer failed"
- Verify target address is correct
- Check network connectivity
- Ensure you have enough gas

### "File not found"
- Ensure `addresses_with_balances.json` exists
- Run from the correct directory

---

## 📚 Need More Help?

- **Overview:** `RECOVERY_SUMMARY.md`
- **Quick Reference:** `RECOVERY_README.md`
- **Detailed Guide:** `RECOVERY_GUIDE.md`
- **Complete Index:** `RECOVERY_TOOLS_INDEX.md`

---

## ✅ Success Indicators

### Recovery Success
```
✓ Matched: 95 (or similar high number)
✗ Not found: 5 (or similar low number)
Total BNB: 0.0855 (or similar amount)
```

### Transfer Success
```
✓ Successful: 94 (most transfers succeeded)
✗ Failed: 1 (few failures expected)
Total BNB Transferred: 0.0847 (most BNB transferred)
```

### Final Verification
- ✅ BNB appears in your wallet
- ✅ Transfer results saved
- ✅ Sensitive files deleted

---

## 🎉 You're Done!

Once you see BNB in your wallet:
1. ✅ Recovery successful
2. ✅ Transfer successful
3. ✅ Funds secured

---

## 📞 Quick Commands Reference

```bash
# Recover addresses
npx ts-node quick-recover.ts

# Recover with custom seed
npx ts-node quick-recover.ts --seed "my-seed"

# Recover with larger range
npx ts-node quick-recover.ts --max-id 50000

# Verify recovery
npx ts-node verify-recovery.ts

# Transfer BNB
npx ts-node transfer-recovered-bnb.ts

# Check transfer results
cat transfer_results.json

# Delete sensitive file
rm recovered_addresses.json
```

---

**Estimated Total Time:** 10-40 minutes
**Estimated Value:** $30-50 USD
**Difficulty:** Easy ✅

Start with Step 1️⃣ above!
