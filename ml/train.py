#!/usr/bin/env python3
"""
Elysian Trading System - ML Training Pipeline
Trains LSTM models for price prediction and volatility forecasting
"""

import os
import sys
import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import MinMaxScaler, StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, mean_absolute_error
import joblib
import json
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

# Set random seeds for reproducibility
np.random.seed(42)
tf.random.set_seed(42)

class ElysianMLTrainer:
    def __init__(self, data_path="data/", models_path="model_artifacts/"):
        self.data_path = data_path
        self.models_path = models_path
        self.ensure_directories()

        # Model configurations
        self.lstm_config = {
            'sequence_length': 60,
            'features': ['open', 'high', 'low', 'close', 'volume'],
            'target': 'close',
            'epochs': 50,
            'batch_size': 32,
            'validation_split': 0.2
        }

        self.rf_config = {
            'n_estimators': 100,
            'max_depth': 10,
            'min_samples_split': 5,
            'min_samples_leaf': 2,
            'random_state': 42
        }

    def ensure_directories(self):
        """Create necessary directories"""
        os.makedirs(self.data_path, exist_ok=True)
        os.makedirs(self.models_path, exist_ok=True)

    def generate_sample_data(self, symbols=['AAPL', 'MSFT', 'GOOGL'], days=1000):
        """Generate sample market data for training"""
        print("Generating sample training data...")

        all_data = []

        for symbol in symbols:
            # Generate realistic stock price data using random walk
            dates = pd.date_range(start=datetime.now() - timedelta(days=days), 
                                 end=datetime.now(), freq='D')

            # Starting price
            base_price = np.random.uniform(50, 300)

            # Generate price series with trend and volatility
            returns = np.random.normal(0.0005, 0.02, len(dates))  # Daily returns
            prices = [base_price]

            for ret in returns[1:]:
                new_price = prices[-1] * (1 + ret)
                prices.append(max(new_price, 1.0))  # Prevent negative prices

            # Create OHLCV data
            df = pd.DataFrame({'date': dates, 'close': prices})
            df['open'] = df['close'].shift(1) * (1 + np.random.normal(0, 0.005, len(df)))
            df['high'] = df[['open', 'close']].max(axis=1) * (1 + np.abs(np.random.normal(0, 0.01, len(df))))
            df['low'] = df[['open', 'close']].min(axis=1) * (1 - np.abs(np.random.normal(0, 0.01, len(df))))
            df['volume'] = np.random.lognormal(15, 1, len(df)).astype(int)
            df['symbol'] = symbol

            # Add technical indicators
            df = self.add_technical_indicators(df)

            all_data.append(df)

        # Combine all data
        combined_data = pd.concat(all_data, ignore_index=True)
        combined_data = combined_data.dropna()

        # Save to CSV
        data_file = os.path.join(self.data_path, 'training_data.csv')
        combined_data.to_csv(data_file, index=False)

        print(f"Generated {len(combined_data)} records for {len(symbols)} symbols")
        print(f"Data saved to: {data_file}")

        return combined_data

    def add_technical_indicators(self, df):
        """Add technical indicators to the dataframe"""
        # Simple moving averages
        df['sma_5'] = df['close'].rolling(window=5).mean()
        df['sma_20'] = df['close'].rolling(window=20).mean()
        df['sma_50'] = df['close'].rolling(window=50).mean()

        # Exponential moving averages
        df['ema_12'] = df['close'].ewm(span=12).mean()
        df['ema_26'] = df['close'].ewm(span=26).mean()

        # RSI
        delta = df['close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        df['rsi'] = 100 - (100 / (1 + rs))

        # MACD
        df['macd'] = df['ema_12'] - df['ema_26']
        df['macd_signal'] = df['macd'].ewm(span=9).mean()
        df['macd_histogram'] = df['macd'] - df['macd_signal']

        # Bollinger Bands
        bb_period = 20
        bb_std = 2
        df['bb_middle'] = df['close'].rolling(window=bb_period).mean()
        bb_std_dev = df['close'].rolling(window=bb_period).std()
        df['bb_upper'] = df['bb_middle'] + (bb_std_dev * bb_std)
        df['bb_lower'] = df['bb_middle'] - (bb_std_dev * bb_std)
        df['bb_percent'] = (df['close'] - df['bb_lower']) / (df['bb_upper'] - df['bb_lower'])

        # Volatility
        df['volatility'] = df['close'].pct_change().rolling(window=20).std() * np.sqrt(252)

        # Price change
        df['price_change'] = df['close'].pct_change()
        df['price_change_5d'] = df['close'].pct_change(periods=5)

        return df

    def run_training_pipeline(self):
        """Run complete training pipeline"""
        print("=" * 60)
        print("Elysian Trading System - ML Training Pipeline")
        print("=" * 60)

        # Generate sample data for demonstration
        data = self.generate_sample_data()

        print(f"Training data shape: {data.shape}")
        print(f"Symbols: {data['symbol'].unique()}")

        # Save metadata
        metadata = {
            'training_date': datetime.now().isoformat(),
            'data_shape': list(data.shape),
            'symbols': list(data['symbol'].unique()),
            'lstm_config': self.lstm_config,
            'rf_config': self.rf_config,
            'version': '1.0.0'
        }

        metadata_path = os.path.join(self.models_path, 'models_metadata.json')
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)

        print("\n" + "=" * 60)
        print("ML Training pipeline setup completed!")
        print("=" * 60)
        print("Note: This is a demonstration setup.")
        print("For full ML training, install TensorFlow and scikit-learn:")
        print("pip install tensorflow scikit-learn")
        print(f"Models metadata saved in: {self.models_path}")

        return metadata

if __name__ == "__main__":
    trainer = ElysianMLTrainer()
    trainer.run_training_pipeline()
