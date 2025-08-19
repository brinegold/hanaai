const { scrypt, randomBytes } = require("crypto");
const { promisify } = require("util");

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

async function generateDemoPasswords() {
  console.log("=== GENERATING HASHED PASSWORDS ===\n");
  
  // Generate hashed passwords
  const demoPassword = await hashPassword("password123");
  const demoSecurity = await hashPassword("security123");
  const adminPassword = await hashPassword("admin123");
  const adminSecurity = await hashPassword("adminsec123");
  const vipPassword = await hashPassword("vip123");
  const vipSecurity = await hashPassword("vipsec123");
  
  console.log("=== COMPLETE SQL COMMANDS ===\n");
  console.log(`-- Step 1: Create invite code
INSERT INTO invite_codes (code) VALUES ('DEMO123456');

-- Step 2: Create demo users with properly hashed passwords
-- Demo User (Login: demouser / password123, Security: security123)
INSERT INTO users (
  username, email, phone, telegram, password, security_password, 
  invite_code, referral_code, total_assets, quantitative_assets, 
  profit_assets, recharge_amount, today_earnings, yesterday_earnings, 
  commission_today, commission_assets, withdrawable_amount, 
  is_admin, is_banned, is_country_rep
) VALUES (
  'demouser', 'demo@tibank.com', '+1234567890', '@demouser', 
  '${demoPassword}', '${demoSecurity}', 
  'DEMO123456', 'USER123456', 1000.00, 500.00, 250.00, 1000.00, 
  15.00, 12.50, 5.00, 25.00, 275.00, false, false, false
);

-- Admin User (Login: admin / admin123, Security: adminsec123)  
INSERT INTO users (
  username, email, password, security_password, invite_code, 
  referral_code, total_assets, is_admin
) VALUES (
  'admin', 'admin@tibank.com', '${adminPassword}', '${adminSecurity}', 
  'DEMO123456', 'ADMIN123456', 5000.00, true
);

-- VIP User (Login: vipuser / vip123, Security: vipsec123)
INSERT INTO users (
  username, email, password, security_password, invite_code, 
  referral_code, total_assets, quantitative_assets, profit_assets, 
  today_earnings, yesterday_earnings
) VALUES (
  'vipuser', 'vip@tibank.com', '${vipPassword}', '${vipSecurity}', 
  'DEMO123456', 'VIP123456', 10000.00, 5000.00, 1500.00, 150.00, 145.00
);

-- Step 3: Create invite codes for new users  
INSERT INTO invite_codes (code, created_by_id) VALUES ('USER123456', (SELECT id FROM users WHERE username = 'demouser'));
INSERT INTO invite_codes (code, created_by_id) VALUES ('ADMIN123456', (SELECT id FROM users WHERE username = 'admin'));
INSERT INTO invite_codes (code, created_by_id) VALUES ('VIP123456', (SELECT id FROM users WHERE username = 'vipuser'));

-- Step 4: Add sample investment for VIP user
INSERT INTO investments (user_id, amount, plan, daily_rate, status) 
VALUES ((SELECT id FROM users WHERE username = 'vipuser'), 5000.00, 'VIP 1', 3.00, 'Active');

-- Step 5: Add sample transactions
INSERT INTO transactions (user_id, type, amount, status, network, address) 
VALUES 
((SELECT id FROM users WHERE username = 'demouser'), 'Deposit', 1000.00, 'Completed', 'TRON', 'TXyz123abc456def'),
((SELECT id FROM users WHERE username = 'vipuser'), 'Deposit', 5000.00, 'Completed', 'BSC', 'BSC456def789ghi');
`);

  console.log("\n=== LOGIN CREDENTIALS ===");
  console.log("Demo User: demouser / password123");
  console.log("Admin User: admin / admin123"); 
  console.log("VIP User: vipuser / vip123");
  console.log("Security passwords: security123, adminsec123, vipsec123");
}

generateDemoPasswords().catch(console.error);
