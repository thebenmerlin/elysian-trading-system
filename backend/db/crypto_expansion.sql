-- Elysian Trading System - Crypto Expansion Schema
-- Run this on your Neon database to add crypto support

-- Add market_type column to existing tables
ALTER TABLE market_data ADD COLUMN IF NOT EXISTS market_type VARCHAR(10) DEFAULT 'equity';
ALTER TABLE features ADD COLUMN IF NOT EXISTS market_type VARCHAR(10) DEFAULT 'equity';
ALTER TABLE signals ADD COLUMN IF NOT EXISTS market_type VARCHAR(10) DEFAULT 'equity';
ALTER TABLE trades ADD COLUMN IF NOT EXISTS market_type VARCHAR(10) DEFAULT 'equity';
ALTER TABLE positions ADD COLUMN IF NOT EXISTS market_type VARCHAR(10) DEFAULT 'equity';
ALTER TABLE portfolio_snapshots ADD COLUMN IF NOT EXISTS crypto_value DECIMAL(15,4) DEFAULT 0;
ALTER TABLE portfolio_snapshots ADD COLUMN IF NOT EXISTS equity_value DECIMAL(15,4) DEFAULT 0;

-- Create crypto-specific indexes
CREATE INDEX IF NOT EXISTS idx_market_data_market_type ON market_data (market_type, symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_signals_market_type ON signals (market_type, symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trades_market_type ON trades (market_type, symbol, timestamp DESC);

-- Create crypto pairs table for metadata
CREATE TABLE IF NOT EXISTS crypto_pairs (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL UNIQUE,
    base_asset VARCHAR(10) NOT NULL,
    quote_asset VARCHAR(10) NOT NULL,
    min_trade_amount DECIMAL(12,8) DEFAULT 0.001,
    price_precision INTEGER DEFAULT 2,
    quantity_precision INTEGER DEFAULT 6,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default crypto pairs
INSERT INTO crypto_pairs (symbol, base_asset, quote_asset, min_trade_amount, price_precision, quantity_precision) 
VALUES 
    ('BTCUSDT', 'BTC', 'USDT', 0.00001, 2, 5),
    ('ETHUSDT', 'ETH', 'USDT', 0.001, 2, 4),
    ('ADAUSDT', 'ADA', 'USDT', 10, 4, 0),
    ('DOTUSDT', 'DOT', 'USDT', 1, 3, 1),
    ('LINKUSDT', 'LINK', 'USDT', 0.1, 3, 2)
ON CONFLICT (symbol) DO NOTHING;

-- Create market hours configuration table
CREATE TABLE IF NOT EXISTS market_config (
    id SERIAL PRIMARY KEY,
    market_type VARCHAR(10) NOT NULL,
    is_24h BOOLEAN DEFAULT false,
    trading_start_utc TIME,
    trading_end_utc TIME,
    timezone VARCHAR(50) DEFAULT 'UTC',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert market configurations
INSERT INTO market_config (market_type, is_24h, trading_start_utc, trading_end_utc, timezone) 
VALUES 
    ('crypto', true, NULL, NULL, 'UTC'),
    ('equity', false, '14:30:00', '21:00:00', 'America/New_York')
ON CONFLICT DO NOTHING;

-- Create view for active crypto pairs
CREATE OR REPLACE VIEW v_active_crypto_pairs AS
SELECT symbol, base_asset, quote_asset, min_trade_amount, price_precision, quantity_precision
FROM crypto_pairs 
WHERE is_active = true;

-- Create view for latest market data by type
CREATE OR REPLACE VIEW v_latest_market_data AS
SELECT DISTINCT ON (market_type, symbol) 
    market_type, symbol, timestamp, open, high, low, close, volume, provider
FROM market_data 
ORDER BY market_type, symbol, timestamp DESC;

-- Update system config for crypto support
INSERT INTO system_config (config_key, config_value, description) VALUES
    ('crypto_enabled', 'true', 'Enable cryptocurrency trading'),
    ('crypto_tickers', '["BTCUSDT", "ETHUSDT", "ADAUSDT", "DOTUSDT", "LINKUSDT"]', 'Default crypto trading pairs'),
    ('crypto_run_interval_minutes', '5', 'Crypto trading cycle interval (24/7)'),
    ('equity_run_interval_minutes', '15', 'Equity trading cycle interval (market hours)')
ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value;

-- Grant permissions (if using specific user)
-- GRANT ALL PRIVILEGES ON crypto_pairs TO your_user;
-- GRANT ALL PRIVILEGES ON market_config TO your_user;

COMMIT;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '🚀 Crypto expansion schema applied successfully!';
    RAISE NOTICE 'Tables updated: market_data, features, signals, trades, positions, portfolio_snapshots';
    RAISE NOTICE 'New tables: crypto_pairs, market_config';
    RAISE NOTICE 'New views: v_active_crypto_pairs, v_latest_market_data';
END $$;
