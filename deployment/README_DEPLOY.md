# Elysian Trading System - Deployment Guide

Complete step-by-step guide for deploying the Elysian Trading System on free-tier cloud services.

## 🎯 Deployment Stack

- **Database**: Neon PostgreSQL (Free tier: 0.5GB storage, 100 hours compute/month)
- **Backend**: Render Web Service (Free tier: 750 hours/month, 512MB RAM)
- **Frontend**: Vercel (Free tier: unlimited static hosting, 100GB bandwidth)

## 📋 Prerequisites

- GitHub account (for code repository)
- Neon account (for database)
- Render account (for backend)
- Vercel account (for frontend)
- Optional: Hugging Face account (for AI features)

## 🗄️ Step 1: Database Setup (Neon)

### 1.1 Create Neon Account
1. Go to [neon.tech](https://neon.tech)
2. Sign up with GitHub
3. Create a new project: `elysian-trading`

### 1.2 Setup Database
1. Copy the connection string from your Neon dashboard
2. Connect to your database using the Neon SQL Editor or any PostgreSQL client
3. Run the setup script:
   ```sql
   -- Copy and paste content from deployment/neon/setup.sql
   -- This creates all necessary tables and indexes
   ```

### 1.3 Verify Setup
```sql
-- Check tables were created
SELECT schemaname, tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Should show: ai_analysis, features, market_data, performance_reports, 
-- portfolio_snapshots, positions, reflections, runner_cycles, 
-- signals, system_config, trades
```

## 🖥️ Step 2: Backend Deployment (Render)

### 2.1 Create Render Account
1. Go to [render.com](https://render.com)
2. Sign up with GitHub
3. Grant access to your repository

### 2.2 Deploy Backend
1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure service:
   - **Name**: `elysian-backend`
   - **Region**: Choose closest to your location
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`

### 2.3 Environment Variables
Add these environment variables in Render:

```bash
NODE_ENV=production
PORT=4000
DATABASE_URL=<your-neon-connection-string>
RUNNER_TICKERS=AAPL,MSFT,GOOGL,NVDA,TSLA
ELYSIAN_LIVE=false
INITIAL_CASH=100000
RUN_INTERVAL_MINUTES=15
AUTO_START_RUNNER=false
ELYSIAN_API_KEY=<generate-a-secure-random-key>
```

Optional (for AI features):
```bash
HF_API_KEY=<your-huggingface-api-key>
ENABLE_AI_ANALYSIS=true
```

### 2.4 Deploy and Test
1. Click "Create Web Service"
2. Wait for deployment to complete (~5-10 minutes)
3. Test the health endpoint:
   ```bash
   curl https://your-backend-url.onrender.com/health
   ```

## 🌐 Step 3: Frontend Deployment (Vercel)

### 3.1 Create Vercel Account
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Import your repository

### 3.2 Deploy Frontend
1. Click "Add New..." → "Project"
2. Import your GitHub repository
3. Configure project:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

### 3.3 Environment Variables
Add these environment variables in Vercel:

```bash
NEXT_PUBLIC_API_URL=https://your-backend-url.onrender.com
NEXT_PUBLIC_API_KEY=<same-key-as-backend>
```

### 3.4 Deploy and Test
1. Click "Deploy"
2. Wait for deployment to complete (~2-3 minutes)
3. Visit your deployed frontend URL
4. Verify the dashboard loads and connects to the backend

## ✅ Step 4: Verification

### 4.1 Test Full System
1. **Frontend**: Verify dashboard loads at your Vercel URL
2. **Backend**: Check health endpoint returns success
3. **Database**: Confirm connection in backend logs
4. **API**: Test portfolio endpoint:
   ```bash
   curl -H "x-elysian-key: YOUR_API_KEY" \
        https://your-backend-url.onrender.com/api/portfolio
   ```

### 4.2 Start Trading System
1. Go to your frontend dashboard
2. Click "START" button
3. Verify system status changes to "RUNNING"
4. Click "RUN CYCLE" to test a manual trading cycle

### 4.3 Monitor Logs
- **Render**: View logs in Render dashboard → Your service → Logs
- **Vercel**: View logs in Vercel dashboard → Your project → Functions
- **Neon**: Monitor queries in Neon dashboard → Monitoring

## 🔧 Configuration

### Free Tier Limits & Optimization

#### Render (Backend)
- **Limit**: 750 hours/month, sleeps after 15 minutes of inactivity
- **Optimization**: 
  - Set `RUN_INTERVAL_MINUTES=30` to reduce activity
  - Use `AUTO_START_RUNNER=false` to prevent auto-start on sleep/wake

#### Neon (Database)
- **Limit**: 0.5GB storage, 100 compute hours/month
- **Optimization**:
  - Data is automatically archived after inactivity
  - Limit historical data retention if needed

#### Vercel (Frontend)
- **Limit**: 100GB bandwidth/month, unlimited static hosting
- **Optimization**: No changes needed for typical usage

### Trading Configuration
For free tier deployment, use conservative settings:

```bash
RUNNER_TICKERS=AAPL,MSFT,GOOGL  # Limit to 3-5 stocks
RUN_INTERVAL_MINUTES=30         # Run every 30 minutes
MAX_DAILY_RUNS=48              # Limit to 48 runs per day
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Backend Not Starting
- **Issue**: Build fails or service won't start
- **Solutions**:
  - Check environment variables are set
  - Verify `DATABASE_URL` is correct
  - Check Render build logs for specific errors

#### 2. Database Connection Errors
- **Issue**: Backend can't connect to Neon database
- **Solutions**:
  - Verify connection string format
  - Ensure database isn't sleeping (make a test query in Neon console)
  - Check if SSL is required (usually yes for production)

#### 3. Frontend Can't Reach Backend
- **Issue**: API calls fail with network errors
- **Solutions**:
  - Verify `NEXT_PUBLIC_API_URL` points to your Render URL
  - Ensure API key matches between frontend and backend
  - Check CORS configuration in backend

#### 4. Trading Runner Not Working
- **Issue**: Runner starts but doesn't execute trades
- **Solutions**:
  - Check market data sources are working
  - Verify tickers are valid
  - Review backend logs for specific errors

### Debug Commands

```bash
# Test backend health
curl https://your-backend-url.onrender.com/health

# Test with API key
curl -H "x-elysian-key: YOUR_KEY" \
     https://your-backend-url.onrender.com/internal/runner/status

# Check database connection
psql "YOUR_DATABASE_URL" -c "SELECT NOW();"
```

## 📊 Monitoring

### Health Checks
- **Backend**: `GET /health` endpoint
- **Database**: Check Neon dashboard for connection status
- **Frontend**: Verify deployment status in Vercel dashboard

### Performance Monitoring
- Monitor Render resource usage
- Check Neon compute hours consumption
- Review Vercel bandwidth usage

### Logging
- **Backend logs**: Render dashboard → Logs
- **Database logs**: Neon dashboard → Monitoring
- **Build logs**: Check deployment logs in respective dashboards

## 🔄 Updates and Maintenance

### Updating the Application
1. Push changes to your GitHub repository
2. Render and Vercel will automatically redeploy
3. Database migrations (if any) must be run manually

### Database Maintenance
1. Monitor storage usage in Neon dashboard
2. Archive old data if approaching limits
3. Consider upgrading to paid tier if needed

### Backup Strategy
1. Export critical data from database regularly
2. Keep configuration backups
3. Document any customizations

## 🎉 Success!

Your Elysian Trading System is now deployed and running on free-tier services!

- **Frontend**: https://your-project.vercel.app
- **Backend**: https://your-backend.onrender.com
- **Database**: Managed by Neon

The system will automatically start paper trading with the configured stocks and parameters.

---

**Need help?** Check the main README or open an issue on GitHub.
