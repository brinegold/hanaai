import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL not found in environment variables");
}

const client = postgres(connectionString);
const db = drizzle(client);

async function checkTables() {
  console.log("Checking existing tables in the database...\n");
  
  try {
    const result = await client`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    
    if (result.length === 0) {
      console.log("❌ No tables found in the database.");
      console.log("Your database is empty and ready for table creation.");
    } else {
      console.log(`✅ Found ${result.length} tables:`);
      result.forEach((row, index) => {
        console.log(`${index + 1}. ${row.table_name}`);
      });
    }
    
    console.log("\nExpected tables from schema:");
    const expectedTables = [
      "users",
      "invite_codes", 
      "referrals",
      "investments",
      "transactions",
      "notifications",
      "transaction_history",
      "ranks",
      "user_rank_achievements",
      "bsc_transactions",
      "bsc_monitoring"
    ];
    
    expectedTables.forEach((table, index) => {
      const exists = result.some(row => row.table_name === table);
      console.log(`${index + 1}. ${table} ${exists ? '✅' : '❌'}`);
    });
    
  } catch (error) {
    console.error("Error checking tables:", error);
  } finally {
    await client.end();
  }
}

checkTables();
