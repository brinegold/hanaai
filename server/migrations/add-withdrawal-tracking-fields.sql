-- Add new fields for tracking withdrawal limits and bonuses
ALTER TABLE users ADD COLUMN direct_deposit_amount NUMERIC(10, 2) DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN total_withdrawn_from_deposits NUMERIC(10, 2) DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN referral_bonuses NUMERIC(10, 2) DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN ranking_bonuses NUMERIC(10, 2) DEFAULT 0 NOT NULL;

-- Initialize direct_deposit_amount with current recharge_amount for existing users
UPDATE users SET direct_deposit_amount = recharge_amount WHERE recharge_amount > 0;
