import { db } from "./db";
import { users, transactions } from "../shared/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";

export class SalaryScheduler {
  private static instance: SalaryScheduler;
  private intervalId: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): SalaryScheduler {
    if (!SalaryScheduler.instance) {
      SalaryScheduler.instance = new SalaryScheduler();
    }
    return SalaryScheduler.instance;
  }

  public start() {
    // Check every hour if it's Saturday and time to pay salaries
    this.intervalId = setInterval(() => {
      this.checkAndPaySalaries();
    }, 60 * 60 * 1000); // Check every hour

    console.log("Salary scheduler started");
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("Salary scheduler stopped");
    }
  }

  private async checkAndPaySalaries() {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday

    // Only run on Saturday
    if (dayOfWeek !== 6) {
      return;
    }

    // Only run once per day (check if we already ran today)
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    try {
      await this.processWeeklySalaries(startOfDay);
    } catch (error) {
      console.error("Error processing weekly salaries:", error);
    }
  }

  private async processWeeklySalaries(currentSaturday: Date) {
    console.log("Processing weekly salaries for", currentSaturday.toDateString());

    // Get all users who haven't received salary this week
    const usersToProcess = await db
      .select()
      .from(users)
      .where(
        and(
          sql`${users.lastSalaryDate} IS NULL OR ${users.lastSalaryDate} < ${currentSaturday}`
        )
      );

    for (const user of usersToProcess) {
      await this.calculateAndPayWeeklySalary(user, currentSaturday);
    }
  }

  private async calculateAndPayWeeklySalary(user: any, currentSaturday: Date) {
    // Calculate Monday to Friday of this week
    const monday = new Date(currentSaturday);
    monday.setDate(monday.getDate() - 5); // Saturday - 5 days = Monday
    monday.setHours(0, 0, 0, 0);

    const friday = new Date(currentSaturday);
    friday.setDate(friday.getDate() - 1); // Saturday - 1 day = Friday
    friday.setHours(23, 59, 59, 999);

    // Get all commission transactions from Monday to Friday
    const weeklyCommissions = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, user.id),
          eq(transactions.type, "Commission"),
          eq(transactions.status, "Completed"),
          gte(transactions.createdAt, monday),
          lte(transactions.createdAt, friday)
        )
      );

    // Calculate total commission earned this week
    const totalWeeklyCommission = weeklyCommissions.reduce(
      (sum, tx) => sum + parseFloat(tx.amount.toString()),
      0
    );

    if (totalWeeklyCommission > 0) {
      // Calculate 10% salary
      const salaryAmount = totalWeeklyCommission * 0.1;

      // Create salary transaction
      await db.insert(transactions).values({
        userId: user.id,
        type: "Salary",
        amount: salaryAmount.toString(),
        status: "Completed",
        reason: `Weekly salary: 10% of ${totalWeeklyCommission.toFixed(2)} USDT commission (${monday.toDateString()} - ${friday.toDateString()})`,
        createdAt: currentSaturday,
        completionTime: currentSaturday,
      });

      // Update user's total assets and weekly tracking
      await db
        .update(users)
        .set({
          totalAssets: sql`${users.totalAssets} + ${salaryAmount}`,
          weeklyCommissionEarned: totalWeeklyCommission.toString(),
          weeklySalaryPaid: salaryAmount.toString(),
          lastSalaryDate: currentSaturday,
          updatedAt: currentSaturday,
        })
        .where(eq(users.id, user.id));

      console.log(
        `Paid ${salaryAmount.toFixed(2)} USDT salary to user ${user.id} (${user.username})`
      );
    } else {
      // Update last salary date even if no commission earned
      await db
        .update(users)
        .set({
          weeklyCommissionEarned: "0",
          weeklySalaryPaid: "0",
          lastSalaryDate: currentSaturday,
          updatedAt: currentSaturday,
        })
        .where(eq(users.id, user.id));
    }
  }

  // Manual trigger for testing
  public async triggerWeeklySalaryPayout() {
    const now = new Date();
    await this.processWeeklySalaries(now);
  }
}
