"""
Parses an uploaded CSV or Excel file of leads into a list of plain dicts,
using the same field names as the Lead model. Column matching is
deliberately lenient (case-insensitive, several accepted spellings per
field) since real-world spreadsheets never use exactly one naming
convention.
"""

import pandas as pd

# Each Lead field maps to a list of acceptable column header spellings
# (already lowercased for matching).
COLUMN_ALIASES = {
    "first_name": ["first_name", "first name", "firstname"],
    "last_name": ["last_name", "last name", "lastname"],
    "job_title": ["job_title", "job title", "title", "role"],
    "company": ["company", "company_name", "company name", "organization"],
    "phone_number": ["phone_number", "phone number", "phone", "mobile", "cell"],
    "email": ["email", "email_address", "email address"],
    "website": ["website", "url", "web site"],
    "address": ["address", "street_address", "street address"],
    "city": ["city"],
    "state": ["state", "province", "region"],
}

MAX_ROWS = 5000  # safety cap so one huge file can't tie up the worker for hours


class LeadFileParseError(Exception):
    pass


def _build_column_map(columns):
    """Maps each Lead field name -> the actual column name found in the file, if any."""
    lower_columns = {str(c).strip().lower(): c for c in columns}
    mapping = {}
    for field, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            if alias in lower_columns:
                mapping[field] = lower_columns[alias]
                break
    return mapping


def parse_lead_file(file_path: str) -> list[dict]:
    """
    Returns a list of dicts, one per row, with keys matching Lead's field
    names (first_name, last_name, job_title, company, phone_number, email,
    website, address, city, state). Missing columns simply come through as
    empty strings.
    """
    if file_path.lower().endswith(".csv"):
        df = pd.read_csv(file_path, dtype=str, keep_default_na=False)
    elif file_path.lower().endswith((".xlsx", ".xls")):
        df = pd.read_excel(file_path, dtype=str)
        df = df.fillna("")
    else:
        raise LeadFileParseError("Unsupported file type — please upload a .csv or .xlsx file.")

    if len(df) > MAX_ROWS:
        raise LeadFileParseError(f"File has {len(df)} rows — the current limit is {MAX_ROWS} per upload.")

    column_map = _build_column_map(df.columns)
    if "email" not in column_map and "phone_number" not in column_map:
        raise LeadFileParseError(
            "Couldn't find an email or phone number column. "
            "Include at least one of: email, phone_number."
        )

    rows = []
    for _, row in df.iterrows():
        parsed = {}
        for field, source_column in column_map.items():
            parsed[field] = str(row.get(source_column, "")).strip()
        rows.append(parsed)
    return rows