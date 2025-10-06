# Elysian Trading System - ML Components

## Overview

The ML module provides optional machine learning capabilities for enhanced trading decisions:

- **Price Direction Prediction**: Technical analysis-based directional forecasting
- **Volatility Forecasting**: Statistical volatility predictions
- **Feature Engineering**: Technical indicators and market features
- **Model Training Pipeline**: Framework for training custom models

## Quick Start

### Basic Setup (No ML dependencies)
The system works with basic NumPy/Pandas for technical analysis:
```bash
pip install numpy pandas
python model_utils.py  # Test basic functionality
```

### Full ML Setup (Optional)
For advanced ML capabilities:
```bash
pip install tensorflow scikit-learn
python train.py  # Run training pipeline
```

## Components

### `model_utils.py`
Core prediction utilities:
- Price direction prediction (0-1 probability)
- Volatility forecasting
- Technical indicator calculations
- Batch prediction capabilities

### `train.py`
Complete ML training pipeline:
- Synthetic data generation
- LSTM model training
- Random Forest volatility models
- Model persistence and metadata

### `model_artifacts/`
Storage for trained models:
- Model files (`.h5`, `.pkl`)
- Scalers and preprocessors
- Feature definitions
- Training metadata

## Usage

### Basic Predictions
```python
from model_utils import ModelPredictor

predictor = ModelPredictor()

# Historical OHLC data
historical_data = [
    {'close': 150.0}, {'close': 151.5}, {'close': 149.8},
    # ... more data points
]

# Predict price direction (0-1 probability)
direction_prob = predictor.predict_price_direction('AAPL', historical_data)
print(f"Bullish probability: {direction_prob:.2f}")

# Predict volatility
volatility = predictor.predict_volatility(historical_data)
print(f"Expected volatility: {volatility:.2f}")
```

### Integration with Backend
```typescript
// In backend TypeScript (signal_engine or ai_reasoner)
import { spawn } from 'child_process'

const getMLPrediction = async (symbol: string, data: any[]) => {
  const python = spawn('python3', ['ml/model_utils.py', symbol])
  python.stdin.write(JSON.stringify(data))
  python.stdin.end()

  return new Promise((resolve) => {
    python.stdout.on('data', (output) => {
      resolve(JSON.parse(output.toString()))
    })
  })
}
```

## Model Development

### Training Custom Models
1. **Prepare Data**: Add real market data to replace synthetic data
2. **Configure Models**: Adjust hyperparameters in `train.py`
3. **Train Models**: Run `python train.py`
4. **Validate Results**: Check model performance metrics
5. **Deploy**: Models automatically saved to `model_artifacts/`

### Supported Model Types
- **LSTM**: Sequential neural networks for price prediction
- **Random Forest**: Ensemble models for volatility forecasting
- **Technical Analysis**: Rule-based predictors
- **Custom Models**: Framework supports additional architectures

## Configuration

### Prediction Parameters
```python
# In model_utils.py
RSI_PERIOD = 14
SMA_SHORT = 5
SMA_LONG = 20
VOLATILITY_WINDOW = 20
```

### Training Configuration
```python
# In train.py
lstm_config = {
    'sequence_length': 60,      # Input sequence length
    'epochs': 50,               # Training epochs
    'batch_size': 32           # Batch size
}

rf_config = {
    'n_estimators': 100,        # Number of trees
    'max_depth': 10             # Tree depth
}
```

## Performance Notes

### Computational Requirements
- **Basic Mode**: Minimal CPU usage
- **Training Mode**: Requires significant compute for neural networks
- **Memory**: ~100MB for basic operations
- **Storage**: Models require ~50MB total

### Prediction Latency
- **Price Direction**: <10ms
- **Volatility**: <5ms
- **Batch Predictions**: <100ms for 10 symbols

## Integration Status

### Backend Integration
The ML components integrate with:
- **Signal Engine**: Price direction probabilities
- **AI Reasoner**: Market volatility estimates
- **Risk Management**: Volatility-based position sizing
- **Portfolio Manager**: Performance attribution

### Optional Dependencies
- **Without ML libs**: Basic technical analysis only
- **With TensorFlow**: Full neural network capabilities
- **With scikit-learn**: Advanced ensemble methods

## Important Notes

- **Development Focus**: These models are for development/testing
- **Synthetic Data**: Training uses generated data by default
- **No Investment Advice**: Predictions are for simulation only
- **Optional Component**: Main system works without ML dependencies

## Validation

Test ML setup:
```bash
python model_utils.py
```

This validates:
- ✓ Model loading capabilities
- ✓ Prediction functions
- ✓ Technical indicator calculations
- ✓ Error handling

## Future Enhancements

Potential improvements:
- Real-time model updates
- Multi-timeframe predictions
- Sentiment analysis integration
- Alternative data sources
- Reinforcement learning agents

---

**Note**: The ML components enhance the trading system but are not required for basic operation. The system provides meaningful trading signals using technical analysis even without advanced ML models.
