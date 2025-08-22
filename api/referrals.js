import 'dotenv/config';
import { db } from '../server/db.js';
import { referrals, users, transactions } from '../shared/schema.js';
import { eq, desc } from 'drizzle-orm';

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
  const path = url.replace('/api/referrals', '');

  try {
    if (method === 'GET' && path === '') {
      // Get user referrals
      const userId = req.headers['user-id'];
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const userReferrals = await db.select().from(referrals).where(eq(referrals.referrerId, parseInt(userId)));
      
      // Get detailed referral information
      const referralDetails = [];
      for (const referral of userReferrals) {
        const referredUserResult = await db.select().from(users).where(eq(users.id, referral.referredId));
        const referredUser = referredUserResult[0];
        
        if (referredUser) {
          // Get referred user's transaction stats
          const userTransactions = await db.select().from(transactions).where(eq(transactions.userId, referredUser.id));
          const totalDeposits = userTransactions
            .filter((tx) => tx.type === "Deposit" && tx.status === "Completed")
            .reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0);

          referralDetails.push({
            id: referral.id,
            level: referral.level,
            commission: referral.commission,
            totalDeposits: totalDeposits,
            createdAt: referral.createdAt,
            referredUser: {
              id: referredUser.id,
              username: referredUser.username,
              email: referredUser.email,
              createdAt: referredUser.createdAt,
              totalAssets: referredUser.totalAssets,
            },
          });
        }
      }

      res.json({ referrals: referralDetails });
    } else if (method === 'POST' && path === '/apply-country-rep') {
      // Apply for Country Representative
      const userId = req.headers['user-id'];
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const userResult = await db.select().from(users).where(eq(users.id, parseInt(userId)));
      const user = userResult[0];
      if (!user) return res.status(404).json({ error: 'User not found' });

      // Check if user meets requirements
      const userReferrals = await db.select().from(referrals).where(eq(referrals.referrerId, parseInt(userId)));
      let totalDownlineDeposits = 0;

      for (const referral of userReferrals) {
        const referredUserResult = await db.select().from(users).where(eq(users.id, referral.referredId));
        const referredUser = referredUserResult[0];
        if (referredUser) {
          totalDownlineDeposits += parseFloat(referredUser.rechargeAmount.toString());
        }
      }

      if (totalDownlineDeposits < 5000) {
        return res.status(400).json({
          message: "Total downline deposits must be at least $5000 to apply",
        });
      }

      await db.update(users).set({
        countryRepStatus: "pending",
      }).where(eq(users.id, parseInt(userId)));

      res.json({ message: "Application submitted successfully" });
    } else {
      res.status(404).json({ error: 'Route not found' });
    }
  } catch (error) {
    console.error('Referrals API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
