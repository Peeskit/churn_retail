"""Step 1 – Load the two-sheet .xlsx file and concatenate."""
import glob
import os
import pandas as pd
from config import DATA_DIR


class DataLoader:
    def __init__(self, data_dir: str = DATA_DIR):
        self.data_dir = data_dir

    def load(self, filepath: str | None = None) -> pd.DataFrame:
        if filepath is None:
            files = glob.glob(os.path.join(self.data_dir, "*.xlsx"))
            if not files:
                raise FileNotFoundError(
                    f"No .xlsx file found in '{self.data_dir}/'. "
                    "Place the retail dataset there and re-run."
                )
            filepath = files[0]

        print(f"\n[DataLoader] Loading: {filepath}")
        xl = pd.ExcelFile(filepath)
        sheet_names = xl.sheet_names
        print(f"  Sheets detected: {sheet_names}")

        dfs = []
        for sheet in sheet_names[:2]:
            df = pd.read_excel(filepath, sheet_name=sheet, dtype=str)
            df["_source_sheet"] = sheet
            print(f"  Sheet '{sheet}': {len(df):,} rows × {len(df.columns)} cols")
            dfs.append(df)

        combined = pd.concat(dfs, ignore_index=True)
        print(f"  Combined total : {len(combined):,} rows")
        return combined
