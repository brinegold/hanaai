import 'dotenv/config';
import { db } from '../server/db.js';
import { users, referrals, transactions, investments, notifications } from '../shared/schema.js';
import { eq, desc, and } from 'drizzle-orm';
import { scrypt, timingSafeEqual, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

// Helper function to compare passwords
async function comparePasswords(supplied, stored) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = await scryptAsync(supplied, salt, 64);
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { method, url } = req;
  const path = url.replace('/api/users', '');

  try {
    if (method === 'GET' && path === '/account') {
      // Get user account information
      const userId = req.headers['user-id']; // In production, get from session
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const userResult = await db.select().from(users).where(eq(users.id, parseInt(userId)));
      const user = userResult[0];
      if (!user) return res.status(404).json({ error: 'User not found' });

      // Get investments, transactions, and referrals
      const investmentResults = await db.select().from(investments).where(eq(investments.userId, user.id));
      const transactionResults = await db.select().from(transactions).where(eq(transactions.userId, user.id));
      const referralResults = await db.select().from(referrals).where(eq(referrals.referrerId, user.id));
      const userNotifications = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, user.id))
        .orderBy(desc(notifications.createdAt));

      // Calculate statistics
      const totalInvested = investmentResults.reduce(
        (sum, inv) => sum + parseFloat(inv.amount.toString()),
        0,
      );
      const currentBalance = parseFloat(user.totalAssets.toString());
      const totalProfit = parseFloat(user.profitAssets.toString());

      res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          telegram: user.telegram,
          referralCode: user.referralCode,
          totalAssets: user.totalAssets,
          quantitativeAssets: user.quantitativeAssets,
          profitAssets: user.profitAssets,
          todayEarnings: user.todayEarnings,
          yesterdayEarnings: user.yesterdayEarnings,
          lastInvestmentDate: user.lastInvestmentDate,
          createdAt: user.createdAt,
          notifications: userNotifications,
        },
        stats: {
          totalInvested,
          currentBalance,
          totalProfit,
          activeInvestments: investmentResults.filter(
            (inv) => inv.status === "Active",
          ).length,
          referralsCount: referralResults.length,
        },
      });
    } else if (method === 'PATCH' && path === '/account') {
      // Update account information
      const userId = req.headers['user-id'];
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { email, phone, telegram } = req.body;
      const userData = {};

      if (email) userData.email = email;
      if (phone) userData.phone = phone;
      if (telegram) userData.telegram = telegram;

      await db.update(users).set(userData).where(eq(users.id, parseInt(userId)));
      const updatedUserResult = await db.select().from(users).where(eq(users.id, parseInt(userId)));
      const updatedUser = updatedUserResult[0];
      if (!updatedUser) return res.status(404).json({ error: 'User not found' });

      const { password, securityPassword, ...userWithoutPasswords } = updatedUser;
      res.json(userWithoutPasswords);
    } else if (method === 'GET' && path === '/profile') {
      // Get user profile with referrals
      const userId = req.headers['user-id'];
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const userResult = await db.select().from(users).where(eq(users.id, parseInt(userId)));
      const user = userResult[0];
      if (!user) return res.status(404).json({ error: 'User not found' });

      // Get referrals with details
      const referralResults = await db.select().from(referrals).where(eq(referrals.referrerId, user.id));
      const referralDetails = [];

      for (const referral of referralResults) {
        const referredUserResult = await db.select().from(users).where(eq(users.id, referral.referredId));
        const referredUser = referredUserResult[0];
        if (referredUser) {
          const userTransactions = await db.select().from(transactions).where(eq(transactions.userId, referredUser.id));
          const totalDeposits = userTransactions
            .filter((tx) => tx.type === "Deposit" && tx.status === "Completed")
            .reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0);

          referralDetails.push({
            id: referral.id,
            level: referral.level,
            commission: referral.commission,
            totalDeposits: totalDeposits,
            referredUser: {
              id: referredUser.id,
              username: referredUser.username,
              createdAt: referredUser.createdAt,
            },
          });
        }
      }

      const { password, securityPassword, ...userWithoutPasswords } = user;
      res.json({
        profile: userWithoutPasswords,
        referrals: referralDetails,
      });
    } else if (method === 'POST' && path === '/verify-security-password') {
      // Verify security password
      const userId = req.headers['user-id'];
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { securityPassword } = req.body;
      if (!securityPassword) {
        return res.status(400).json({ message: "Security password is required" });
      }

      const userResult = await db.select().from(users).where(eq(users.id, parseInt(userId)));
      const user = userResult[0];
      if (!user) return res.status(404).json({ message: "User not found" });

      const isValid = await comparePasswords(securityPassword, user.securityPassword);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid security password" });
      }

      res.status(200).json({ success: true });
    } else if (method === 'POST' && path === '/change-password') {
      // Change password
      const userId = req.headers['user-id'];
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current and new passwords are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters" });
      }

      const userResult = await db.select().from(users).where(eq(users.id, parseInt(userId)));
      const user = userResult[0];
      if (!user) return res.status(404).json({ message: "User not found" });

      // Verify current password
      const isCurrentPasswordValid = await comparePasswords(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      // Hash new password
      const salt = randomBytes(16).toString('hex');
      const hashedPassword = await scryptAsync(newPassword, salt, 64);
      const newHashedPassword = `${hashedPassword.toString('hex')}.${salt}`;

      await db.update(users).set({ password: newHashedPassword }).where(eq(users.id, parseInt(userId)));

      res.json({ success: true, message: "Password changed successfully" });
    } else if (method === 'GET' && path === '/dashboard/stats') {
      // Get dashboard statistics
      const userId = req.headers['user-id'];
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const userResult = await db.select().from(users).where(eq(users.id, parseInt(userId)));
      const user = userResult[0];
      if (!user) return res.status(404).json({ error: 'User not found' });

      const investmentResults = await db.select().from(investments).where(eq(investments.userId, user.id));
      const activeInvestments = investmentResults.filter((inv) => inv.status === "Active");
      const referralResults = await db.select().from(referrals).where(eq(referrals.referrerId, user.id));

      res.json({
        totalAssets: user.totalAssets,
        quantitativeAssets: user.quantitativeAssets,
        profitAssets: user.profitAssets,
        todayEarnings: user.todayEarnings,
        yesterdayEarnings: user.yesterdayEarnings,
        commissionToday: user.commissionToday,
        activeInvestmentsCount: activeInvestments.length,
        referralsCount: referralResults.length,
      });
    } else {
      res.status(404).json({ error: 'Route not found' });
    }
  } catch (error) {
    console.error('Users API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
