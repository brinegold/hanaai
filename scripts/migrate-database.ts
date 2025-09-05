import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../shared/schema.js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Source database (current Neon)
const sourceConnectionString = process.env.DATABASE_URL;
if (!sourceConnectionString) {
  throw new Error("DATABASE_URL not found in environment variables");
}

// Target database (new database)
const targetConnectionString = process.env.NEW_DATABASE_URL;
if (!targetConnectionString) {
  throw new Error("NEW_DATABASE_URL not found in environment variables");
}

const sourceClient = postgres(sourceConnectionString);
const targetClient = postgres(targetConnectionString);

const sourceDb = drizzle(sourceClient, { schema });
const targetDb = drizzle(targetClient, { schema });

async function checkTableExists(db: any, tableName: string): Promise<boolean> {
  try {
    const result = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '${tableName}'
      );
    `);
    return result[0]?.exists || false;
  } catch {
    return false;
  }
}

async function migrateData() {
  console.log("Starting database migration...");
  
  try {
    // First, ensure schema exists on target database
    console.log("Checking target database schema...");
    
    // Check if basic tables exist, if not, we need to create schema first
    const usersTableExists = await checkTableExists(targetDb, 'users');
    
    if (!usersTableExists) {
      console.log("⚠️  Target database schema not found. Please run the following steps first:");
      console.log("1. Update your drizzle.config.ts to point to the new database");
      console.log("2. Run: npm run db:push");
      console.log("3. Revert drizzle.config.ts back to original");
      console.log("4. Run this migration script again");
      return;
    }
    // 1. Migrate users (must be first due to foreign key constraints)
    console.log("Migrating users...");
    try {
      const users = await sourceDb.select().from(schema.users);
      if (users.length > 0) {
        await targetDb.insert(schema.users).values(users);
        console.log(`Migrated ${users.length} users`);
      } else {
        console.log("No users to migrate");
      }
    } catch (error) {
      console.log(`Skipping users migration: ${error.message}`);
    }

    // 2. Migrate invite codes
    console.log("Migrating invite codes...");
    try {
      const inviteCodes = await sourceDb.select().from(schema.inviteCodes);
      if (inviteCodes.length > 0) {
        await targetDb.insert(schema.inviteCodes).values(inviteCodes);
        console.log(`Migrated ${inviteCodes.length} invite codes`);
      } else {
        console.log("No invite codes to migrate");
      }
    } catch (error) {
      console.log(`Skipping invite codes migration: ${error.message}`);
    }

    // 3. Migrate referrals
    console.log("Migrating referrals...");
    try {
      const referrals = await sourceDb.select().from(schema.referrals);
      if (referrals.length > 0) {
        await targetDb.insert(schema.referrals).values(referrals);
        console.log(`Migrated ${referrals.length} referrals`);
      } else {
        console.log("No referrals to migrate");
      }
    } catch (error) {
      console.log(`Skipping referrals migration: ${error.message}`);
    }

    // 4. Migrate investments
    console.log("Migrating investments...");
    try {
      const investments = await sourceDb.select().from(schema.investments);
      if (investments.length > 0) {
        await targetDb.insert(schema.investments).values(investments);
        console.log(`Migrated ${investments.length} investments`);
      } else {
        console.log("No investments to migrate");
      }
    } catch (error) {
      console.log(`Skipping investments migration: ${error.message}`);
    }

    // 5. Migrate transactions
    console.log("Migrating transactions...");
    try {
      const transactions = await sourceDb.select().from(schema.transactions);
      if (transactions.length > 0) {
        await targetDb.insert(schema.transactions).values(transactions);
        console.log(`Migrated ${transactions.length} transactions`);
      } else {
        console.log("No transactions to migrate");
      }
    } catch (error) {
      console.log(`Skipping transactions migration: ${error.message}`);
    }

    // 6. Migrate notifications
    console.log("Migrating notifications...");
    try {
      const notifications = await sourceDb.select().from(schema.notifications);
      if (notifications.length > 0) {
        await targetDb.insert(schema.notifications).values(notifications);
        console.log(`Migrated ${notifications.length} notifications`);
      } else {
        console.log("No notifications to migrate");
      }
    } catch (error) {
      console.log(`Skipping notifications migration: ${error.message}`);
    }

    // 7. Migrate transaction history
    console.log("Migrating transaction history...");
    try {
      const transactionHistory = await sourceDb.select().from(schema.transactionHistory);
      if (transactionHistory.length > 0) {
        await targetDb.insert(schema.transactionHistory).values(transactionHistory);
        console.log(`Migrated ${transactionHistory.length} transaction history records`);
      } else {
        console.log("No transaction history to migrate");
      }
    } catch (error) {
      console.log(`Skipping transaction history migration: ${error.message}`);
    }

    // 8. Migrate ranks
    console.log("Migrating ranks...");
    try {
      const ranks = await sourceDb.select().from(schema.ranks);
      if (ranks.length > 0) {
        await targetDb.insert(schema.ranks).values(ranks);
        console.log(`Migrated ${ranks.length} ranks`);
      } else {
        console.log("No ranks to migrate");
      }
    } catch (error) {
      console.log(`Skipping ranks migration: ${error.message}`);
    }

    // 9. Migrate user rank achievements
    console.log("Migrating user rank achievements...");
    try {
      const userRankAchievements = await sourceDb.select().from(schema.userRankAchievements);
      if (userRankAchievements.length > 0) {
        await targetDb.insert(schema.userRankAchievements).values(userRankAchievements);
        console.log(`Migrated ${userRankAchievements.length} user rank achievements`);
      } else {
        console.log("No user rank achievements to migrate");
      }
    } catch (error) {
      console.log(`Skipping user rank achievements migration: ${error.message}`);
    }

    // 10. Migrate BSC transactions
    console.log("Migrating BSC transactions...");
    try {
      const bscTransactions = await sourceDb.select().from(schema.bscTransactions);
      if (bscTransactions.length > 0) {
        await targetDb.insert(schema.bscTransactions).values(bscTransactions);
        console.log(`Migrated ${bscTransactions.length} BSC transactions`);
      } else {
        console.log("No BSC transactions to migrate");
      }
    } catch (error) {
      console.log(`Skipping BSC transactions migration: ${error.message}`);
    }

    // 11. Migrate BSC monitoring
    console.log("Migrating BSC monitoring...");
    try {
      const bscMonitoring = await sourceDb.select().from(schema.bscMonitoring);
      if (bscMonitoring.length > 0) {
        await targetDb.insert(schema.bscMonitoring).values(bscMonitoring);
        console.log(`Migrated ${bscMonitoring.length} BSC monitoring records`);
      } else {
        console.log("No BSC monitoring records to migrate");
      }
    } catch (error) {
      console.log(`Skipping BSC monitoring migration: ${error.message}`);
    }

    console.log("✅ Database migration completed successfully!");
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    // Close connections
    await sourceClient.end();
    await targetClient.end();
  }
}

// Run migration with error handling
migrateData()
  .then(() => {
    console.log("Migration process finished");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration process failed:", error);
    process.exit(1);
  });
