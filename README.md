# Customer Churn Prediction Pipeline

An end-to-end machine learning pipeline that predicts customer churn from transactional retail data, generates personalised retention recommendations, and serves results through an interactive local dashboard with an AI chat assistant.

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
                                                        ↓
                                        Dashboard API Artifacts
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

## Dashboard

A full-stack local dashboard built with **FastAPI** (backend) and **React + Vite + Tailwind CSS** (frontend).

### Pages

| Tab | Contents |
|---|---|
| **EDA** | Dataset KPIs, monthly revenue, RFM analysis, churn-by-recency chart, pipeline plot gallery |
| **Model Performance** | Metrics table, bar chart comparison, feature importance |
| **Outcomes** | Churn probability histogram, value-tier pie chart, searchable customer table |
| **What-If Tools** | Threshold slider (precision/recall tradeoff), retention savings estimator, feature importance toggle |
| **Executive Dashboard** | KPI summary, revenue trend, country breakdown, top at-risk customers, strategic actions |

### AI Chat Assistant

A floating chat widget (bottom-right) powered by **GPT-4o-mini** (OpenAI). The assistant has full context of:
- Dataset summary and churn rate
- Model performance metrics
- Top features (LightGBM & XGBoost)
- Retention recommendations list

**Export capability** — ask the assistant to export a campaign whitelist and it will filter the recommendations list and provide a CSV download button directly in the chat.

Example prompts:
- *"Which model performed best and why?"*
- *"Export high-value customers above 80% churn probability"*
- *"Give me a whitelist of medium-tier churners for re-engagement"*

## Quick Start

### 1. Run the ML pipeline

```bash
pip install -r requirements.txt
python main.py
```

### 2. Set your OpenAI API key

Create a `.env` file in the project root (copy from `.env.example`):

```bash
cp .env.example .env
# then edit .env and add your key:
# OPENAI_API_KEY=sk-...
```

### 3. Start the dashboard

```bash
./start.sh
```

This installs all dependencies, starts the FastAPI backend on port 8000 and the React frontend on port 5173, and opens both. Press `Ctrl+C` to stop both.

| Service | URL |
|---|---|
| Dashboard UI | http://localhost:5173 |
| API (docs) | http://localhost:8000/docs |

## Project Structure

```
final_project/
├── main.py                   # Pipeline entry point
├── config.py                 # All hyper-parameters and paths
├── requirements.txt          # ML pipeline dependencies
├── start.sh                  # One-command dashboard launcher
├── .env                      # API keys (gitignored)
├── .env.example              # Key template
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
├── api/
│   ├── main.py               # FastAPI app (serves pipeline outputs + chat)
│   └── requirements.txt      # API dependencies (fastapi, openai, etc.)
├── ui/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/            # EDA, ModelPerformance, Outcomes, WhatIf, Executive
│   │   ├── components/       # ChatBot, KpiCard, Spinner
│   │   └── hooks/useApi.js
│   └── vite.config.js
└── outputs/
    ├── models/               # Saved model files (.pkl / .keras)
    ├── plots/                # Generated figures
    └── results/              # CSV outputs and JSON artifacts
```

## Outputs

| Path | Contents |
|---|---|
| `outputs/results/features_raw.csv` | Full engineered feature matrix |
| `outputs/results/features_selected.csv` | Post-selection features |
| `outputs/results/model_results.csv` | Per-model evaluation metrics |
| `outputs/results/retention_recommendations.csv` | Per-customer churn probability + promotion |
| `outputs/results/all_churn_probs.csv` | Churn probabilities with RFM for all customers |
| `outputs/results/summary_stats.json` | Dataset-level KPIs |
| `outputs/results/feature_importance.json` | Feature importance scores (LGBM & XGBoost) |
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
