import {
  pgTable,
  text,
  serial,
  numeric,
  timestamp,
  boolean,
  integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email"),
  phone: text("phone"),
  telegram: text("telegram"),
  password: text("password").notNull(),
  securityPassword: text("security_password").notNull(),
  inviteCode: text("invite_code"),
  referralCode: text("referral_code").notNull().unique(),
  currentRank: text("current_rank").default("none").notNull(),
  totalVolumeGenerated: numeric("total_volume_generated", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),
  totalAssets: numeric("total_assets", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),
  quantitativeAssets: numeric("quantitative_assets", {
    precision: 10,
    scale: 2,
  })
    .default("0")
    .notNull(),
  profitAssets: numeric("profit_assets", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),
  rechargeAmount: numeric("recharge_amount", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),
  todayEarnings: numeric("today_earnings", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),
  yesterdayEarnings: numeric("yesterday_earnings", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),
  commissionToday: numeric("commission_today", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),
  commissionAssets: numeric("commission_assets", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),
  weeklyCommissionEarned: numeric("weekly_commission_earned", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),
  weeklySalaryPaid: numeric("weekly_salary_paid", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),
  lastSalaryDate: timestamp("last_salary_date"),
  withdrawableAmount: numeric("withdrawable_amount", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),
  directDepositAmount: numeric("direct_deposit_amount", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),
  totalWithdrawnFromDeposits: numeric("total_withdrawn_from_deposits", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),
  referralBonuses: numeric("referral_bonuses", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),
  rankingBonuses: numeric("ranking_bonuses", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),
  lastInvestmentDate: timestamp("last_investment_date"),
  referrerId: integer("referrer_id"),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  verificationStatus: text("verification_status").default('unverified'),
  verificationSubmittedAt: timestamp("verification_submitted_at"),
  isAdmin: boolean("is_admin").default(false).notNull(),
  isBanned: boolean("is_banned").default(false).notNull(),
  isCountryRep: boolean("is_country_rep").default(false).notNull(),
  countryRepStatus: text("country_rep_status").default("none"),  // none, pending, approved
  bscWalletAddress: text("bsc_wallet_address"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const inviteCodes = pgTable("invite_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  createdById: serial("created_by_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: serial("referrer_id").notNull(),
  referredId: serial("referred_id").notNull(),
  level: text("level").notNull(), // Level 1, 2, or 3
  commission: numeric("commission", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const investments = pgTable("investments", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  plan: text("plan").notNull(), // Basic, Premium, or VIP
  dailyRate: numeric("daily_rate", { precision: 5, scale: 2 }).notNull(),
  status: text("status").notNull(), // Active or Completed
  startDate: timestamp("start_date").defaultNow().notNull(),
  endDate: timestamp("end_date"),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").notNull(),
  type: text("type").notNull(), // Deposit, Withdrawal, Profit, Commission, Salary
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull(), // Pending, Processing, Completed, Failed
  reason: text("reason"), // For failed transactions
  network: text("network"), // TRON, BSC etc
  address: text("address"), // Wallet address
  fee: numeric("fee", { precision: 10, scale: 2 }), // Transaction fee
  processingTime: timestamp("processing_time"), // When processing started
  completionTime: timestamp("completion_time"), // When transaction completed/failed
  txHash: text("tx_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "system", "transaction"
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  referrer: one(users, {
    fields: [users.referrerId],
    references: [users.id],
  }),
  referrals: many(referrals, { relationName: "referrer_referrals" }),
  investments: many(investments),
  transactions: many(transactions),
  createdInviteCodes: many(inviteCodes, {
    relationName: "created_invite_codes",
  }),
  usedInviteCode: one(inviteCodes, {
    fields: [users.inviteCode],
    references: [inviteCodes.code],
  }),
}));

export const referralsRelations = relations(referrals, ({ one }) => ({
  referrer: one(users, {
    fields: [referrals.referrerId],
    references: [users.id],
    relationName: "referrer_referrals",
  }),
  referred: one(users, {
    fields: [referrals.referredId],
    references: [users.id],
  }),
}));

export const investmentsRelations = relations(investments, ({ one }) => ({
  user: one(users, {
    fields: [investments.userId],
    references: [users.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
}));

export const inviteCodesRelations = relations(inviteCodes, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [inviteCodes.createdById],
    references: [users.id],
    relationName: "created_invite_codes",
  }),
  users: many(users),
}));

// Insert Schemas
export const insertUserSchema = createInsertSchema(users)
  .omit({
    id: true,
    referralCode: true,
    totalAssets: true,
    quantitativeAssets: true,
    profitAssets: true,
    rechargeAmount: true,
    todayEarnings: true,
    yesterdayEarnings: true,
    commissionToday: true,
    commissionAssets: true,
    createdAt: true,
    referrerId: true,
    resetToken: true,
    resetTokenExpiry: true,
    updatedAt: true,
  })
  .extend({
    email: z.string().email().optional(),
    phone: z.string().optional(),
    telegram: z.string().optional(),
    username: z.string().min(3).max(50),
    password: z.string().min(6),
    securityPassword: z.string().min(6),
    inviteCode: z.string().min(6).max(10),
  });

export const insertReferralSchema = createInsertSchema(referrals).omit({
  id: true,
  createdAt: true,
});

export const insertInvestmentSchema = createInsertSchema(investments)
  .omit({
    id: true,
    userId: true,
    startDate: true,
    endDate: true,
    status: true,
  })
  .extend({
    amount: z.number().min(5).max(500000),
    plan: z.string(),
    dailyRate: z.number(),
  });

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertInviteCodeSchema = createInsertSchema(inviteCodes).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Referral = typeof referrals.$inferSelect;
export type Investment = typeof investments.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export const transactionHistory = pgTable("transaction_history", {
  id: serial("id").primaryKey(),
  transactionId: integer("transaction_id").references(() => transactions.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  details: text("details"),
});

export const ranks = pgTable("ranks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  requiredVolume: numeric("required_volume", { precision: 12, scale: 2 }).notNull(),
  incentiveAmount: numeric("incentive_amount", { precision: 10, scale: 2 }).notNull(),
  incentiveDescription: text("incentive_description").notNull(),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userRankAchievements = pgTable("user_rank_achievements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  rankName: text("rank_name").notNull(),
  achievedAt: timestamp("achieved_at").defaultNow().notNull(),
  incentivePaid: boolean("incentive_paid").default(false).notNull(),
  incentiveAmount: numeric("incentive_amount", { precision: 10, scale: 2 }).notNull(),
  volumeAtAchievement: numeric("volume_at_achievement", { precision: 12, scale: 2 }).notNull(),
});

export const bscTransactions = pgTable("bsc_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  transactionHash: text("transaction_hash").notNull().unique(),
  blockNumber: integer("block_number"),
  fromAddress: text("from_address").notNull(),
  toAddress: text("to_address").notNull(),
  amount: numeric("amount", { precision: 18, scale: 8 }).notNull(),
  type: text("type").notNull(), // "deposit" or "withdrawal"
  status: text("status").default("pending").notNull(), // "pending", "confirmed", "failed"
  processed: boolean("processed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
});

export const bscMonitoring = pgTable("bsc_monitoring", {
  id: serial("id").primaryKey(),
  lastProcessedBlock: integer("last_processed_block").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type InviteCode = typeof inviteCodes.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type TransactionHistory = typeof transactionHistory.$inferSelect;
export type Rank = typeof ranks.$inferSelect;
export type UserRankAchievement = typeof userRankAchievements.$inferSelect;
export type BSCTransaction = typeof bscTransactions.$inferSelect;
export type BSCMonitoring = typeof bscMonitoring.$inferSelect;

export const insertRankSchema = createInsertSchema(ranks).omit({
  id: true,
  createdAt: true,
});

export const insertUserRankAchievementSchema = createInsertSchema(userRankAchievements).omit({
  id: true,
  achievedAt: true,
});