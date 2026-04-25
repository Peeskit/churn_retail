import os

# ── Paths ──────────────────────────────────────────────────────────────────────
DATA_DIR    = "data"
OUTPUT_DIR  = "outputs"
MODELS_DIR  = os.path.join(OUTPUT_DIR, "models")
PLOTS_DIR   = os.path.join(OUTPUT_DIR, "plots")
RESULTS_DIR = os.path.join(OUTPUT_DIR, "results")

# ── Churn definition ───────────────────────────────────────────────────────────
CHURN_WINDOW_DAYS       = 90   # customers with no purchase in this trailing window → churned
OBSERVATION_WINDOW_DAYS = 365  # features are built from this preceding window

# ── Feature engineering ────────────────────────────────────────────────────────
WINDOW_DAYS = [30, 60, 90]     # rolling windows for aggregation features

# ── Feature selection ──────────────────────────────────────────────────────────
VIF_THRESHOLD  = 10
TOP_K_FEATURES = 15

# ── LSTM sequence ──────────────────────────────────────────────────────────────
SEQUENCE_LENGTH    = 6   # months
LSTM_SEQ_FEATURES  = ["revenue", "txn_count", "qty", "unique_sku", "avg_price"]

# ── Train / test ───────────────────────────────────────────────────────────────
TEST_SIZE     = 0.2
VAL_SIZE      = 0.1
RANDOM_STATE  = 42

# ── Model hyper-parameters ─────────────────────────────────────────────────────
LGBM_PARAMS = dict(
    n_estimators=500, learning_rate=0.05, num_leaves=31, max_depth=-1,
    min_child_samples=20, subsample=0.8, colsample_bytree=0.8,
    reg_alpha=0.1, reg_lambda=0.1, random_state=RANDOM_STATE, n_jobs=-1,
    verbose=-1,
)

XGB_PARAMS = dict(
    n_estimators=500, learning_rate=0.05, max_depth=6, min_child_weight=1,
    subsample=0.8, colsample_bytree=0.8, reg_alpha=0.1, reg_lambda=1.0,
    random_state=RANDOM_STATE, n_jobs=-1, eval_metric="auc",
    use_label_encoder=False,
)

ANN_PARAMS = dict(
    hidden_units=[128, 64, 32], dropout=0.3,
    epochs=100, batch_size=256, learning_rate=1e-3,
)

LSTM_PARAMS = dict(
    units=[64, 32], dropout=0.3,
    epochs=100, batch_size=128, learning_rate=1e-3,
)

# ── Recommendation ─────────────────────────────────────────────────────────────
APRIORI_MIN_SUPPORT    = 0.02
APRIORI_MIN_CONFIDENCE = 0.3
APRIORI_MIN_LIFT       = 1.2

CHURN_PROB_THRESHOLD   = 0.5   # above this → predicted churner
HIGH_VALUE_QUANTILE    = 0.75  # monetary quantile for high-value customer
