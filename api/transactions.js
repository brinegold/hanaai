import 'dotenv/config';
import { db } from '../server/db.js';
import { transactions, users } from '../shared/schema.js';
import { eq, desc, and } from 'drizzle-orm';

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
  const path = url.replace('/api/transactions', '');

  try {
    if (method === 'GET' && path === '') {
      // Get user transactions
      const userId = req.headers['user-id'];
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { type, status, startDate, endDate } = req.query;

      // Build filter object
      const filter = { userId: parseInt(userId) };
      if (type) filter.type = type;
      if (status) filter.status = status;

      let query = db.select().from(transactions).where(eq(transactions.userId, parseInt(userId)));
      
      if (type) {
        query = query.where(eq(transactions.type, type));
      }
      if (status) {
        query = query.where(eq(transactions.status, status));
      }

      const userTransactions = await query.orderBy(desc(transactions.createdAt));

      // Calculate totals
      const totals = userTransactions.reduce(
        (acc, tx) => {
          const amount = parseFloat(tx.amount.toString());
          if (tx.status === "Completed") {
            if (tx.type === "Deposit") acc.totalDeposits += amount;
            else if (tx.type === "Withdrawal") acc.totalWithdrawals += amount;
            else if (tx.type === "Profit") acc.totalProfits += amount;
          }
          return acc;
        },
        { totalDeposits: 0, totalWithdrawals: 0, totalProfits: 0 },
      );

      res.json({ transactions: userTransactions, totals });
    } else if (method === 'POST' && path === '') {
      // Create new transaction (deposit/withdrawal)
      const userId = req.headers['user-id'];
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { type, amount, network, address, fee, txHash } = req.body;

      if (!type || !amount) {
        return res.status(400).json({ error: 'Type and amount are required' });
      }

      if (!['Deposit', 'Withdrawal'].includes(type)) {
        return res.status(400).json({ error: 'Invalid transaction type' });
      }

      if (amount < 0.01) {
        return res.status(400).json({ error: 'Amount must be at least 0.01' });
      }

      const userResult = await db.select().from(users).where(eq(users.id, parseInt(userId)));
      const user = userResult[0];
      if (!user) return res.status(404).json({ error: 'User not found' });

      const existingTransactions = await db.select().from(transactions).where(eq(transactions.userId, parseInt(userId)));
      const completedDeposits = existingTransactions.filter(
        (t) => t.type === "Deposit" && t.status === "Completed",
      );

      if (type === "Deposit") {
        // Check for minimum deposit
        if (amount < 10) {
          return res.status(400).json({
            message: "Minimum deposit amount is $10",
          });
        }
        
        // Calculate 95% of deposit amount (5% platform fee)
        const depositAmount = amount;
        const platformFee = depositAmount * 0.05;
        const userReceives = depositAmount * 0.95;
        
        // Update user's balance with 95% of the deposit
        const currentTotalAssets = parseFloat(user.totalAssets.toString());
        const newTotalAssets = (currentTotalAssets + userReceives).toString();
        
        await db.update(users).set({
          totalAssets: newTotalAssets,
          quantitativeAssets: newTotalAssets,
          withdrawableAmount: (parseFloat(user.withdrawableAmount.toString()) + userReceives).toString(),
        }).where(eq(users.id, parseInt(userId)));
      } else if (type === "Withdrawal") {
        // Check for minimum withdrawal
        if (amount < 1) {
          return res.status(400).json({
            message: "Minimum withdrawal amount is $1",
          });
        }

        // Calculate 10% withdrawal fee
        const withdrawalFee = amount * 0.1;
        const totalAmount = amount + withdrawalFee;
        
        // Check sufficient funds for withdrawal (including 10% fee)
        if (parseFloat(user.totalAssets.toString()) < totalAmount) {
          return res.status(400).json({ 
            message: "Insufficient funds for withdrawal (including 10% fee)" 
          });
        }
      }

      // Create the transaction record
      const transactionToCreate = {
        amount: amount.toString(),
        type: type,
        status: "Pending",
        network: network || null,
        address: address || null,
        fee: type === "Withdrawal" ? (amount * 0.1).toString() : "0",
        txHash: txHash || null,
        userId: parseInt(userId),
      };

      const transactionResult = await db.insert(transactions).values(transactionToCreate).returning();
      const transaction = transactionResult[0];

      const response = {
        success: true,
        transaction,
      };

      // Add bonus info if applicable
      if (type === "Deposit" && completedDeposits.length === 0) {
        response.welcomeBonus = {
          amount: (amount * 0.1).toFixed(2),
          percentage: "10%",
        };
      }

      res.status(201).json(response);
    } else {
      res.status(404).json({ error: 'Route not found' });
    }
  } catch (error) {
    console.error('Transactions API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
