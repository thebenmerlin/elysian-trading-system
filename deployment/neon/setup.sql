-- Elysian Trading System - Neon Database Setup
-- Run this after creating your Neon database

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Verify the schema was created
SELECT schemaname, tablename, tableowner 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Insert sample configuration
INSERT INTO system_config (config_key, config_value, description) VALUES
    ('deployment_env', '"neon"', 'Deployment environment'),
    ('initialized_at', to_jsonb(NOW()), 'System initialization timestamp')
ON CONFLICT (config_key) DO NOTHING;

-- Create read-only user for monitoring (optional)
CREATE USER elysian_readonly WITH PASSWORD 'readonly_password';
GRANT CONNECT ON DATABASE neondb TO elysian_readonly;
GRANT USAGE ON SCHEMA public TO elysian_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO elysian_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO elysian_readonly;

-- Verify setup
SELECT 'Elysian Trading System database setup completed successfully!' as status;
