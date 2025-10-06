#!/bin/bash

# Elysian Trading System - Local Setup Script
# Sets up the development environment

set -e  # Exit on any error

echo "🚀 Setting up Elysian Trading System..."

# Check Node.js version
echo "📋 Checking prerequisites..."
node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$node_version" -lt 18 ]; then
    echo "❌ Node.js 18+ required. Current version: $(node -v)"
    exit 1
fi

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating environment file..."
    cp .env.example .env
    echo "✅ Please edit .env with your configuration"
fi

# Backend setup
echo "🔧 Setting up backend..."
cd backend
npm install
echo "✅ Backend dependencies installed"
cd ..

# Frontend setup
echo "🎨 Setting up frontend..."
cd frontend
npm install
echo "✅ Frontend dependencies installed"
cd ..

# Check Docker
if command -v docker &> /dev/null; then
    echo "🐳 Docker found - you can use 'docker-compose up -d' to start"
else
    echo "⚠️  Docker not found - install Docker for easier development"
fi

# Database setup reminder
echo ""
echo "📊 Database Setup Required:"
echo "1. Create a PostgreSQL database (or use Docker Compose)"
echo "2. Update DATABASE_URL in .env file"
echo "3. Run migrations: cd backend && npm run migrate"
echo ""
echo "🎉 Setup complete! Next steps:"
echo "- Edit .env configuration"
echo "- Start database (Docker Compose or external)"
echo "- Run: npm run dev (in backend directory)"
echo "- Run: npm run dev (in frontend directory)"
echo ""
echo "📖 See README.md for detailed instructions"
