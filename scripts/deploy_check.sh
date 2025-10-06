#!/bin/bash

# Elysian Trading System - Health Check Script
# Verifies deployment and system status

set -e

echo "🔍 Elysian Trading System Health Check"
echo "======================================="

# Configuration
BACKEND_URL="${1:-http://localhost:4000}"
API_KEY="${2:-elysian-demo-key}"

echo "Backend URL: $BACKEND_URL"
echo ""

# Health check
echo "1. Checking backend health..."
health_response=$(curl -s "$BACKEND_URL/health" || echo "FAILED")

if echo "$health_response" | grep -q '"status":"healthy"'; then
    echo "✅ Backend is healthy"
else
    echo "❌ Backend health check failed"
    echo "Response: $health_response"
    exit 1
fi

# API check
echo ""
echo "2. Checking API authentication..."
api_response=$(curl -s -H "x-elysian-key: $API_KEY" "$BACKEND_URL/api/portfolio" || echo "FAILED")

if echo "$api_response" | grep -q '"data"'; then
    echo "✅ API is accessible"
else
    echo "❌ API check failed"
    echo "Response: $api_response"
fi

# Runner status
echo ""
echo "3. Checking trading runner..."
runner_response=$(curl -s -H "x-elysian-key: $API_KEY" "$BACKEND_URL/internal/runner/status" || echo "FAILED")

if echo "$runner_response" | grep -q '"is_running"'; then
    if echo "$runner_response" | grep -q '"is_running":true'; then
        echo "✅ Trading runner is active"
    else
        echo "⚠️  Trading runner is stopped (use start button in dashboard)"
    fi
else
    echo "❌ Runner status check failed"
    echo "Response: $runner_response"
fi

# Database check
echo ""
echo "4. Checking database connection..."
if echo "$health_response" | grep -q '"database":"connected"'; then
    echo "✅ Database is connected"
else
    echo "❌ Database connection issue"
fi

echo ""
echo "🎉 Health check complete!"
echo ""
echo "Next steps:"
echo "- Visit dashboard: ${BACKEND_URL/4000/3000} (if running locally)"
echo "- Start trading runner if needed"
echo "- Monitor logs for any issues"
