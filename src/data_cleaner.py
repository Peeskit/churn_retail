"""Step 2 – Clean the raw concatenated dataframe."""
import pandas as pd
import numpy as np


COLUMN_MAP = {
    "Invoice":     "invoice_id",
    "StockCode":   "stock_code",
    "Description": "description",
    "Quantity":    "quantity",
    "InvoiceDate": "invoice_date",
    "Price":       "price",
    "Customer ID": "customer_id",
    "Country":     "country",
}


class DataCleaner:
    def clean(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()

        # Rename columns
        df = df.rename(columns={k: v for k, v in COLUMN_MAP.items() if k in df.columns})

        print(f"\n[DataCleaner] Raw rows : {len(df):,}")

        # ── Type coercion ───────────────────────────────────────────────────────
        df["quantity"]     = pd.to_numeric(df["quantity"],     errors="coerce")
        df["price"]        = pd.to_numeric(df["price"],        errors="coerce")
        df["invoice_date"] = pd.to_datetime(df["invoice_date"], errors="coerce", infer_datetime_format=True)

        # ── Drop rows without customer_id (anonymous transactions) ──────────────
        df = df.dropna(subset=["customer_id", "invoice_date"])
        print(f"  After dropping null customer / date: {len(df):,}")

        # ── Remove cancellations (Invoice starting with 'C') ────────────────────
        is_cancel = df["invoice_id"].astype(str).str.upper().str.startswith("C")
        df = df[~is_cancel]
        print(f"  After removing cancellations       : {len(df):,}")

        # ── Remove negative / zero quantity and price ────────────────────────────
        df = df[(df["quantity"] > 0) & (df["price"] > 0)]
        print(f"  After removing invalid qty / price : {len(df):,}")

        # ── Remove non-product stock codes (pure service / postage codes) ────────
        df = df[df["stock_code"].astype(str).str.match(r"^[A-Za-z0-9]+")]
        df = df[~df["stock_code"].astype(str).str.upper().isin(
            {"POST", "DOT", "AMAZONFEE", "M", "BANK CHARGES", "PADS", "D", "C2"}
        )]

        # ── Clean description ────────────────────────────────────────────────────
        df = df.dropna(subset=["description"])
        df["description"] = df["description"].str.strip().str.lower()

        # ── Normalise customer_id ────────────────────────────────────────────────
        df["customer_id"] = (
            df["customer_id"].astype(str)
            .str.replace(r"\.0$", "", regex=True)
            .str.strip()
        )

        # ── Derived columns ──────────────────────────────────────────────────────
        df["revenue"] = df["quantity"] * df["price"]

        # ── Drop exact duplicates ────────────────────────────────────────────────
        before = len(df)
        df = df.drop_duplicates()
        print(f"  After dropping duplicates          : {len(df):,} (removed {before - len(df):,})")

        # ── Sort ─────────────────────────────────────────────────────────────────
        df = df.sort_values(["customer_id", "invoice_date"]).reset_index(drop=True)

        print(f"  Unique customers : {df['customer_id'].nunique():,}")
        print(f"  Date range       : {df['invoice_date'].min().date()} → {df['invoice_date'].max().date()}")
        return df
