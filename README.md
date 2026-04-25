# Customer Churn Prediction Pipeline

An end-to-end machine learning pipeline that predicts customer churn from transactional retail data and generates personalised retention recommendations.

## Dataset

[UCI Online Retail II](https://archive.ics.uci.edu/ml/datasets/Online+Retail+II) — two sheets covering 2009–2011 UK-based online retail transactions.

| Column | Description |
|---|---|
| Invoice | Transaction ID |
| StockCode | Product code |
| Description | Product name |
| Quantity | Units purchased |
| InvoiceDate | Transaction timestamp |
| Price | Unit price (GBP) |
| Customer ID | Unique customer identifier |
| Country | Customer country |

## Pipeline Overview

```
Raw XLSX → Load → Clean → Feature Engineering → Feature Selection
                                                        ↓
                                               Model Training
                                          (LGBM / XGBoost / ANN / LSTM)
                                                        ↓
                                        Retention Recommendations
```

### Steps

1. **Load** — reads both Excel sheets, concatenates them (`src/data_loader.py`)
2. **Clean** — removes cancellations, invalid quantities/prices, missing customer IDs (`src/data_cleaner.py`)
3. **Feature Engineering** — builds tabular RFM-style features and monthly LSTM sequences (`src/feature_engineer.py`)
4. **Feature Selection** — VIF collinearity pruning + top-K by mutual information (`src/feature_selector.py`)
5. **Model Training** — trains and cross-evaluates four models; saves best to `outputs/models/` (`src/model_trainer.py`)
6. **Recommendations** — Apriori association rules + value-tier segmentation → per-customer promotion (`src/recommender.py`)
7. **Visualisation** — EDA, feature importance, ROC curves, recommendation summary (`src/visualizer.py`)

## Model Results

| Model | AUC | F1 | Precision | Recall | Accuracy |
|---|---|---|---|---|---|
| **LGBM** | **0.763** | **0.685** | 0.676 | 0.693 | 0.685 |
| XGBoost | 0.762 | 0.681 | 0.705 | 0.658 | 0.696 |
| ANN | 0.760 | 0.654 | 0.710 | 0.606 | 0.684 |
| LSTM | 0.729 | 0.685 | 0.633 | 0.748 | 0.662 |

## Project Structure

```
final_project/
├── main.py                   # Pipeline entry point
├── config.py                 # All hyper-parameters and paths
├── requirements.txt
├── data/
│   └── online_retail_II.xlsx
├── src/
│   ├── data_loader.py
│   ├── data_cleaner.py
│   ├── feature_engineer.py
│   ├── feature_selector.py
│   ├── model_trainer.py
│   ├── recommender.py
│   └── visualizer.py
└── outputs/
    ├── models/               # Saved model files (.pkl / .keras)
    ├── plots/                # Generated figures
    └── results/              # CSV outputs
```

## Installation

```bash
pip install -r requirements.txt
```

> TensorFlow (ANN + LSTM) requires Python 3.8–3.11. Use `--skip-lstm` to run without it.

## Usage

```bash
# Full pipeline (default dataset path)
python main.py

# Custom dataset path
python main.py --file data/online_retail_II.xlsx

# Skip LSTM (faster, no TensorFlow required)
python main.py --skip-lstm
```

## Outputs

| Path | Contents |
|---|---|
| `outputs/results/features_raw.csv` | Full engineered feature matrix |
| `outputs/results/features_selected.csv` | Post-selection features |
| `outputs/results/model_results.csv` | Per-model evaluation metrics |
| `outputs/results/retention_recommendations.csv` | Per-customer churn probability + promotion |
| `outputs/plots/` | EDA, importance, ROC, recommendation charts |
| `outputs/models/` | Serialised trained models |

## Key Configuration (`config.py`)

| Parameter | Default | Description |
|---|---|---|
| `CHURN_WINDOW_DAYS` | 90 | Days of inactivity → churned |
| `OBSERVATION_WINDOW_DAYS` | 365 | Feature lookback window |
| `TOP_K_FEATURES` | 15 | Features kept after selection |
| `TEST_SIZE` | 0.2 | Train/test split ratio |
| `CHURN_PROB_THRESHOLD` | 0.5 | Probability cutoff for churn label |
| `HIGH_VALUE_QUANTILE` | 0.75 | Monetary quantile for high-value tier |
