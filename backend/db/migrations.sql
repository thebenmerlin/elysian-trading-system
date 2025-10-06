-- Elysian Trading System - Complete Database Schema
-- Version: 1.0.0
-- Compatible with PostgreSQL 12+

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Drop existing tables (for clean setup)
DROP TABLE IF EXISTS runner_cycles CASCADE;
DROP TABLE IF EXISTS performance_reports CASCADE; 
DROP TABLE IF EXISTS reflections CASCADE;
DROP TABLE IF EXISTS ai_analysis CASCADE;
DROP TABLE IF EXISTS portfolio_snapshots CASCADE;
DROP TABLE IF EXISTS positions CASCADE;
DROP TABLE IF EXISTS trades CASCADE;
DROP TABLE IF EXISTS signals CASCADE;
DROP TABLE IF EXISTS features CASCADE;
DROP TABLE IF EXISTS market_data CASCADE;
DROP TABLE IF EXISTS system_config CASCADE;

-- System configuration table
CREATE TABLE system_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Market data table
CREATE TABLE market_data (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    open DECIMAL(12,4) NOT NULL CHECK (open > 0),
    high DECIMAL(12,4) NOT NULL CHECK (high > 0),
    low DECIMAL(12,4) NOT NULL CHECK (low > 0),
    close DECIMAL(12,4) NOT NULL CHECK (close > 0),
    volume BIGINT NOT NULL DEFAULT 0 CHECK (volume >= 0),
    provider VARCHAR(50) NOT NULL DEFAULT 'unknown',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT valid_ohlc CHECK (high >= open AND high >= close AND low <= open AND low <= close),
    UNIQUE(symbol, timestamp, provider)
);

CREATE INDEX idx_market_data_symbol_timestamp ON market_data (symbol, timestamp DESC);
CREATE INDEX idx_market_data_timestamp ON market_data (timestamp DESC);
CREATE INDEX idx_market_data_symbol ON market_data (symbol);

-- Features table
CREATE TABLE features (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    features JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(symbol, timestamp)
);

CREATE INDEX idx_features_symbol_timestamp ON features (symbol, timestamp DESC);
CREATE INDEX idx_features_features ON features USING gin (features);

-- Signals table
CREATE TABLE signals (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    signal_type VARCHAR(10) NOT NULL CHECK (signal_type IN ('BUY', 'SELL', 'HOLD')),
    strength DECIMAL(5,4) NOT NULL CHECK (strength >= 0 AND strength <= 1),
    confidence DECIMAL(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    source VARCHAR(100) NOT NULL,
    reasoning JSONB DEFAULT '[]',
    features_used JSONB DEFAULT '[]',
    target_price DECIMAL(12,4),
    stop_loss DECIMAL(12,4),
    take_profit DECIMAL(12,4),
    risk_score DECIMAL(5,4) NOT NULL DEFAULT 0.5 CHECK (risk_score >= 0 AND risk_score <= 1),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(symbol, timestamp, source)
);

CREATE INDEX idx_signals_symbol_timestamp ON signals (symbol, timestamp DESC);
CREATE INDEX idx_signals_signal_type ON signals (signal_type);
CREATE INDEX idx_signals_source ON signals (source);

-- AI Analysis table
CREATE TABLE ai_analysis (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    sentiment VARCHAR(10) NOT NULL CHECK (sentiment IN ('BULLISH', 'BEARISH', 'NEUTRAL')),
    confidence DECIMAL(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    reasoning JSONB DEFAULT '[]',
    key_factors JSONB DEFAULT '[]',
    risk_assessment JSONB DEFAULT '{}',
    recommendation JSONB DEFAULT '{}',
    market_context JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(symbol, timestamp)
);

CREATE INDEX idx_ai_analysis_symbol_timestamp ON ai_analysis (symbol, timestamp DESC);
CREATE INDEX idx_ai_analysis_sentiment ON ai_analysis (sentiment);

-- Trades table
CREATE TABLE trades (
    id VARCHAR(100) PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(4) NOT NULL CHECK (side IN ('BUY', 'SELL')),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price DECIMAL(12,4) NOT NULL CHECK (price > 0),
    executed_price DECIMAL(12,4) NOT NULL CHECK (executed_price > 0),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'FILLED', 'PARTIAL', 'REJECTED', 'CANCELLED')),
    commission DECIMAL(12,4) NOT NULL DEFAULT 0 CHECK (commission >= 0),
    signal_id INTEGER REFERENCES signals(id),
    ai_analysis_id INTEGER REFERENCES ai_analysis(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_trades_symbol ON trades (symbol);
CREATE INDEX idx_trades_timestamp ON trades (timestamp DESC);
CREATE INDEX idx_trades_status ON trades (status);
CREATE INDEX idx_trades_side ON trades (side);

-- Positions table
CREATE TABLE positions (
    symbol VARCHAR(20) PRIMARY KEY,
    quantity INTEGER NOT NULL,
    avg_price DECIMAL(12,4) NOT NULL CHECK (avg_price > 0),
    current_price DECIMAL(12,4) NOT NULL CHECK (current_price > 0),
    market_value DECIMAL(15,4) NOT NULL CHECK (market_value >= 0),
    unrealized_pnl DECIMAL(15,4) NOT NULL DEFAULT 0,
    unrealized_pnl_pct DECIMAL(8,4) NOT NULL DEFAULT 0,
    first_purchase TIMESTAMP WITH TIME ZONE NOT NULL,
    last_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_positions_market_value ON positions (market_value DESC);
CREATE INDEX idx_positions_unrealized_pnl ON positions (unrealized_pnl DESC);

-- Portfolio snapshots table
CREATE TABLE portfolio_snapshots (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL UNIQUE,
    total_value DECIMAL(15,4) NOT NULL CHECK (total_value >= 0),
    cash DECIMAL(15,4) NOT NULL CHECK (cash >= 0),
    positions_value DECIMAL(15,4) NOT NULL DEFAULT 0 CHECK (positions_value >= 0),
    unrealized_pnl DECIMAL(15,4) NOT NULL DEFAULT 0,
    realized_pnl DECIMAL(15,4) NOT NULL DEFAULT 0,
    total_pnl DECIMAL(15,4) NOT NULL DEFAULT 0,
    daily_pnl DECIMAL(15,4) NOT NULL DEFAULT 0,
    positions JSONB DEFAULT '[]',
    metrics JSONB DEFAULT '{}',
    allocation JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_portfolio_snapshots_timestamp ON portfolio_snapshots (timestamp DESC);
CREATE INDEX idx_portfolio_snapshots_total_value ON portfolio_snapshots (total_value);

-- Reflections table
CREATE TABLE reflections (
    id VARCHAR(100) PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    period_analyzed JSONB NOT NULL,
    performance_summary JSONB NOT NULL,
    key_insights JSONB DEFAULT '[]',
    mistakes_identified JSONB DEFAULT '[]',
    successful_patterns JSONB DEFAULT '[]',
    recommended_adjustments JSONB DEFAULT '[]',
    market_regime_analysis JSONB DEFAULT '{}',
    future_focus_areas JSONB DEFAULT '[]',
    confidence_score DECIMAL(5,4) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_reflections_timestamp ON reflections (timestamp DESC);
CREATE INDEX idx_reflections_confidence ON reflections (confidence_score DESC);

-- Performance reports table
CREATE TABLE performance_reports (
    id VARCHAR(100) PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    period JSONB NOT NULL,
    executive_summary JSONB NOT NULL,
    detailed_metrics JSONB DEFAULT '{}',
    charts_data JSONB DEFAULT '{}',
    recommendations JSONB DEFAULT '[]',
    risk_warnings JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_performance_reports_timestamp ON performance_reports (timestamp DESC);

-- Runner cycles table
CREATE TABLE runner_cycles (
    id VARCHAR(100) PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    phase VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED')),
    tickers_processed JSONB DEFAULT '[]',
    signals_generated INTEGER NOT NULL DEFAULT 0,
    trades_executed INTEGER NOT NULL DEFAULT 0,
    errors JSONB DEFAULT '[]',
    metrics JSONB DEFAULT '{}',
    results JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_runner_cycles_timestamp ON runner_cycles (timestamp DESC);
CREATE INDEX idx_runner_cycles_status ON runner_cycles (status);

-- Insert default system configuration
INSERT INTO system_config (config_key, config_value, description) VALUES
    ('schema_version', '"1.0.0"', 'Database schema version'),
    ('system_initialized', 'true', 'System initialization flag'),
    ('trading_enabled', 'false', 'Master trading switch'),
    ('initial_cash', '100000', 'Initial cash amount for paper trading'),
    ('supported_tickers', '["AAPL", "MSFT", "GOOGL", "NVDA", "TSLA"]', 'Default supported tickers'),
    ('runner_config', '{"run_interval_minutes": 15, "enable_trading": false, "enable_ai_analysis": true}', 'Default runner configuration')
ON CONFLICT (config_key) DO NOTHING;

-- Create functions for automated tasks

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON system_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_market_data_updated_at BEFORE UPDATE ON market_data FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_features_updated_at BEFORE UPDATE ON features FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_signals_updated_at BEFORE UPDATE ON signals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_analysis_updated_at BEFORE UPDATE ON ai_analysis FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_trades_updated_at BEFORE UPDATE ON trades FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_positions_updated_at BEFORE UPDATE ON positions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_portfolio_snapshots_updated_at BEFORE UPDATE ON portfolio_snapshots FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reflections_updated_at BEFORE UPDATE ON reflections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_performance_reports_updated_at BEFORE UPDATE ON performance_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_runner_cycles_updated_at BEFORE UPDATE ON runner_cycles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create views for common queries

-- Latest market data view
CREATE VIEW v_latest_market_data AS
SELECT DISTINCT ON (symbol) 
    symbol, timestamp, open, high, low, close, volume, provider
FROM market_data 
ORDER BY symbol, timestamp DESC;

-- Active positions view
CREATE VIEW v_active_positions AS
SELECT * FROM positions WHERE quantity != 0;

-- Recent signals view  
CREATE VIEW v_recent_signals AS
SELECT * FROM signals 
WHERE timestamp >= NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;

-- Portfolio performance view
CREATE VIEW v_portfolio_performance AS
SELECT 
    DATE(timestamp) as date,
    total_value,
    daily_pnl,
    total_pnl,
    (metrics->>'total_return_pct')::DECIMAL as total_return_pct,
    (metrics->>'sharpe_ratio')::DECIMAL as sharpe_ratio,
    (metrics->>'max_drawdown_pct')::DECIMAL as max_drawdown_pct
FROM portfolio_snapshots 
ORDER BY timestamp DESC;

-- Grant permissions (adjust as needed for your deployment)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO elysian_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO elysian_user;

-- Vacuum and analyze for performance
VACUUM ANALYZE;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Elysian Trading System database schema created successfully!';
    RAISE NOTICE 'Schema version: 1.0.0';
    RAISE NOTICE 'Tables created: %', (
        SELECT count(*) FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN (
            'system_config', 'market_data', 'features', 'signals', 'ai_analysis',
            'trades', 'positions', 'portfolio_snapshots', 'reflections', 
            'performance_reports', 'runner_cycles'
        )
    );
END $$;
