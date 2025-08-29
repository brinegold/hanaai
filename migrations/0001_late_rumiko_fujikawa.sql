ALTER TABLE "users" ADD COLUMN "trading_capital" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "trading_capital_withdrawn" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "daily_trading_gains" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bonus_withdrawable" numeric(10, 2) DEFAULT '0' NOT NULL;