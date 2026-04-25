"""Step 4 – Remove multicollinear features (VIF), then univariate selection (top-k)."""
import numpy as np
import pandas as pd
from typing import List, Optional
from sklearn.feature_selection import SelectKBest, f_classif, mutual_info_classif
from statsmodels.stats.outliers_influence import variance_inflation_factor
from config import VIF_THRESHOLD, TOP_K_FEATURES


class FeatureSelector:
    def __init__(self):
        self.dropped_vif: List[str]       = []
        self.selected_features: List[str] = []
        self._selector: Optional[SelectKBest] = None

    # ──────────────────────────────────────────────────────────────────────────
    def fit_transform(self, X: pd.DataFrame, y: pd.Series) -> pd.DataFrame:
        X = X.copy()

        # ── 1. Drop constant features ────────────────────────────────────────────
        constant_cols = [c for c in X.columns if X[c].nunique() <= 1]
        X = X.drop(columns=constant_cols)
        if constant_cols:
            print(f"\n[FeatureSelector] Dropped {len(constant_cols)} constant columns.")

        # ── 2. Impute remaining NaNs ─────────────────────────────────────────────
        X = X.fillna(X.median(numeric_only=True))

        # ── 3. VIF-based multicollinearity removal ───────────────────────────────
        X = self._remove_vif(X)

        # ── 4. Univariate selection ──────────────────────────────────────────────
        k = min(TOP_K_FEATURES, X.shape[1])
        self._selector = SelectKBest(f_classif, k=k)
        self._selector.fit(X, y)

        scores = pd.Series(self._selector.scores_, index=X.columns).sort_values(ascending=False)
        print(f"\n  Top {k} features by F-score:")
        for feat, score in scores.head(k).items():
            print(f"    {feat:<35} F={score:.2f}")

        mask = self._selector.get_support()
        self.selected_features = X.columns[mask].tolist()
        return X[self.selected_features]

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        X = X.fillna(X.median(numeric_only=True))
        return X[self.selected_features]

    # ──────────────────────────────────────────────────────────────────────────
    def _remove_vif(self, X: pd.DataFrame) -> pd.DataFrame:
        print(f"\n[FeatureSelector] VIF removal (threshold={VIF_THRESHOLD})")
        cols = list(X.columns)
        while True:
            Xmat = X[cols].values.astype(float)
            vif_scores = [
                variance_inflation_factor(Xmat, i) for i in range(Xmat.shape[1])
            ]
            max_vif = max(vif_scores)
            if max_vif <= VIF_THRESHOLD:
                break
            worst = cols[np.argmax(vif_scores)]
            print(f"  Dropping '{worst}' (VIF={max_vif:.1f})")
            self.dropped_vif.append(worst)
            cols.remove(worst)

        print(f"  Remaining after VIF: {len(cols)} features")
        return X[cols]
