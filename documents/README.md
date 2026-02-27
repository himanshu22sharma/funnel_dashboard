# Documents / Data Folder

This folder holds all sample, dummy, and production data files used by the Lending Dashboard application.

---

## Funnel Data

### MTD & LMTD overall funnel

- **MTD Funnel** = Month-to-Date overall funnel (aggregate across all lenders).
- **LMTD Funnel** = Last Month Till Date overall funnel (aggregate across all lenders).

Both show the same stages (e.g. Workable leads → Bureau pull success → … → Disbursed) with **Flow1 (Auto)** and **Flow2 (Manual)**. For each flow: **Leads** and **Conv%** (conversion % from previous stage). These views appear in the dashboard as the main funnel tables.

### Lender-level MTD & LMTD funnel

Lender-level funnel data is kept in this folder:

| File | Description |
|------|-------------|
| `lender-mtd-sample.csv` | Lender-wise funnel for **MTD** (one row per stage, columns per lender/flow) |
| `lender-lmtd-sample.csv` | Lender-wise funnel for **LMTD** (same structure) |

**Format (wide):** Each file has `major_index`, `major_stage`, then for each lender (e.g. FULLERTON, KSF, MFL, NACL, PIRAMAL, PYFL, SHRIRAM) four columns:  
`{Lender} Fresh Flow1(Auto) Leads`, `{Lender} Fresh Flow1(Auto) Conv. %`, `{Lender} Fresh Flow2(Manual) Leads`, `{Lender} Fresh Flow2(Manual) Conv. %`.

Stages in the samples run from 6 (Child_Lead_Created) through 15 (Disbursed). The dashboard loads funnel data from `dashboard/public/data/` (see **Dashboard data sources** below); these CSVs are the source/reference for lender-level MTD/LMTD funnel.

---

## Dashboard data sources

The app reads CSVs from **`dashboard/public/data/`**, not directly from this folder:

- **Overall funnel:** `Complete_Funnel_with_Stages.csv`
- **Lender-level funnel:** `Lender_Level_Funnel_With_Stages.csv` (long format: one row per lender/stage/flow)
- **Disbursal summary:** `Lender_Level_Disb_Summary.csv`
- **L2 analysis (sub-stages):** `L2_Analysis.csv`

To use the lender-level samples here, either copy/convert them into `dashboard/public/data/` or run a build step that generates the expected files from `documents/lender-mtd-sample.csv` and `documents/lender-lmtd-sample.csv`.

---

## Upload guidelines

- Place all CSV, Excel, JSON, or any data files here.
- Use clear naming conventions (e.g. `funnel_data_sample.csv`, `lender_wise_disbursal.xlsx`).
- Subfolder structure will be organized as the project evolves.

## Other data categories (expected)

- Whitelist Data: Whitelisted merchants by lender, program_type
- Disbursal Data: Loan disbursal records
- Campaign Data: Marketing campaign performance
- Lender Config: Lender metadata, stage mappings
- Any other data as needed
