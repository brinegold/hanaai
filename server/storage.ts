import {
  users,
  inviteCodes,
  referrals,
  investments,
  transactions,
  notifications,
  transactionHistory,
  insertInviteCodeSchema,
  insertReferralSchema,
  insertInvestmentSchema,
  insertTransactionSchema,
  type Transaction,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, gte, lte } from "drizzle-orm";

export const storage = {
  async getPendingTransactions() {
    const pendingTransactions = await db
      .select({
        id: transactions.id,
        type: transactions.type,
        amount: transactions.amount,
        status: transactions.status,
        createdAt: transactions.createdAt,
        userId: transactions.userId,
        username: users.username,
        address: transactions.address,
        txHash: transactions.txHash,
      })
      .from(transactions)
      .where(eq(transactions.status, "Pending"))
      .innerJoin(users, eq(users.id, transactions.userId));
    return pendingTransactions;
  },

  async getTransaction(id: number) {
    const result = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, id));
    return result[0];
  },

  async updateTransaction(id: number, data: Partial<Transaction>) {
    const result = await db
      .update(transactions)
      .set(data)
      .where(eq(transactions.id, id))
      .returning();
    return result[0];
  },
  sessionStore: null,

  async createUser(userData) {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  },

  async getUserById(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  },

  async getUserByUsername(username) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return user;
  },

  async getUserByEmail(email) {
    if (!email) return null;
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  },

  async getUserByResetToken(token) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.resetToken, token));
    return user;
  },

  async getUserByPhone(phone) {
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    return user;
  },

  async getUserByTelegram(telegram) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.telegram, telegram));
    return user;
  },

  async getUser(id) {
    return this.getUserById(id);
  },

  async updateUser(id, updates) {
    
    // If this is a verification status update, we don't want to process referral bonus
    if (updates.verificationStatus) {
      const [updatedUser] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, id))
        .returning();
      return updatedUser;
    }

    // Handle other updates normally
    const [updatedUser] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  },

  async createInvestment(investmentData) {
    const [investment] = await db
      .insert(investments)
      .values(investmentData)
      .returning();
    return investment;
  },

  async getInvestmentsByUserId(userId) {
    return db.select().from(investments).where(eq(investments.userId, userId));
  },

  async createTransaction(transactionData) {
    const [transaction] = await db
      .insert(transactions)
      .values(transactionData)
      .returning();
    return transaction;
  },

  async getTransactionsByUserId(userId, filter = {}) {
    const conditions = [eq(transactions.userId, userId)];

    // Apply additional filters if provided
    if (filter.type) {
      conditions.push(eq(transactions.type, filter.type));
    }
    if (filter.status) {
      conditions.push(eq(transactions.status, filter.status));
    }
    if (filter.createdAt?.gte) {
      conditions.push(gte(transactions.createdAt, filter.createdAt.gte));
    }
    if (filter.createdAt?.lte) {
      conditions.push(lte(transactions.createdAt, filter.createdAt.lte));
    }

    return db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.createdAt));
  },

  async getTransactionByHash(txHash) {
    const [transaction] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.txHash, txHash));
    return transaction;
  },

  async createInviteCode(codeData) {
    const [code] = await db.insert(inviteCodes).values(codeData).returning();
    return code;
  },

  async getInviteCode(code) {
    const [inviteCode] = await db
      .select()
      .from(inviteCodes)
      .where(eq(inviteCodes.code, code));
    return inviteCode;
  },

  async useInviteCode(code, userId) {
    const inviteCode = await this.getInviteCode(code);
    return !!inviteCode;
  },

  async createWelcomeInviteCode() {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    return this.createInviteCode({ code, createdById: 1 });
  },

  async getReferralsByReferrerId(referrerId) {
    return db
      .select()
      .from(referrals)
      .where(eq(referrals.referrerId, referrerId));
  },

  async getReferralsByReferredId(referredId) {
    return db
      .select()
      .from(referrals)
      .where(eq(referrals.referredId, referredId));
  },

  async createReferral(referralData) {
    const [referral] = await db
      .insert(referrals)
      .values(referralData)
      .returning();
    return referral;
  },

  async updateReferral(
    id: number,
    data: Partial<typeof referrals.$inferSelect>,
  ) {
    const [referral] = await db
      .update(referrals)
      .set(data)
      .where(eq(referrals.id, id))
      .returning();
    return referral;
  },

  generateReferralCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  },

  async getAllUsers() {
    return db.select().from(users);
  },

  async getAllInvestments() {
    return db.select().from(investments);
  },

  async getAllTransactions() {
    return db.select().from(transactions);
  },

  async deleteUser(id: number) {
    // Delete all associated data first
    await db.delete(transactions).where(eq(transactions.userId, id));
    await db.delete(investments).where(eq(investments.userId, id));
    await db.delete(referrals).where(eq(referrals.referrerId, id));
    await db.delete(referrals).where(eq(referrals.referredId, id));
    await db.delete(notifications).where(eq(notifications.userId, id));
    // Finally delete the user
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result[0];
  },

  async createTransactionHistory(
    history: any,
  ) {
    const newHistory = await db
      .insert(transactionHistory)
      .values({
        transactionId: history.transactionId,
        status: history.status,
        timestamp: history.timestamp || new Date(),
        details: history.details,
      })
      .returning();
    return newHistory[0];
  },

  async createNotification(notificationData: any) {
    const [notification] = await db
      .insert(notifications)
      .values(notificationData)
      .returning();
    return notification;
  },
};

// Create the welcome invite code immediately
storage.createWelcomeInviteCode().catch((err) => {
  console.error("Failed to create welcome invite code:", err);
});
