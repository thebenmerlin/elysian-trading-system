"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiReasoner = void 0;
const logger_1 = require("../utils/logger");
const database_1 = require("../utils/database");
class AIReasoner {
    async analyzeMarket(symbol, marketData, features, signals) {
        logger_1.logger.debug(`AI analysis for ${symbol} (mock implementation)`);
        const analysis = {
            symbol,
            timestamp: new Date(),
            analysis_type: 'market_sentiment',
            sentiment_score: Math.random() * 2 - 1,
            confidence_score: 0.3 + Math.random() * 0.4,
            reasoning: `Mock AI analysis for ${symbol}: Market conditions appear neutral with moderate volatility.`,
            market_context: {
                market_regime: 'neutral',
                volatility: 'moderate',
                trend: 'sideways'
            },
            recommendations: {
                action: 'HOLD',
                confidence: 0.5,
                reasoning: 'Insufficient signal strength for directional bias'
            }
        };
        await this.storeAnalysis(analysis);
        return analysis;
    }
    async getLatestAnalysis(symbols) {
        try {
            const query = `
        SELECT * FROM ai_analysis 
        WHERE symbol = ANY($1) 
        ORDER BY timestamp DESC 
        LIMIT 10
      `;
            const result = await database_1.DatabaseManager.query(query, [symbols]);
            return result.rows.map((row) => ({
                id: row.id,
                symbol: row.symbol,
                timestamp: new Date(row.timestamp),
                analysis_type: row.analysis_type,
                sentiment_score: parseFloat(row.sentiment_score || '0'),
                confidence_score: parseFloat(row.confidence_score || '0'),
                reasoning: row.reasoning,
                market_context: JSON.parse(row.market_context || '{}'),
                recommendations: JSON.parse(row.recommendations || '{}')
            }));
        }
        catch (error) {
            logger_1.logger.error('Failed to get latest AI analysis:', error);
            return [];
        }
    }
    async storeAnalysis(analysis) {
        try {
            const query = `
        INSERT INTO ai_analysis (
          symbol, timestamp, analysis_type, sentiment_score, 
          confidence_score, reasoning, market_context, recommendations
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;
            await database_1.DatabaseManager.query(query, [
                analysis.symbol,
                analysis.timestamp,
                analysis.analysis_type,
                analysis.sentiment_score,
                analysis.confidence_score,
                analysis.reasoning,
                JSON.stringify(analysis.market_context),
                JSON.stringify(analysis.recommendations)
            ]);
        }
        catch (error) {
            logger_1.logger.error('Failed to store AI analysis:', error);
        }
    }
    async healthCheck() {
        try {
            logger_1.logger.debug('AI reasoner health check: OK (mock)');
            return true;
        }
        catch (error) {
            logger_1.logger.error('AI reasoner health check failed:', error);
            return false;
        }
    }
}
exports.aiReasoner = new AIReasoner();
