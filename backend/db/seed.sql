-- Elysian Trading System - Seed Data
-- Sample data for development and testing

-- Insert sample market data for backtesting
INSERT INTO market_data (symbol, timestamp, open, high, low, close, volume, provider) VALUES
    ('AAPL', NOW() - INTERVAL '1 day', 150.00, 152.50, 149.00, 151.25, 50000000, 'yahoo'),
    ('AAPL', NOW() - INTERVAL '2 days', 148.50, 151.00, 147.75, 150.00, 45000000, 'yahoo'),
    ('MSFT', NOW() - INTERVAL '1 day', 330.00, 335.00, 328.50, 333.75, 30000000, 'yahoo'),
    ('MSFT', NOW() - INTERVAL '2 days', 325.00, 331.50, 324.00, 330.00, 28000000, 'yahoo'),
    ('GOOGL', NOW() - INTERVAL '1 day', 2750.00, 2780.00, 2745.00, 2765.50, 1200000, 'yahoo'),
    ('GOOGL', NOW() - INTERVAL '2 days', 2720.00, 2755.00, 2715.00, 2750.00, 1100000, 'yahoo')
ON CONFLICT (symbol, timestamp, provider) DO NOTHING;

-- Insert initial portfolio snapshot
INSERT INTO portfolio_snapshots (
    timestamp, total_value, cash, positions_value, unrealized_pnl, 
    realized_pnl, total_pnl, daily_pnl, positions, metrics, allocation
) VALUES (
    NOW(),
    100000.00,
    100000.00,
    0.00,
    0.00,
    0.00,
    0.00,
    0.00,
    '[]',
    '{"total_return_pct": 0, "sharpe_ratio": 0, "max_drawdown_pct": 0, "win_rate_pct": 0}',
    '{}'
) ON CONFLICT (timestamp) DO NOTHING;

-- Sample system configuration
INSERT INTO system_config (config_key, config_value, description) VALUES
    ('last_seeded', to_jsonb(NOW()), 'Last time seed data was inserted'),
    ('sample_data', 'true', 'Indicates sample data has been loaded')
ON CONFLICT (config_key) DO UPDATE SET 
    config_value = EXCLUDED.config_value,
    updated_at = NOW();

SELECT 'Sample data inserted successfully!' as status;
