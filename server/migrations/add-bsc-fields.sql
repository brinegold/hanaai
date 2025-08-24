-- Add BSC blockchain fields to users table
ALTER TABLE users ADD COLUMN bsc_wallet_address VARCHAR(42);
ALTER TABLE users ADD COLUMN bsc_private_key VARCHAR(66);

-- Add blockchain fields to transactions table
ALTER TABLE transactions ADD COLUMN tx_hash VARCHAR(66);
ALTER TABLE transactions ADD COLUMN block_number BIGINT;
ALTER TABLE transactions ADD COLUMN from_address VARCHAR(42);
ALTER TABLE transactions ADD COLUMN to_address VARCHAR(42);
ALTER TABLE transactions ADD COLUMN gas_fee DECIMAL(20, 8);
ALTER TABLE transactions ADD COLUMN confirmation_status VARCHAR(20) DEFAULT 'pending';

-- Create table for monitoring blockchain transactions
CREATE TABLE blockchain_monitors (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    wallet_address VARCHAR(42) NOT NULL,
    last_checked_block BIGINT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create table for pending deposits
CREATE TABLE pending_deposits (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    tx_hash VARCHAR(66) UNIQUE NOT NULL,
    amount DECIMAL(20, 8) NOT NULL,
    from_address VARCHAR(42),
    to_address VARCHAR(42),
    status VARCHAR(20) DEFAULT 'pending',
    verified_at TIMESTAMP,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_users_bsc_wallet ON users(bsc_wallet_address);
CREATE INDEX idx_transactions_tx_hash ON transactions(tx_hash);
CREATE INDEX idx_pending_deposits_status ON pending_deposits(status);
CREATE INDEX idx_blockchain_monitors_wallet ON blockchain_monitors(wallet_address);
