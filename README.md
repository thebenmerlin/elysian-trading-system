# Elysian Trading System

**Autonomous AI-Powered Hedge Fund Simulator**

A complete full-stack trading system that combines quantitative analysis, machine learning, and AI-powered decision making to simulate autonomous hedge fund operations.

![Elysian Trading System](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)
![Version](https://img.shields.io/badge/Version-1.0.0-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## 🎯 Overview

Elysian is a sophisticated trading system that mimics the operations of a modern hedge fund, featuring:

- **Autonomous Trading Runner** - Executes complete trading cycles automatically
- **AI-Powered Analysis** - Uses Hugging Face models for market sentiment and reasoning
- **Multi-Signal Engine** - Combines quantitative, ML, and AI signals
- **Real-time Dashboard** - Bloomberg-style terminal interface
- **Portfolio Management** - Comprehensive position tracking and performance analytics
- **Self-Reflection System** - AI analyzes its own performance and adapts strategies

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │     Backend      │    │    Database     │
│   (Next.js)     │◄──►│   (Express.js)   │◄──►│  (PostgreSQL)   │
│                 │    │                  │    │                 │
│ • Dashboard     │    │ • Trading Runner │    │ • Market Data   │
│ • Portfolio     │    │ • Signal Engine  │    │ • Trades        │
│ • Trades        │    │ • AI Reasoner    │    │ • Positions     │
│ • Reflections   │    │ • Execution      │    │ • Reflections   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Core Components

#### Backend Modules
- **Data Ingestor**: Fetches market data from Yahoo Finance and Alpha Vantage
- **Features Engine**: Computes technical indicators (RSI, MACD, Bollinger Bands)
- **Signal Engine**: Generates buy/sell signals using multiple strategies
- **AI Reasoner**: Hugging Face integration for market analysis and sentiment
- **Execution Engine**: Simulates trade execution with realistic constraints
- **Portfolio Manager**: Tracks positions and calculates performance metrics
- **Reflection Engine**: AI-powered system analysis and optimization
- **Reports Generator**: Creates comprehensive performance reports

#### Frontend Components
- **Terminal Dashboard**: Real-time system monitoring with typewriter effects
- **Portfolio View**: Current positions and allocation charts
- **Trading History**: Complete trade log with statistics
- **AI Insights**: Latest reflections and recommendations

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database (we recommend [Neon](https://neon.tech))
- Optional: Hugging Face API key for AI features

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd elysian-trading-system
   ```

2. **Setup environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start with Docker Compose** (Recommended)
   ```bash
   docker-compose up -d
   ```

4. **Or run manually**
   ```bash
   # Backend
   cd backend
   npm install
   npm run dev

   # Frontend (in another terminal)
   cd frontend
   npm install
   npm run dev
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:4000
   - Health Check: http://localhost:4000/health

## 🌐 Deployment

### Free Tier Deployment Stack

#### 1. Database: Neon PostgreSQL (Free)
1. Create account at [neon.tech](https://neon.tech)
2. Create new database
3. Copy connection string
4. Run setup SQL:
   ```sql
   -- Copy content from deployment/neon/setup.sql
   ```

#### 2. Backend: Render (Free)
1. Create account at [render.com](https://render.com)
2. Create new "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Environment Variables**:
     ```
     NODE_ENV=production
     DATABASE_URL=<your-neon-connection-string>
     RUNNER_TICKERS=AAPL,MSFT,GOOGL,NVDA,TSLA
     ELYSIAN_LIVE=false
     INITIAL_CASH=100000
     ELYSIAN_API_KEY=<generate-secure-key>
     ```

#### 3. Frontend: Vercel (Free)
1. Create account at [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Configure:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Next.js
   - **Environment Variables**:
     ```
     NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
     NEXT_PUBLIC_API_KEY=<same-as-backend-key>
     ```

### Environment Variables

#### Backend (.env)
```bash
NODE_ENV=production
PORT=4000
DATABASE_URL=postgres://user:pass@host:5432/db
RUNNER_TICKERS=AAPL,MSFT,GOOGL,NVDA,TSLA
ELYSIAN_LIVE=false
INITIAL_CASH=100000
RUN_INTERVAL_MINUTES=15
AUTO_START_RUNNER=false
HF_API_KEY=your_huggingface_key
ELYSIAN_API_KEY=your_secure_api_key
```

#### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_API_KEY=your_secure_api_key
```

## 📊 Usage

### Starting the System

1. **Health Check**
   ```bash
   curl http://localhost:4000/health
   ```

2. **Start Trading Runner**
   ```bash
   curl -X POST http://localhost:4000/internal/runner/start \
     -H "x-elysian-key: your-api-key"
   ```

3. **Run Manual Cycle**
   ```bash
   curl -X POST http://localhost:4000/internal/runner/cycle \
     -H "x-elysian-key: your-api-key"
   ```

### API Endpoints

#### Portfolio
- `GET /api/portfolio` - Current portfolio snapshot
- `GET /api/portfolio/history?days=30` - Historical performance
- `GET /api/portfolio/positions` - Active positions

#### Trading
- `GET /api/trades?limit=50` - Recent trades
- `GET /api/trades/stats?days=30` - Trading statistics

#### Reports & Analysis
- `GET /api/reports/latest` - Latest performance report
- `POST /api/reports/generate` - Generate new report
- `GET /api/reflections/latest` - Latest AI reflection
- `POST /api/reflections/generate` - Generate new reflection

#### System Control
- `GET /internal/health` - System health check
- `POST /internal/runner/start` - Start trading runner
- `POST /internal/runner/stop` - Stop trading runner
- `GET /internal/runner/status` - Runner status

### Dashboard Features

#### Main Dashboard
- Real-time system activity terminal
- Key performance metrics
- System health monitoring
- Recent trades display
- AI insights summary

#### Portfolio Page
- Current positions table
- Asset allocation pie chart
- 30-day equity curve
- Performance metrics

#### Trades Page
- Complete trading history
- Trade statistics
- Performance analytics
- Execution details

#### Reflections Page
- AI-generated insights
- Performance analysis
- Mistake identification
- Strategy recommendations

## 🤖 AI Features

### Market Analysis
- Sentiment analysis using Hugging Face models
- Risk assessment and market regime detection
- Multi-factor fundamental analysis
- News and market context integration

### Self-Reflection System
- Automated performance analysis
- Mistake pattern identification
- Successful strategy recognition
- Parameter optimization recommendations

### Signal Generation
- Technical indicator ensemble
- ML model predictions
- AI sentiment scoring
- Risk-adjusted signal weighting

## 📈 Performance Metrics

The system tracks comprehensive performance metrics:

- **Return Metrics**: Total return, annualized return, daily P&L
- **Risk Metrics**: Sharpe ratio, maximum drawdown, volatility
- **Trading Metrics**: Win rate, profit factor, average trade size
- **Portfolio Metrics**: Asset allocation, position sizing, turnover

## 🔧 Configuration

### Trading Parameters
```javascript
{
  max_position_size_pct: 10,      // Max position size (% of portfolio)
  max_daily_trades: 20,           // Daily trade limit
  min_confidence_threshold: 0.6,   // Minimum signal confidence
  risk_limit_pct: 15,             // Portfolio risk limit
  commission_per_trade: 1.0       // Commission per trade
}
```

### Runner Configuration
```javascript
{
  tickers: ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'TSLA'],
  run_interval_minutes: 15,       // Cycle frequency
  enable_trading: false,          // Paper trading mode
  enable_ai_analysis: true,       // AI features
  reflection_frequency: 12,       // Reflection every N cycles
  report_frequency: 24           // Report every N cycles
}
```

## 🛠️ Development

### Project Structure
```
elysian-trading-system/
├── backend/
│   ├── src/
│   │   ├── api/           # REST API routes
│   │   ├── ai_reasoner/   # AI analysis engine
│   │   ├── data_ingestor/ # Market data fetchers
│   │   ├── execution/     # Trade execution
│   │   ├── features/      # Technical indicators
│   │   ├── portfolio/     # Portfolio management
│   │   ├── reflection/    # AI self-analysis
│   │   ├── reports/       # Performance reports
│   │   ├── runner/        # Main orchestrator
│   │   ├── signal_engine/ # Signal generation
│   │   └── utils/         # Utilities
│   ├── db/                # Database scripts
│   └── tests/             # Test suites
├── frontend/
│   ├── src/
│   │   ├── pages/         # Next.js pages
│   │   ├── components/    # React components
│   │   ├── utils/         # Frontend utilities
│   │   └── styles/        # CSS styles
│   └── public/            # Static assets
├── deployment/            # Deployment configs
│   ├── render/           # Render.com config
│   ├── vercel/           # Vercel config
│   └── neon/             # Database setup
└── scripts/              # Utility scripts
```

### Running Tests
```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

### Building for Production
```bash
# Backend
cd backend
npm run build

# Frontend
cd frontend
npm run build
```

## 📝 API Documentation

### Authentication
All API endpoints (except `/health`) require authentication via the `x-elysian-key` header:

```bash
curl -H "x-elysian-key: your-api-key" http://localhost:4000/api/portfolio
```

### Response Format
All API responses follow this format:
```json
{
  "data": { /* response data */ },
  "timestamp": "2025-01-07T12:00:00.000Z"
}
```

### Error Handling
Error responses include:
```json
{
  "error": "Error description",
  "message": "Detailed error message",
  "timestamp": "2025-01-07T12:00:00.000Z"
}
```

## 🚨 Important Notes

### Risk Warning
⚠️ **This is a SIMULATION system for educational purposes only.**
- Default mode is PAPER TRADING (no real money)
- Never use with real funds without thorough testing
- Past performance doesn't guarantee future results
- Always understand the risks of algorithmic trading

### Data Sources
- Market data: Yahoo Finance (free) and Alpha Vantage (API key required)
- AI models: Hugging Face (free tier available)
- All data is used for simulation purposes only

### Performance
- Optimized for free-tier deployments
- Backend handles ~1000 requests/day on Render free tier
- Database supports ~100 concurrent connections on Neon free tier
- Frontend supports unlimited static visits on Vercel

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Yahoo Finance](https://finance.yahoo.com) for market data
- [Alpha Vantage](https://www.alphavantage.co) for additional financial data
- [Hugging Face](https://huggingface.co) for AI models and inference
- [Neon](https://neon.tech) for serverless PostgreSQL
- [Render](https://render.com) for backend hosting
- [Vercel](https://vercel.com) for frontend hosting

## 📞 Support

For questions, issues, or feature requests:
- Open an issue on GitHub
- Check the documentation
- Review the deployment guides

---

**⚡ Built with passion for quantitative trading and AI innovation.**

*Elysian Trading System - Where artificial intelligence meets financial markets.*
