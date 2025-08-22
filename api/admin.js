import 'dotenv/config';
import { db } from '../server/db.js';
import { users, transactions, investments, notifications } from '../shared/schema.js';
import { eq, desc, and, or, like } from 'drizzle-orm';

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
  const path = url.replace('/api/admin', '');

  // Check admin authorization
  const userId = req.headers['user-id'];
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const userResult = await db.select().from(users).where(eq(users.id, parseInt(userId)));
  const user = userResult[0];
  if (!user?.isAdmin) return res.status(403).json({ error: 'Admin access required' });

  try {
    if (method === 'GET' && path === '/users') {
      // Get all users with pagination
      const { page = 1, limit = 20, search = '' } = req.query;
      const offset = (page - 1) * limit;

      let query = db.select().from(users);
      
      if (search) {
        query = query.where(
          or(
            like(users.username, `%${search}%`),
            like(users.email, `%${search}%`)
          )
        );
      }

      const allUsers = await query
        .limit(parseInt(limit))
        .offset(offset)
        .orderBy(desc(users.createdAt));

      // Remove sensitive data
      const sanitizedUsers = allUsers.map(user => {
        const { password, securityPassword, resetToken, ...safeUser } = user;
        return safeUser;
      });

      res.json({ users: sanitizedUsers });
    } else if (method === 'GET' && path === '/transactions') {
      // Get all transactions with pagination
      const { page = 1, limit = 50, status = '', type = '' } = req.query;
      const offset = (page - 1) * limit;

      let query = db.select().from(transactions);
      
      if (status) {
        query = query.where(eq(transactions.status, status));
      }
      if (type) {
        query = query.where(eq(transactions.type, type));
      }

      const allTransactions = await query
        .limit(parseInt(limit))
        .offset(offset)
        .orderBy(desc(transactions.createdAt));

      res.json({ transactions: allTransactions });
    } else if (method === 'PATCH' && path.startsWith('/transactions/')) {
      // Update transaction status
      const transactionId = parseInt(path.replace('/transactions/', ''));
      const { status, reason } = req.body;

      if (!['Pending', 'Completed', 'Failed'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const transactionResult = await db.select().from(transactions).where(eq(transactions.id, transactionId));
      const transaction = transactionResult[0];
      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      // Update transaction
      await db.update(transactions).set({
        status,
        reason: reason || null,
        completionTime: status === 'Completed' ? new Date() : null,
      }).where(eq(transactions.id, transactionId));

      // Handle balance updates for withdrawals
      if (transaction.type === 'Withdrawal' && status === 'Completed') {
        const userResult = await db.select().from(users).where(eq(users.id, transaction.userId));
        const transactionUser = userResult[0];
        
        if (transactionUser) {
          const withdrawalAmount = parseFloat(transaction.amount.toString());
          const fee = parseFloat(transaction.fee?.toString() || '0');
          const totalDeduction = withdrawalAmount + fee;

          await db.update(users).set({
            totalAssets: (parseFloat(transactionUser.totalAssets.toString()) - totalDeduction).toString(),
            quantitativeAssets: (parseFloat(transactionUser.quantitativeAssets.toString()) - totalDeduction).toString(),
          }).where(eq(users.id, transaction.userId));
        }
      }

      res.json({ success: true, message: 'Transaction updated successfully' });
    } else if (method === 'GET' && path === '/stats') {
      // Get admin dashboard statistics
      const totalUsersResult = await db.select().from(users);
      const totalUsers = totalUsersResult.length;

      const totalTransactionsResult = await db.select().from(transactions);
      const totalTransactions = totalTransactionsResult.length;

      const pendingTransactionsResult = await db.select().from(transactions).where(eq(transactions.status, 'Pending'));
      const pendingTransactions = pendingTransactionsResult.length;

      const totalDeposits = totalTransactionsResult
        .filter(tx => tx.type === 'Deposit' && tx.status === 'Completed')
        .reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0);

      const totalWithdrawals = totalTransactionsResult
        .filter(tx => tx.type === 'Withdrawal' && tx.status === 'Completed')
        .reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0);

      const activeInvestmentsResult = await db.select().from(investments).where(eq(investments.status, 'Active'));
      const activeInvestments = activeInvestmentsResult.length;

      res.json({
        totalUsers,
        totalTransactions,
        pendingTransactions,
        totalDeposits,
        totalWithdrawals,
        activeInvestments,
      });
    } else if (method === 'POST' && path === '/notifications') {
      // Send notification to user(s)
      const { userId: targetUserId, title, message, type = 'info' } = req.body;

      if (!title || !message) {
        return res.status(400).json({ error: 'Title and message are required' });
      }

      if (targetUserId) {
        // Send to specific user
        await db.insert(notifications).values({
          userId: parseInt(targetUserId),
          title,
          message,
          type,
          isRead: false,
        });
      } else {
        // Send to all users
        const allUsers = await db.select({ id: users.id }).from(users);
        const notificationPromises = allUsers.map(user =>
          db.insert(notifications).values({
            userId: user.id,
            title,
            message,
            type,
            isRead: false,
          })
        );
        await Promise.all(notificationPromises);
      }

      res.json({ success: true, message: 'Notification sent successfully' });
    } else if (method === 'PATCH' && path.startsWith('/users/')) {
      // Update user account
      const targetUserId = parseInt(path.replace('/users/', ''));
      const updates = req.body;

      // Remove sensitive fields that shouldn't be updated via admin
      const { password, securityPassword, resetToken, ...safeUpdates } = updates;

      await db.update(users).set({
        ...safeUpdates,
        updatedAt: new Date(),
      }).where(eq(users.id, targetUserId));

      res.json({ success: true, message: 'User updated successfully' });
    } else if (method === 'POST' && path === '/trigger-salary-payout') {
      // Manual salary payout trigger (placeholder)
      // In production, this would trigger the salary scheduler
      res.json({ success: true, message: "Weekly salary payout triggered" });
    } else {
      res.status(404).json({ error: 'Route not found' });
    }
  } catch (error) {
    console.error('Admin API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
