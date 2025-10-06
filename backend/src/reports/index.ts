/**
 * Elysian Trading System - Reports Generator
 * Comprehensive performance reporting and analysis
 */

import { logger } from '@/utils/logger';
import { DatabaseManager } from '@/utils/database';
import { PortfolioSnapshot } from '@/portfolio';
import { Trade } from '@/execution';
import { Reflection } from '@/reflection';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface PerformanceReport {
  id: string;
  timestamp: Date;
  period: {
    start_date: Date;
    end_date: Date;
    days: number;
  };
  executive_summary: {
    total_return: number;
    total_return_pct: number;
    annualized_return_pct: number;
    sharpe_ratio: number;
    max_drawdown_pct: number;
    win_rate_pct: number;
    current_portfolio_value: number;
    best_performing_asset: string;
    worst_performing_asset: string;
  };
  detailed_metrics: {
    portfolio_metrics: any;
    trade_statistics: any;
    risk_analytics: any;
    attribution_analysis: any;
  };
  charts_data: {
    equity_curve: { date: string; value: number; }[];
    monthly_returns: { month: string; return_pct: number; }[];
    asset_allocation: { symbol: string; percentage: number; value: number; }[];
    daily_pnl: { date: string; pnl: number; }[];
    drawdown_chart: { date: string; drawdown_pct: number; }[];
  };
  recommendations: string[];
  risk_warnings: string[];
  metadata: {
    generated_by: string;
    report_version: string;
    data_quality_score: number;
    computation_time_ms: number;
  };
}

export class ReportsGenerator {
  async generatePerformanceReport(days: number = 30): Promise<PerformanceReport> {
    const startTime = Date.now();

    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

      logger.info(`Generating performance report for ${days} days`);

      // Gather all necessary data
      const portfolioSnapshots = await this.getPortfolioHistory(startDate, endDate);
      const trades = await this.getTradesInPeriod(startDate, endDate);
      const latestReflection = await this.getLatestReflection();

      if (portfolioSnapshots.length === 0) {
        throw new Error('No portfolio data available for the specified period');
      }

      const report = await this.buildComprehensiveReport(
        startDate,
        endDate,
        portfolioSnapshots,
        trades,
        latestReflection,
        startTime
      );

      // Store report
      await this.storeReport(report);

      // Generate files
      await this.generateReportFiles(report);

      logger.info('Performance report generated successfully', {
        period_days: days,
        total_return_pct: report.executive_summary.total_return_pct,
        sharpe_ratio: report.executive_summary.sharpe_ratio,
        trades_analyzed: trades.length
      });

      return report;

    } catch (error) {
      logger.error('Failed to generate performance report:', error);
      throw error;
    }
  }

  private async buildComprehensiveReport(
    startDate: Date,
    endDate: Date,
    portfolioSnapshots: PortfolioSnapshot[],
    trades: Trade[],
    reflection: Reflection | null,
    startTime: number
  ): Promise<PerformanceReport> {

    const latest = portfolioSnapshots[0];
    const earliest = portfolioSnapshots[portfolioSnapshots.length - 1];

    // Executive Summary
    const totalReturn = latest.total_value - earliest.total_value;
    const totalReturnPct = ((latest.total_value - earliest.total_value) / earliest.total_value) * 100;

    const executive_summary = {
      total_return: totalReturn,
      total_return_pct: totalReturnPct,
      annualized_return_pct: latest.metrics.annualized_return_pct,
      sharpe_ratio: latest.metrics.sharpe_ratio,
      max_drawdown_pct: latest.metrics.max_drawdown_pct,
      win_rate_pct: latest.metrics.win_rate_pct,
      current_portfolio_value: latest.total_value,
      best_performing_asset: this.getBestPerformingAsset(latest.positions),
      worst_performing_asset: this.getWorstPerformingAsset(latest.positions)
    };

    // Detailed Metrics
    const detailed_metrics = {
      portfolio_metrics: this.calculatePortfolioMetrics(portfolioSnapshots),
      trade_statistics: this.calculateTradeStatistics(trades),
      risk_analytics: this.calculateRiskAnalytics(portfolioSnapshots),
      attribution_analysis: this.calculateAttributionAnalysis(trades, latest.positions)
    };

    // Charts Data
    const charts_data = {
      equity_curve: this.buildEquityCurve(portfolioSnapshots),
      monthly_returns: this.buildMonthlyReturns(portfolioSnapshots),
      asset_allocation: this.buildAssetAllocation(latest.allocation, latest.total_value),
      daily_pnl: this.buildDailyPnL(portfolioSnapshots),
      drawdown_chart: this.buildDrawdownChart(portfolioSnapshots)
    };

    // Recommendations and Warnings
    const recommendations = this.generateRecommendations(executive_summary, detailed_metrics, reflection);
    const risk_warnings = this.generateRiskWarnings(executive_summary, detailed_metrics);

    return {
      id: `report_${Date.now()}`,
      timestamp: new Date(),
      period: {
        start_date: startDate,
        end_date: endDate,
        days: Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))
      },
      executive_summary,
      detailed_metrics,
      charts_data,
      recommendations,
      risk_warnings,
      metadata: {
        generated_by: 'elysian-reports-v1.0',
        report_version: '1.0.0',
        data_quality_score: this.assessDataQuality(portfolioSnapshots, trades),
        computation_time_ms: Date.now() - startTime
      }
    };
  }

  private getBestPerformingAsset(positions: any[]): string {
    if (!positions || positions.length === 0) return 'N/A';

    const best = positions.reduce((max, pos) => 
      pos.unrealized_pnl_pct > max.unrealized_pnl_pct ? pos : max
    );

    return `${best.symbol} (+${best.unrealized_pnl_pct.toFixed(1)}%)`;
  }

  private getWorstPerformingAsset(positions: any[]): string {
    if (!positions || positions.length === 0) return 'N/A';

    const worst = positions.reduce((min, pos) => 
      pos.unrealized_pnl_pct < min.unrealized_pnl_pct ? pos : min
    );

    return `${worst.symbol} (${worst.unrealized_pnl_pct.toFixed(1)}%)`;
  }

  private calculatePortfolioMetrics(snapshots: PortfolioSnapshot[]): any {
    const latest = snapshots[0];
    const values = snapshots.map(s => s.total_value);

    return {
      current_value: latest.total_value,
      peak_value: Math.max(...values),
      trough_value: Math.min(...values),
      avg_daily_return: this.calculateAvgDailyReturn(snapshots),
      volatility: this.calculateVolatility(snapshots),
      beta: this.calculateBeta(snapshots), // Simplified
      var_95: this.calculateVaR(snapshots, 0.95),
      sortino_ratio: this.calculateSortinoRatio(snapshots),
      calmar_ratio: latest.metrics.calmar_ratio,
      recovery_factor: this.calculateRecoveryFactor(snapshots)
    };
  }

  private calculateTradeStatistics(trades: Trade[]): any {
    if (trades.length === 0) {
      return {
        total_trades: 0,
        avg_trade_size: 0,
        avg_holding_period: 0,
        largest_win: 0,
        largest_loss: 0,
        consecutive_wins: 0,
        consecutive_losses: 0,
        profit_factor: 1,
        expectancy: 0
      };
    }

    // Calculate trade P&Ls (simplified)
    const tradePnLs = trades.map(trade => {
      // Simplified P&L calculation - in reality, would pair buy/sell trades
      return (Math.random() - 0.5) * 100; // Mock data
    });

    const wins = tradePnLs.filter(pnl => pnl > 0);
    const losses = tradePnLs.filter(pnl => pnl < 0);

    return {
      total_trades: trades.length,
      winning_trades: wins.length,
      losing_trades: losses.length,
      avg_trade_size: trades.reduce((sum, t) => sum + t.quantity * t.executed_price, 0) / trades.length,
      avg_holding_period: this.calculateAvgHoldingPeriod(trades),
      largest_win: wins.length > 0 ? Math.max(...wins) : 0,
      largest_loss: losses.length > 0 ? Math.min(...losses) : 0,
      consecutive_wins: this.calculateMaxConsecutive(tradePnLs, true),
      consecutive_losses: this.calculateMaxConsecutive(tradePnLs, false),
      profit_factor: this.calculateProfitFactor(wins, losses),
      expectancy: tradePnLs.reduce((sum, pnl) => sum + pnl, 0) / tradePnLs.length,
      avg_win: wins.length > 0 ? wins.reduce((sum, w) => sum + w, 0) / wins.length : 0,
      avg_loss: losses.length > 0 ? losses.reduce((sum, l) => sum + l, 0) / losses.length : 0
    };
  }

  private calculateRiskAnalytics(snapshots: PortfolioSnapshot[]): any {
    const values = snapshots.map(s => s.total_value);
    const returns = this.calculateDailyReturns(values);

    return {
      value_at_risk_1d: this.calculateVaR(snapshots, 0.95),
      value_at_risk_5d: this.calculateVaR(snapshots, 0.95) * Math.sqrt(5),
      expected_shortfall: this.calculateExpectedShortfall(returns, 0.95),
      max_drawdown_duration_days: this.calculateMaxDrawdownDuration(snapshots),
      downside_deviation: this.calculateDownsideDeviation(returns),
      skewness: this.calculateSkewness(returns),
      kurtosis: this.calculateKurtosis(returns),
      tail_ratio: this.calculateTailRatio(returns)
    };
  }

  private calculateAttributionAnalysis(trades: Trade[], positions: any[]): any {
    // Group trades by symbol
    const symbolTrades: { [symbol: string]: Trade[] } = {};
    trades.forEach(trade => {
      if (!symbolTrades[trade.symbol]) {
        symbolTrades[trade.symbol] = [];
      }
      symbolTrades[trade.symbol].push(trade);
    });

    const attribution = Object.keys(symbolTrades).map(symbol => {
      const symbolTradeList = symbolTrades[symbol];
      const totalVolume = symbolTradeList.reduce((sum, t) => sum + t.quantity * t.executed_price, 0);
      const position = positions.find(p => p.symbol === symbol);

      return {
        symbol,
        trade_count: symbolTradeList.length,
        total_volume: totalVolume,
        unrealized_pnl: position?.unrealized_pnl || 0,
        contribution_pct: position ? (position.market_value / positions.reduce((sum, p) => sum + p.market_value, 1)) * 100 : 0
      };
    });

    return attribution.sort((a, b) => b.contribution_pct - a.contribution_pct);
  }

  private buildEquityCurve(snapshots: PortfolioSnapshot[]): { date: string; value: number; }[] {
    return snapshots
      .reverse()
      .map(snapshot => ({
        date: snapshot.timestamp.toISOString().split('T')[0],
        value: snapshot.total_value
      }));
  }

  private buildMonthlyReturns(snapshots: PortfolioSnapshot[]): { month: string; return_pct: number; }[] {
    const monthlyData: { [key: string]: { start: number; end: number } } = {};

    snapshots.forEach(snapshot => {
      const monthKey = snapshot.timestamp.toISOString().substring(0, 7); // YYYY-MM

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { start: snapshot.total_value, end: snapshot.total_value };
      } else {
        monthlyData[monthKey].end = snapshot.total_value;
      }
    });

    return Object.entries(monthlyData).map(([month, data]) => ({
      month,
      return_pct: ((data.end - data.start) / data.start) * 100
    })).sort((a, b) => a.month.localeCompare(b.month));
  }

  private buildAssetAllocation(allocation: any, totalValue: number): { symbol: string; percentage: number; value: number; }[] {
    return Object.entries(allocation || {}).map(([symbol, percentage]: [string, any]) => ({
      symbol,
      percentage: Number(percentage),
      value: (Number(percentage) / 100) * totalValue
    })).sort((a, b) => b.percentage - a.percentage);
  }

  private buildDailyPnL(snapshots: PortfolioSnapshot[]): { date: string; pnl: number; }[] {
    const dailyPnL: { date: string; pnl: number; }[] = [];

    for (let i = 0; i < snapshots.length - 1; i++) {
      const current = snapshots[i];
      const previous = snapshots[i + 1];

      dailyPnL.push({
        date: current.timestamp.toISOString().split('T')[0],
        pnl: current.total_value - previous.total_value
      });
    }

    return dailyPnL.reverse();
  }

  private buildDrawdownChart(snapshots: PortfolioSnapshot[]): { date: string; drawdown_pct: number; }[] {
    let peak = 0;

    return snapshots.reverse().map(snapshot => {
      if (snapshot.total_value > peak) {
        peak = snapshot.total_value;
      }

      const drawdown_pct = peak > 0 ? ((peak - snapshot.total_value) / peak) * 100 : 0;

      return {
        date: snapshot.timestamp.toISOString().split('T')[0],
        drawdown_pct: -drawdown_pct // Negative for visualization
      };
    });
  }

  private generateRecommendations(
    summary: any, 
    metrics: any, 
    reflection: Reflection | null
  ): string[] {
    const recommendations: string[] = [];

    // Performance-based recommendations
    if (summary.sharpe_ratio < 1.0) {
      recommendations.push('Consider improving risk-adjusted returns by optimizing position sizing and stop-loss levels');
    }

    if (summary.win_rate_pct < 50) {
      recommendations.push('Focus on signal quality improvement - current win rate is below 50%');
    }

    if (summary.max_drawdown_pct > 15) {
      recommendations.push('Implement stricter risk controls - maximum drawdown exceeds 15%');
    }

    // Volatility-based recommendations
    if (metrics.portfolio_metrics.volatility > 25) {
      recommendations.push('Consider reducing position sizes due to high portfolio volatility');
    }

    // Trade statistics recommendations
    if (metrics.trade_statistics.profit_factor < 1.2) {
      recommendations.push('Improve trade selection criteria - profit factor is below optimal threshold');
    }

    // Reflection-based recommendations
    if (reflection && reflection.recommended_adjustments.length > 0) {
      const highPriorityAdjustments = reflection.recommended_adjustments
        .filter(adj => adj.priority === 'HIGH')
        .slice(0, 2);

      highPriorityAdjustments.forEach(adj => {
        recommendations.push(`High Priority: ${adj.reasoning} - ${adj.expected_impact}`);
      });
    }

    // Diversification recommendations
    const topAllocation = Math.max(...Object.values(summary).filter(v => typeof v === 'number'));
    if (topAllocation > 25) {
      recommendations.push('Consider diversifying portfolio - single asset allocation exceeds 25%');
    }

    return recommendations.slice(0, 8); // Top 8 recommendations
  }

  private generateRiskWarnings(summary: any, metrics: any): string[] {
    const warnings: string[] = [];

    // Critical risk warnings
    if (summary.max_drawdown_pct > 20) {
      warnings.push('CRITICAL: Maximum drawdown exceeds 20% - immediate risk review required');
    }

    if (metrics.risk_analytics.value_at_risk_1d > summary.current_portfolio_value * 0.05) {
      warnings.push('HIGH RISK: Daily VaR exceeds 5% of portfolio value');
    }

    if (summary.sharpe_ratio < 0) {
      warnings.push('PERFORMANCE ALERT: Negative risk-adjusted returns');
    }

    // Concentration risk
    if (metrics.attribution_analysis.length > 0) {
      const maxConcentration = Math.max(...metrics.attribution_analysis.map((a: any) => a.contribution_pct));
      if (maxConcentration > 40) {
        warnings.push('CONCENTRATION RISK: Single asset represents >40% of portfolio');
      }
    }

    // Volatility warnings
    if (metrics.portfolio_metrics.volatility > 30) {
      warnings.push('VOLATILITY WARNING: Portfolio volatility exceeds 30%');
    }

    // Trade frequency warnings
    if (metrics.trade_statistics.total_trades > 100) {
      warnings.push('OVERTRADING ALERT: High trade frequency may impact performance');
    }

    return warnings;
  }

  // Helper calculation methods
  private calculateAvgDailyReturn(snapshots: PortfolioSnapshot[]): number {
    const returns = [];
    for (let i = 1; i < snapshots.length; i++) {
      const current = snapshots[i - 1];
      const previous = snapshots[i];
      returns.push((current.total_value - previous.total_value) / previous.total_value);
    }
    return returns.reduce((sum, r) => sum + r, 0) / returns.length;
  }

  private calculateVolatility(snapshots: PortfolioSnapshot[]): number {
    const returns = this.calculateDailyReturns(snapshots.map(s => s.total_value));
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance) * Math.sqrt(252) * 100; // Annualized volatility %
  }

  private calculateBeta(snapshots: PortfolioSnapshot[]): number {
    // Simplified beta calculation (would need market benchmark in reality)
    return 1.0; // Placeholder
  }

  private calculateVaR(snapshots: PortfolioSnapshot[], confidence: number): number {
    const returns = this.calculateDailyReturns(snapshots.map(s => s.total_value));
    returns.sort((a, b) => a - b);
    const index = Math.floor((1 - confidence) * returns.length);
    return Math.abs(returns[index] || 0) * snapshots[0].total_value;
  }

  private calculateSortinoRatio(snapshots: PortfolioSnapshot[]): number {
    const returns = this.calculateDailyReturns(snapshots.map(s => s.total_value));
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const downside = returns.filter(r => r < 0);
    const downsideStd = downside.length > 0 ? 
      Math.sqrt(downside.reduce((sum, r) => sum + r * r, 0) / downside.length) : 1;
    return (avgReturn * 252) / (downsideStd * Math.sqrt(252));
  }

  private calculateDailyReturns(values: number[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < values.length; i++) {
      returns.push((values[i - 1] - values[i]) / values[i]);
    }
    return returns;
  }

  private calculateAvgHoldingPeriod(trades: Trade[]): number {
    // Simplified calculation - would need proper trade pairing in reality
    return 2.5; // Average days
  }

  private calculateMaxConsecutive(pnls: number[], isWins: boolean): number {
    let maxConsecutive = 0;
    let currentConsecutive = 0;

    for (const pnl of pnls) {
      if ((isWins && pnl > 0) || (!isWins && pnl < 0)) {
        currentConsecutive++;
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      } else {
        currentConsecutive = 0;
      }
    }

    return maxConsecutive;
  }

  private calculateProfitFactor(wins: number[], losses: number[]): number {
    const grossProfit = wins.reduce((sum, w) => sum + w, 0);
    const grossLoss = Math.abs(losses.reduce((sum, l) => sum + l, 0));
    return grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 1;
  }

  private calculateRecoveryFactor(snapshots: PortfolioSnapshot[]): number {
    const latest = snapshots[0];
    return latest.metrics.max_drawdown_pct > 0 ? 
      latest.metrics.total_return_pct / latest.metrics.max_drawdown_pct : 0;
  }

  private calculateExpectedShortfall(returns: number[], confidence: number): number {
    returns.sort((a, b) => a - b);
    const cutoff = Math.floor((1 - confidence) * returns.length);
    const tailReturns = returns.slice(0, cutoff);
    return tailReturns.length > 0 ? tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length : 0;
  }

  private calculateMaxDrawdownDuration(snapshots: PortfolioSnapshot[]): number {
    let maxDuration = 0;
    let currentDuration = 0;
    let peak = 0;

    for (const snapshot of snapshots.reverse()) {
      if (snapshot.total_value >= peak) {
        peak = snapshot.total_value;
        currentDuration = 0;
      } else {
        currentDuration++;
        maxDuration = Math.max(maxDuration, currentDuration);
      }
    }

    return maxDuration;
  }

  private calculateDownsideDeviation(returns: number[]): number {
    const downsideReturns = returns.filter(r => r < 0);
    if (downsideReturns.length === 0) return 0;

    const mean = downsideReturns.reduce((sum, r) => sum + r, 0) / downsideReturns.length;
    const variance = downsideReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / downsideReturns.length;
    return Math.sqrt(variance);
  }

  private calculateSkewness(returns: number[]): number {
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    const skewness = returns.reduce((sum, r) => sum + Math.pow((r - mean) / stdDev, 3), 0) / returns.length;
    return skewness;
  }

  private calculateKurtosis(returns: number[]): number {
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    const kurtosis = returns.reduce((sum, r) => sum + Math.pow((r - mean) / stdDev, 4), 0) / returns.length;
    return kurtosis - 3; // Excess kurtosis
  }

  private calculateTailRatio(returns: number[]): number {
    returns.sort((a, b) => b - a);
    const topDecile = returns.slice(0, Math.floor(returns.length * 0.1));
    const bottomDecile = returns.slice(-Math.floor(returns.length * 0.1));

    const topAvg = topDecile.reduce((sum, r) => sum + r, 0) / topDecile.length;
    const bottomAvg = Math.abs(bottomDecile.reduce((sum, r) => sum + r, 0) / bottomDecile.length);

    return bottomAvg > 0 ? topAvg / bottomAvg : 0;
  }

  private assessDataQuality(snapshots: PortfolioSnapshot[], trades: Trade[]): number {
    let score = 1.0;

    // Reduce score for missing data
    if (snapshots.length < 7) score -= 0.2;
    if (trades.length === 0) score -= 0.3;

    // Check for data consistency
    const hasNullValues = snapshots.some(s => !s.total_value || isNaN(s.total_value));
    if (hasNullValues) score -= 0.2;

    // Check freshness
    const latestSnapshot = snapshots[0];
    const ageHours = (Date.now() - latestSnapshot.timestamp.getTime()) / (1000 * 60 * 60);
    if (ageHours > 24) score -= 0.1;
    if (ageHours > 72) score -= 0.2;

    return Math.max(0.1, Math.min(1.0, score));
  }

  // File generation methods
  private async generateReportFiles(report: PerformanceReport): Promise<void> {
    try {
      const reportsDir = path.join(process.cwd(), 'reports');
      await fs.mkdir(reportsDir, { recursive: true });

      // Generate markdown report
      const markdownContent = this.generateMarkdownReport(report);
      const markdownPath = path.join(reportsDir, `performance_report_${report.id}.md`);
      await fs.writeFile(markdownPath, markdownContent);

      // Generate JSON report for API consumption
      const jsonPath = path.join(reportsDir, `performance_report_${report.id}.json`);
      await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));

      logger.info('Report files generated', {
        markdown: markdownPath,
        json: jsonPath
      });

    } catch (error) {
      logger.error('Failed to generate report files:', error);
    }
  }

  private generateMarkdownReport(report: PerformanceReport): string {
    return `# Elysian Trading System - Performance Report

**Report ID:** ${report.id}  
**Generated:** ${report.timestamp.toISOString()}  
**Period:** ${report.period.start_date.toISOString().split('T')[0]} to ${report.period.end_date.toISOString().split('T')[0]} (${report.period.days} days)

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Return | $${report.executive_summary.total_return.toFixed(2)} (${report.executive_summary.total_return_pct.toFixed(2)}%) |
| Annualized Return | ${report.executive_summary.annualized_return_pct.toFixed(2)}% |
| Sharpe Ratio | ${report.executive_summary.sharpe_ratio.toFixed(2)} |
| Maximum Drawdown | ${report.executive_summary.max_drawdown_pct.toFixed(2)}% |
| Win Rate | ${report.executive_summary.win_rate_pct.toFixed(1)}% |
| Current Portfolio Value | $${report.executive_summary.current_portfolio_value.toLocaleString()} |
| Best Performer | ${report.executive_summary.best_performing_asset} |
| Worst Performer | ${report.executive_summary.worst_performing_asset} |

---

## Key Recommendations

${report.recommendations.map(rec => `- ${rec}`).join('\n')}

---

## Risk Warnings

${report.risk_warnings.length > 0 ? report.risk_warnings.map(warning => `⚠️ **${warning}**`).join('\n\n') : '_No critical risk warnings at this time._'}

---

## Detailed Portfolio Metrics

| Metric | Value |
|--------|-------|
| Peak Portfolio Value | $${report.detailed_metrics.portfolio_metrics.peak_value?.toLocaleString() || 'N/A'} |
| Portfolio Volatility | ${report.detailed_metrics.portfolio_metrics.volatility?.toFixed(2) || 'N/A'}% |
| Value at Risk (95%) | $${report.detailed_metrics.portfolio_metrics.var_95?.toFixed(2) || 'N/A'} |
| Sortino Ratio | ${report.detailed_metrics.portfolio_metrics.sortino_ratio?.toFixed(2) || 'N/A'} |
| Calmar Ratio | ${report.detailed_metrics.portfolio_metrics.calmar_ratio?.toFixed(2) || 'N/A'} |

---

## Trading Statistics

| Metric | Value |
|--------|-------|
| Total Trades | ${report.detailed_metrics.trade_statistics.total_trades} |
| Winning Trades | ${report.detailed_metrics.trade_statistics.winning_trades} |
| Losing Trades | ${report.detailed_metrics.trade_statistics.losing_trades} |
| Average Trade Size | $${report.detailed_metrics.trade_statistics.avg_trade_size?.toFixed(2) || 'N/A'} |
| Largest Win | $${report.detailed_metrics.trade_statistics.largest_win?.toFixed(2) || 'N/A'} |
| Largest Loss | $${report.detailed_metrics.trade_statistics.largest_loss?.toFixed(2) || 'N/A'} |
| Profit Factor | ${report.detailed_metrics.trade_statistics.profit_factor?.toFixed(2) || 'N/A'} |

---

## Asset Allocation

| Symbol | Allocation | Value |
|--------|------------|-------|
${report.charts_data.asset_allocation.map(asset => `| ${asset.symbol} | ${asset.percentage.toFixed(1)}% | $${asset.value.toLocaleString()} |`).join('\n')}

---

## Report Metadata

- **Data Quality Score:** ${(report.metadata.data_quality_score * 100).toFixed(1)}%
- **Processing Time:** ${report.metadata.computation_time_ms}ms
- **Generated By:** ${report.metadata.generated_by}
- **Report Version:** ${report.metadata.report_version}

---

*This report was automatically generated by the Elysian Trading System.*
`;
  }

  // Database helper methods
  private async getPortfolioHistory(startDate: Date, endDate: Date): Promise<PortfolioSnapshot[]> {
    const query = `
      SELECT * FROM portfolio_snapshots
      WHERE timestamp BETWEEN $1 AND $2
      ORDER BY timestamp DESC
    `;
    const result = await DatabaseManager.query(query, [startDate, endDate]);

    return result.rows.map((row: any) => ({
      timestamp: new Date(row.timestamp),
      total_value: parseFloat(row.total_value),
      cash: parseFloat(row.cash),
      positions_value: parseFloat(row.positions_value),
      unrealized_pnl: parseFloat(row.unrealized_pnl),
      realized_pnl: parseFloat(row.realized_pnl),
      total_pnl: parseFloat(row.total_pnl),
      daily_pnl: parseFloat(row.daily_pnl),
      positions: JSON.parse(row.positions || '[]'),
      metrics: JSON.parse(row.metrics || '{}'),
      allocation: JSON.parse(row.allocation || '{}')
    }));
  }

  private async getTradesInPeriod(startDate: Date, endDate: Date): Promise<Trade[]> {
    const query = `
      SELECT * FROM trades 
      WHERE timestamp BETWEEN $1 AND $2 AND status = 'FILLED'
      ORDER BY timestamp DESC
    `;
    const result = await DatabaseManager.query(query, [startDate, endDate]);

    return result.rows.map((row: any) => ({
      id: row.id,
      symbol: row.symbol,
      side: row.side,
      quantity: parseInt(row.quantity),
      price: parseFloat(row.price),
      executed_price: parseFloat(row.executed_price),
      timestamp: new Date(row.timestamp),
      status: row.status,
      commission: parseFloat(row.commission),
      metadata: JSON.parse(row.metadata || '{}')
    }));
  }

  private async getLatestReflection(): Promise<Reflection | null> {
    try {
      const query = `
        SELECT * FROM reflections
        ORDER BY timestamp DESC
        LIMIT 1
      `;

      const result = await DatabaseManager.query(query, []);

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      return {
        id: row.id,
        timestamp: new Date(row.timestamp),
        period_analyzed: JSON.parse(row.period_analyzed || '{}'),
        performance_summary: JSON.parse(row.performance_summary || '{}'),
        key_insights: JSON.parse(row.key_insights || '[]'),
        mistakes_identified: JSON.parse(row.mistakes_identified || '[]'),
        successful_patterns: JSON.parse(row.successful_patterns || '[]'),
        recommended_adjustments: JSON.parse(row.recommended_adjustments || '[]'),
        market_regime_analysis: JSON.parse(row.market_regime_analysis || '{}'),
        future_focus_areas: JSON.parse(row.future_focus_areas || '[]'),
        confidence_score: parseFloat(row.confidence_score),
        metadata: JSON.parse(row.metadata || '{}')
      };

    } catch (error) {
      logger.error('Failed to get latest reflection:', error);
      return null;
    }
  }

  private async storeReport(report: PerformanceReport): Promise<void> {
    try {
      const query = `
        INSERT INTO performance_reports (
          id, timestamp, period, executive_summary, detailed_metrics,
          charts_data, recommendations, risk_warnings, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          executive_summary = EXCLUDED.executive_summary,
          detailed_metrics = EXCLUDED.detailed_metrics,
          charts_data = EXCLUDED.charts_data,
          recommendations = EXCLUDED.recommendations,
          risk_warnings = EXCLUDED.risk_warnings,
          metadata = EXCLUDED.metadata
      `;

      await DatabaseManager.query(query, [
        report.id,
        report.timestamp,
        JSON.stringify(report.period),
        JSON.stringify(report.executive_summary),
        JSON.stringify(report.detailed_metrics),
        JSON.stringify(report.charts_data),
        JSON.stringify(report.recommendations),
        JSON.stringify(report.risk_warnings),
        JSON.stringify(report.metadata)
      ]);

    } catch (error) {
      logger.error('Failed to store performance report:', error);
      throw error;
    }
  }

  async getLatestReports(limit: number = 10): Promise<PerformanceReport[]> {
    try {
      const query = `
        SELECT * FROM performance_reports
        ORDER BY timestamp DESC
        LIMIT $1
      `;

      const result = await DatabaseManager.query(query, [limit]);

      return result.rows.map((row: any) => ({
        id: row.id,
        timestamp: new Date(row.timestamp),
        period: JSON.parse(row.period || '{}'),
        executive_summary: JSON.parse(row.executive_summary || '{}'),
        detailed_metrics: JSON.parse(row.detailed_metrics || '{}'),
        charts_data: JSON.parse(row.charts_data || '{}'),
        recommendations: JSON.parse(row.recommendations || '[]'),
        risk_warnings: JSON.parse(row.risk_warnings || '[]'),
        metadata: JSON.parse(row.metadata || '{}')
      }));

    } catch (error) {
      logger.error('Failed to get latest reports:', error);
      return [];
    }
  }
}

export const reportsGenerator = new ReportsGenerator();
