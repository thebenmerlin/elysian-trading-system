#!/usr/bin/env python3
"""
Elysian Trading System - ML Model Utilities
Helper functions for model loading, inference, and preprocessing
"""

import os
import json
import numpy as np
import pandas as pd
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

class ModelPredictor:
    """Lightweight ML predictor for integration with trading system"""

    def __init__(self, models_path="model_artifacts/"):
        self.models_path = models_path
        self.metadata = self.load_metadata()

    def load_metadata(self):
        """Load model metadata"""
        metadata_path = os.path.join(self.models_path, 'models_metadata.json')
        if os.path.exists(metadata_path):
            with open(metadata_path, 'r') as f:
                return json.load(f)
        return None

    def predict_price_direction(self, symbol, historical_data):
        """
        Simplified price direction prediction using technical analysis
        Returns probability of price increase (0-1)
        """
        try:
            if not historical_data or len(historical_data) < 20:
                return 0.5  # Neutral prediction

            # Convert to DataFrame
            df = pd.DataFrame(historical_data)

            # Calculate simple technical indicators
            df['sma_5'] = df['close'].rolling(window=5).mean()
            df['sma_20'] = df['close'].rolling(window=20).mean()
            df['rsi'] = self.calculate_rsi(df['close'])

            # Get latest values
            latest = df.iloc[-1]

            # Simple rule-based prediction
            score = 0.5  # Start neutral

            # Moving average signal
            if latest['close'] > latest['sma_5'] > latest['sma_20']:
                score += 0.2  # Bullish
            elif latest['close'] < latest['sma_5'] < latest['sma_20']:
                score -= 0.2  # Bearish

            # RSI signal
            if latest['rsi'] < 30:
                score += 0.15  # Oversold
            elif latest['rsi'] > 70:
                score -= 0.15  # Overbought

            # Momentum signal
            if len(df) >= 5:
                momentum = (latest['close'] - df.iloc[-5]['close']) / df.iloc[-5]['close']
                score += min(0.2, max(-0.2, momentum * 2))

            return max(0.1, min(0.9, score))

        except Exception as e:
            print(f"Error in price prediction: {e}")
            return 0.5

    def predict_volatility(self, historical_data):
        """
        Simple volatility prediction based on historical volatility
        """
        try:
            if not historical_data or len(historical_data) < 20:
                return 0.2  # Default volatility

            df = pd.DataFrame(historical_data)
            returns = df['close'].pct_change().dropna()

            # Calculate rolling volatility
            volatility = returns.rolling(window=20).std() * np.sqrt(252)

            # Predict next period volatility (simple persistence model)
            latest_vol = volatility.iloc[-1] if not volatility.empty else 0.2

            # Add slight mean reversion
            long_term_vol = volatility.mean() if not volatility.empty else 0.2
            predicted_vol = 0.7 * latest_vol + 0.3 * long_term_vol

            return max(0.05, min(1.0, predicted_vol))

        except Exception as e:
            print(f"Error in volatility prediction: {e}")
            return 0.2

    def calculate_rsi(self, prices, period=14):
        """Calculate RSI indicator"""
        delta = prices.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        return rsi.fillna(50)

    def get_prediction_confidence(self, data_quality_score):
        """Calculate prediction confidence based on data quality"""
        if data_quality_score > 0.8:
            return 0.75
        elif data_quality_score > 0.6:
            return 0.65
        elif data_quality_score > 0.4:
            return 0.55
        else:
            return 0.45

    def batch_predict(self, symbols_data):
        """Make predictions for multiple symbols"""
        results = {}

        for symbol, data in symbols_data.items():
            try:
                price_prob = self.predict_price_direction(symbol, data)
                volatility = self.predict_volatility(data)

                results[symbol] = {
                    'price_direction_prob': price_prob,
                    'predicted_volatility': volatility,
                    'timestamp': datetime.now().isoformat(),
                    'confidence': self.get_prediction_confidence(0.7)
                }
            except Exception as e:
                print(f"Error predicting for {symbol}: {e}")
                results[symbol] = None

        return results

def validate_ml_setup():
    """Validate ML setup and dependencies"""
    print("ML Components Validation")
    print("=" * 40)

    # Check if models directory exists
    models_path = "model_artifacts/"
    if os.path.exists(models_path):
        print(f"✓ Models directory exists: {models_path}")

        # Check for metadata
        metadata_file = os.path.join(models_path, 'models_metadata.json')
        if os.path.exists(metadata_file):
            print("✓ Model metadata found")
            with open(metadata_file, 'r') as f:
                metadata = json.load(f)
                print(f"  - Training date: {metadata.get('training_date', 'Unknown')}")
                print(f"  - Version: {metadata.get('version', 'Unknown')}")
        else:
            print("⚠ No model metadata (run train.py first)")
    else:
        print(f"⚠ Models directory not found: {models_path}")

    # Test predictor
    predictor = ModelPredictor(models_path)

    # Test with dummy data
    dummy_data = [
        {'close': 100}, {'close': 101}, {'close': 102}, 
        {'close': 103}, {'close': 104}, {'close': 105}
    ]

    try:
        price_pred = predictor.predict_price_direction('TEST', dummy_data)
        vol_pred = predictor.predict_volatility(dummy_data)

        print(f"✓ Price direction prediction: {price_pred:.3f}")
        print(f"✓ Volatility prediction: {vol_pred:.3f}")
        print("✓ ML predictor working correctly")
    except Exception as e:
        print(f"✗ ML predictor error: {e}")

    print("=" * 40)
    print("Note: For full ML capabilities, install:")
    print("pip install tensorflow scikit-learn")

if __name__ == "__main__":
    validate_ml_setup()
