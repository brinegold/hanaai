CREATE TABLE "bsc_monitoring" (
	"id" serial PRIMARY KEY NOT NULL,
	"last_processed_block" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bsc_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"transaction_hash" text NOT NULL,
	"block_number" integer,
	"from_address" text NOT NULL,
	"to_address" text NOT NULL,
	"amount" numeric(18, 8) NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	CONSTRAINT "bsc_transactions_transaction_hash_unique" UNIQUE("transaction_hash")
);
--> statement-breakpoint
CREATE TABLE "investments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" serial NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"plan" text NOT NULL,
	"daily_rate" numeric(5, 2) NOT NULL,
	"status" text NOT NULL,
	"start_date" timestamp DEFAULT now() NOT NULL,
	"end_date" timestamp
);
--> statement-breakpoint
CREATE TABLE "invite_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"created_by_id" serial NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invite_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ranks" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"required_volume" numeric(12, 2) NOT NULL,
	"incentive_amount" numeric(10, 2) NOT NULL,
	"incentive_description" text NOT NULL,
	"order" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ranks_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" serial PRIMARY KEY NOT NULL,
	"referrer_id" serial NOT NULL,
	"referred_id" serial NOT NULL,
	"level" text NOT NULL,
	"commission" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_id" integer,
	"status" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"details" text
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" serial NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"status" text NOT NULL,
	"reason" text,
	"network" text,
	"address" text,
	"fee" numeric(10, 2),
	"processing_time" timestamp,
	"completion_time" timestamp,
	"tx_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_rank_achievements" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"rank_name" text NOT NULL,
	"achieved_at" timestamp DEFAULT now() NOT NULL,
	"incentive_paid" boolean DEFAULT false NOT NULL,
	"incentive_amount" numeric(10, 2) NOT NULL,
	"volume_at_achievement" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text,
	"phone" text,
	"telegram" text,
	"password" text NOT NULL,
	"security_password" text NOT NULL,
	"invite_code" text,
	"referral_code" text NOT NULL,
	"current_rank" text DEFAULT 'none' NOT NULL,
	"total_volume_generated" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_assets" numeric(10, 2) DEFAULT '0' NOT NULL,
	"quantitative_assets" numeric(10, 2) DEFAULT '0' NOT NULL,
	"profit_assets" numeric(10, 2) DEFAULT '0' NOT NULL,
	"recharge_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"today_earnings" numeric(10, 2) DEFAULT '0' NOT NULL,
	"yesterday_earnings" numeric(10, 2) DEFAULT '0' NOT NULL,
	"commission_today" numeric(10, 2) DEFAULT '0' NOT NULL,
	"commission_assets" numeric(10, 2) DEFAULT '0' NOT NULL,
	"weekly_commission_earned" numeric(10, 2) DEFAULT '0' NOT NULL,
	"weekly_salary_paid" numeric(10, 2) DEFAULT '0' NOT NULL,
	"last_salary_date" timestamp,
	"withdrawable_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"last_investment_date" timestamp,
	"referrer_id" integer,
	"reset_token" text,
	"reset_token_expiry" timestamp,
	"verification_status" text DEFAULT 'unverified',
	"verification_submitted_at" timestamp,
	"is_admin" boolean DEFAULT false NOT NULL,
	"is_banned" boolean DEFAULT false NOT NULL,
	"is_country_rep" boolean DEFAULT false NOT NULL,
	"country_rep_status" text DEFAULT 'none',
	"bsc_wallet_address" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
ALTER TABLE "bsc_transactions" ADD CONSTRAINT "bsc_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_history" ADD CONSTRAINT "transaction_history_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_rank_achievements" ADD CONSTRAINT "user_rank_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;