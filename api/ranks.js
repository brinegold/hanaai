import 'dotenv/config';
import { db } from '../server/db.js';
import { ranks, users, userRankAchievements, transactions } from '../shared/schema.js';
import { eq, desc, and, sql } from 'drizzle-orm';

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
  const pathMatch = url.match(/\/api\/ranks(?:\/(.+))?/);
  const path = pathMatch?.[1] || '';

  try {
    if (method === 'GET' && path === '') {
      // Get all ranks
      const allRanks = await db.select().from(ranks).orderBy(ranks.order);
      res.json({ ranks: allRanks });
    } else if (method === 'POST' && path === 'initialize') {
      // Initialize rank system with predefined ranks
      const predefinedRanks = [
        { name: "Manager", requiredVolume: "3000", incentiveAmount: "150", incentiveDescription: "$150 bonus", order: 1 },
        { name: "Leader", requiredVolume: "7000", incentiveAmount: "250", incentiveDescription: "$250 bonus", order: 2 },
        { name: "Ambassador", requiredVolume: "15000", incentiveAmount: "1000", incentiveDescription: "$1,000 bonus", order: 3 },
        { name: "Director", requiredVolume: "20000", incentiveAmount: "3000", incentiveDescription: "$3,000 + Apple watch", order: 4 },
        { name: "Executive", requiredVolume: "50000", incentiveAmount: "5000", incentiveDescription: "$5,000 + Laptop", order: 5 },
        { name: "Vice Chairman", requiredVolume: "100000", incentiveAmount: "10000", incentiveDescription: "$10,000 Bonus + A car reward", order: 6 },
        { name: "Chairman", requiredVolume: "500000", incentiveAmount: "20000", incentiveDescription: "$20,000 Bonus + A trip to UK", order: 7 },
        { name: "President", requiredVolume: "1000000", incentiveAmount: "30000", incentiveDescription: "$30,000 bonus + A House", order: 8 },
      ];

      // Insert ranks if they don't exist
      for (const rank of predefinedRanks) {
        const existing = await db.select().from(ranks).where(eq(ranks.name, rank.name));
        if (existing.length === 0) {
          await db.insert(ranks).values(rank);
        }
      }

      res.json({ success: true, message: "Ranks initialized successfully" });
    } else if (method === 'GET' && path.startsWith('check/')) {
      // Check and update user rank
      const userId = parseInt(path.replace('check/', ''));
      if (!userId) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      const totalVolume = await calculateUserVolume(userId);

      // Update user's total volume
      await db
        .update(users)
        .set({ totalVolumeGenerated: totalVolume.toString() })
        .where(eq(users.id, userId));

      // Get all ranks ordered by required volume (descending)
      const allRanks = await db.select().from(ranks).orderBy(desc(sql`CAST(${ranks.requiredVolume} AS DECIMAL)`));

      // Find the highest rank the user qualifies for
      let newRank = "none";
      let qualifiedRank = null;

      for (const rank of allRanks) {
        if (totalVolume >= parseFloat(rank.requiredVolume)) {
          newRank = rank.name;
          qualifiedRank = rank;
          break;
        }
      }

      // Get user's current rank
      const userResult = await db.select().from(users).where(eq(users.id, userId));
      const user = userResult[0];
      const currentRank = user?.currentRank || "none";

      // If user achieved a new rank
      if (newRank !== currentRank && qualifiedRank) {
        // Update user's current rank
        await db
          .update(users)
          .set({ currentRank: newRank })
          .where(eq(users.id, userId));

        // Check if user already received this rank's incentive
        const existingAchievement = await db
          .select()
          .from(userRankAchievements)
          .where(and(
            eq(userRankAchievements.userId, userId),
            eq(userRankAchievements.rankName, newRank)
          ));

        // If no existing achievement, create one and pay incentive
        if (existingAchievement.length === 0) {
          await db.insert(userRankAchievements).values({
            userId,
            rankName: newRank,
            incentivePaid: true,
            incentiveAmount: qualifiedRank.incentiveAmount,
            volumeAtAchievement: totalVolume.toString(),
          });

          // Add incentive to user's withdrawable balance
          const incentiveAmount = parseFloat(qualifiedRank.incentiveAmount);
          const currentWithdrawable = parseFloat(user?.withdrawableAmount || "0");
          
          await db
            .update(users)
            .set({ 
              withdrawableAmount: (currentWithdrawable + incentiveAmount).toString(),
              totalAssets: (parseFloat(user?.totalAssets || "0") + incentiveAmount).toString()
            })
            .where(eq(users.id, userId));

          // Create transaction record for the incentive
          await db.insert(transactions).values({
            userId,
            type: "Rank Incentive",
            amount: qualifiedRank.incentiveAmount,
            status: "Completed",
            reason: `Rank achievement: ${newRank}`,
          });

          res.json({ 
            success: true, 
            newRank, 
            incentivePaid: true, 
            incentiveAmount: qualifiedRank.incentiveAmount,
            totalVolume 
          });
        } else {
          res.json({ 
            success: true, 
            newRank, 
            incentivePaid: false, 
            message: "Rank updated but incentive already claimed",
            totalVolume 
          });
        }
      } else {
        res.json({ 
          success: true, 
          currentRank, 
          noRankChange: true, 
          totalVolume 
        });
      }
    } else if (method === 'GET' && path === 'achievements') {
      // Get user's rank achievements
      const userId = req.headers['user-id'];
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const achievements = await db
        .select()
        .from(userRankAchievements)
        .where(eq(userRankAchievements.userId, parseInt(userId)))
        .orderBy(desc(userRankAchievements.achievedAt));

      res.json({ achievements });
    } else {
      res.status(404).json({ error: 'Route not found' });
    }
  } catch (error) {
    console.error('Ranks API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Helper functions
async function calculateUserVolume(userId) {
  // Get user's own investments
  const userInvestments = await db
    .select({ amount: sql`COALESCE(SUM(${transactions.amount}), 0)` })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.type, "Deposit")));

  const ownInvestment = userInvestments[0]?.amount || 0;

  // Get downline investments (recursive referral tree)
  const downlineInvestments = await getDownlineInvestments(userId);

  return ownInvestment + downlineInvestments;
}

async function getDownlineInvestments(userId) {
  // Get direct referrals
  const directReferrals = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.referrerId, userId));

  let totalDownlineInvestment = 0;

  for (const referral of directReferrals) {
    // Get referral's investments
    const referralInvestments = await db
      .select({ amount: sql`COALESCE(SUM(${transactions.amount}), 0)` })
      .from(transactions)
      .where(and(eq(transactions.userId, referral.id), eq(transactions.type, "Deposit")));

    const referralAmount = referralInvestments[0]?.amount || 0;
    totalDownlineInvestment += referralAmount;

    // Recursively get their downline
    totalDownlineInvestment += await getDownlineInvestments(referral.id);
  }

  return totalDownlineInvestment;
}
