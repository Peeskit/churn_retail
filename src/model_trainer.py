"""Step 5 – Train LGBM, XGBoost, ANN, LSTM; evaluate and select the best model."""
import os
import joblib
import numpy as np
import pandas as pd
import warnings
from typing import Dict, Optional
warnings.filterwarnings("ignore")

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    roc_auc_score, f1_score, precision_score,
    recall_score, accuracy_score, classification_report,
)

import lightgbm as lgb
import xgboost as xgb

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, callbacks

from config import (
    TEST_SIZE, VAL_SIZE, RANDOM_STATE,
    LGBM_PARAMS, XGB_PARAMS, ANN_PARAMS, LSTM_PARAMS,
    SEQUENCE_LENGTH, LSTM_SEQ_FEATURES,
    MODELS_DIR,
)


# ── Metrics helper ─────────────────────────────────────────────────────────────
def _metrics(y_true, y_prob, threshold=0.5) -> dict:
    y_pred = (y_prob >= threshold).astype(int)
    return {
        "AUC":       round(roc_auc_score(y_true, y_prob), 4),
        "F1":        round(f1_score(y_true, y_pred, zero_division=0), 4),
        "Precision": round(precision_score(y_true, y_pred, zero_division=0), 4),
        "Recall":    round(recall_score(y_true, y_pred, zero_division=0), 4),
        "Accuracy":  round(accuracy_score(y_true, y_pred), 4),
    }


class ModelTrainer:
    def __init__(self):
        self.scaler     = StandardScaler()
        self.models_    : dict = {}
        self.results_   : dict = {}
        self.best_name_ : str  = ""
        self.best_model_        = None

    # ──────────────────────────────────────────────────────────────────────────
    # Public entry-point
    # ──────────────────────────────────────────────────────────────────────────
    def fit_evaluate(
        self,
        X: pd.DataFrame,
        y: pd.Series,
        sequences: Optional[Dict[str, np.ndarray]] = None,
    ) -> pd.DataFrame:
        os.makedirs(MODELS_DIR, exist_ok=True)

        # Time-stratified split (keep same customers across models)
        X_tr, X_te, y_tr, y_te = train_test_split(
            X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y
        )
        X_tr, X_val, y_tr, y_val = train_test_split(
            X_tr, y_tr, test_size=VAL_SIZE / (1 - TEST_SIZE),
            random_state=RANDOM_STATE, stratify=y_tr,
        )

        print(f"\n[ModelTrainer] Train={len(X_tr):,}  Val={len(X_val):,}  Test={len(X_te):,}")
        print(f"  Churn rate — train: {y_tr.mean():.2%}  val: {y_val.mean():.2%}  test: {y_te.mean():.2%}")

        # Scale
        X_tr_s  = self.scaler.fit_transform(X_tr)
        X_val_s = self.scaler.transform(X_val)
        X_te_s  = self.scaler.transform(X_te)

        # ── LGBM ────────────────────────────────────────────────────────────────
        self._train_lgbm(X_tr, X_val, X_te, y_tr, y_val, y_te)

        # ── XGBoost ─────────────────────────────────────────────────────────────
        self._train_xgb(X_tr, X_val, X_te, y_tr, y_val, y_te)

        # ── ANN ─────────────────────────────────────────────────────────────────
        self._train_ann(X_tr_s, X_val_s, X_te_s, y_tr, y_val, y_te, n_features=X_tr.shape[1])

        # ── LSTM ─────────────────────────────────────────────────────────────────
        if sequences is not None:
            self._train_lstm(sequences, X_tr.index, X_val.index, X_te.index, y_tr, y_val, y_te)
        else:
            print("  [LSTM] Skipped: no sequence data provided.")

        # ── Summary ──────────────────────────────────────────────────────────────
        results_df = pd.DataFrame(self.results_).T.sort_values("AUC", ascending=False)
        print("\n[ModelTrainer] ── Model Comparison ──")
        print(results_df.to_string())

        self.best_name_ = results_df.index[0]
        self.best_model_ = self.models_[self.best_name_]
        print(f"\n  Best model: {self.best_name_} (AUC={results_df.iloc[0]['AUC']})")

        return results_df

    # ──────────────────────────────────────────────────────────────────────────
    def predict_proba(self, X: pd.DataFrame, model_name: Optional[str] = None) -> np.ndarray:
        name  = model_name or self.best_name_
        model = self.models_[name]
        X_s   = self.scaler.transform(X)
        if name in ("LGBM", "XGBoost"):
            model = self.models_[name]
            X_s = X.values if name == "LGBM" else X.values
            return model.predict_proba(X_s)[:, 1]
        elif name == "ANN":
            return model.predict(X_s, verbose=0).flatten()
        elif name == "LSTM":
            raise ValueError("Use predict_proba_lstm() for LSTM.")
        return np.zeros(len(X))

    def predict_proba_lstm(self, sequences: Dict[str, np.ndarray], customer_ids) -> np.ndarray:
        model = self.models_["LSTM"]
        X_seq = self._build_seq_matrix(sequences, customer_ids)
        return model.predict(X_seq, verbose=0).flatten()

    # ──────────────────────────────────────────────────────────────────────────
    # Private: individual model trainers
    # ──────────────────────────────────────────────────────────────────────────
    def _train_lgbm(self, X_tr, X_val, X_te, y_tr, y_val, y_te):
        print("\n  [LGBM] Training …")
        model = lgb.LGBMClassifier(**LGBM_PARAMS)
        model.fit(
            X_tr, y_tr,
            eval_set=[(X_val, y_val)],
            callbacks=[lgb.early_stopping(50, verbose=False), lgb.log_evaluation(-1)],
        )
        prob = model.predict_proba(X_te)[:, 1]
        self.models_["LGBM"] = model
        self.results_["LGBM"] = _metrics(y_te, prob)
        joblib.dump(model, os.path.join(MODELS_DIR, "lgbm.pkl"))
        print(f"    AUC={self.results_['LGBM']['AUC']}  F1={self.results_['LGBM']['F1']}")

    def _train_xgb(self, X_tr, X_val, X_te, y_tr, y_val, y_te):
        print("  [XGBoost] Training …")
        params = {k: v for k, v in XGB_PARAMS.items() if k != "use_label_encoder"}
        model = xgb.XGBClassifier(**params, early_stopping_rounds=50, verbosity=0)
        model.fit(X_tr, y_tr, eval_set=[(X_val, y_val)], verbose=False)
        prob = model.predict_proba(X_te)[:, 1]
        self.models_["XGBoost"] = model
        self.results_["XGBoost"] = _metrics(y_te, prob)
        joblib.dump(model, os.path.join(MODELS_DIR, "xgboost.pkl"))
        print(f"    AUC={self.results_['XGBoost']['AUC']}  F1={self.results_['XGBoost']['F1']}")

    def _train_ann(self, X_tr_s, X_val_s, X_te_s, y_tr, y_val, y_te, n_features):
        print("  [ANN] Training …")
        p = ANN_PARAMS
        inp = keras.Input(shape=(n_features,))
        x   = inp
        for units in p["hidden_units"]:
            x = layers.Dense(units, activation="relu")(x)
            x = layers.BatchNormalization()(x)
            x = layers.Dropout(p["dropout"])(x)
        out   = layers.Dense(1, activation="sigmoid")(x)
        model = keras.Model(inp, out)
        model.compile(
            optimizer=keras.optimizers.Adam(p["learning_rate"]),
            loss="binary_crossentropy",
            metrics=["AUC"],
        )
        cb = [
            callbacks.EarlyStopping(patience=15, restore_best_weights=True, monitor="val_AUC", mode="max"),
            callbacks.ReduceLROnPlateau(patience=5, factor=0.5, monitor="val_AUC", mode="max"),
        ]
        model.fit(
            X_tr_s, y_tr.values,
            validation_data=(X_val_s, y_val.values),
            epochs=p["epochs"], batch_size=p["batch_size"],
            callbacks=cb, verbose=0,
        )
        prob = model.predict(X_te_s, verbose=0).flatten()
        self.models_["ANN"] = model
        self.results_["ANN"] = _metrics(y_te, prob)
        model.save(os.path.join(MODELS_DIR, "ann.keras"))
        print(f"    AUC={self.results_['ANN']['AUC']}  F1={self.results_['ANN']['F1']}")

    def _train_lstm(self, sequences, train_idx, val_idx, test_idx, y_tr, y_val, y_te):
        print("  [LSTM] Training …")
        n_feat = len(LSTM_SEQ_FEATURES)

        X_seq_tr  = self._build_seq_matrix(sequences, train_idx)
        X_seq_val = self._build_seq_matrix(sequences, val_idx)
        X_seq_te  = self._build_seq_matrix(sequences, test_idx)

        # Normalise each feature across time steps
        flat_tr = X_seq_tr.reshape(-1, n_feat)
        mu  = flat_tr.mean(axis=0)
        sig = flat_tr.std(axis=0) + 1e-9
        X_seq_tr  = (X_seq_tr  - mu) / sig
        X_seq_val = (X_seq_val - mu) / sig
        X_seq_te  = (X_seq_te  - mu) / sig
        self._lstm_norm = (mu, sig)

        p   = LSTM_PARAMS
        inp = keras.Input(shape=(SEQUENCE_LENGTH, n_feat))
        x   = inp
        for i, units in enumerate(p["units"]):
            return_seq = (i < len(p["units"]) - 1)
            x = layers.LSTM(units, return_sequences=return_seq)(x)
            x = layers.Dropout(p["dropout"])(x)
        out   = layers.Dense(1, activation="sigmoid")(x)
        model = keras.Model(inp, out)
        model.compile(
            optimizer=keras.optimizers.Adam(p["learning_rate"]),
            loss="binary_crossentropy",
            metrics=["AUC"],
        )
        cb = [
            callbacks.EarlyStopping(patience=15, restore_best_weights=True, monitor="val_AUC", mode="max"),
        ]
        model.fit(
            X_seq_tr, y_tr.values,
            validation_data=(X_seq_val, y_val.values),
            epochs=p["epochs"], batch_size=p["batch_size"],
            callbacks=cb, verbose=0,
        )
        prob = model.predict(X_seq_te, verbose=0).flatten()
        self.models_["LSTM"] = model
        self.results_["LSTM"] = _metrics(y_te, prob)
        model.save(os.path.join(MODELS_DIR, "lstm.keras"))
        print(f"    AUC={self.results_['LSTM']['AUC']}  F1={self.results_['LSTM']['F1']}")

    # ──────────────────────────────────────────────────────────────────────────
    def _build_seq_matrix(self, sequences: dict, customer_ids) -> np.ndarray:
        n_feat = len(LSTM_SEQ_FEATURES)
        X = np.zeros((len(customer_ids), SEQUENCE_LENGTH, n_feat), dtype=np.float32)
        for i, cid in enumerate(customer_ids):
            if cid in sequences:
                X[i] = sequences[cid]
        return X
