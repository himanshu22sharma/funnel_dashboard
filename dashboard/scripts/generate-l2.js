#!/usr/bin/env node
/**
 * Generates L2_Analysis.csv with realistic MTD/LMTD funnel numbers.
 * Run from dashboard/: node scripts/generate-l2.js
 */

const fs = require("fs");
const path = require("path");

const LENDERS = ["FULLERTON", "KSF", "MFL", "NACL", "PIRAMAL", "PYFL", "SHRIRAM"];
const STAGE_NAMES = {
  2: "Workable leads",
  3: "Bureau pull success",
  4: "BRE1 completed",
  5: "Marketplace Offer Selected",
  6: "Child_Lead_Created",
  7: "Selfie uploaded",
  8: "KYC completed",
  9: "BRE2 completed",
  10: "Disbursal acc verified",
  11: "Review submit",
  12: "Mandate done",
  13: "Application submitted by user",
  14: "Submit to LMS",
  15: "Disbursed",
};

// Stage 6 leads from lender-mtd (Flow1, Flow2) - used for proportions for stages 2-5
const MTD_STAGE6_F1 = [21917, 10729, 2091, 2898, 21044, 4697, 6822];
const MTD_STAGE6_F2 = [14377, 6609, 925, 1497, 7478, 3058, 3041];
const sum = (a) => a.reduce((s, x) => s + x, 0);
const propF1 = MTD_STAGE6_F1.map((v) => v / sum(MTD_STAGE6_F1));
const propF2 = MTD_STAGE6_F2.map((v) => v / sum(MTD_STAGE6_F2));

// Overall MTD totals (Fresh) - from screenshot
const MTD_F1 = [372664, 358494, 222588, 76598, 58471, 38142, 30554, 25183, 24837, 22952, 20940, 21048, 16362, 15176];
const MTD_F2 = [88385, 82972, 46729, 34794, 31345, 24674, 20210, 17999, 17685, 16591, 14615, 14798, 12581, 11951];
// Overall LMTD totals
const LMTD_F1 = [307079, 294044, 191670, 60083, 52878, 33819, 27049, 22221, 21992, 20437, 18548, 18697, 15156, 14243];
const LMTD_F2 = [79749, 74719, 43890, 33003, 31996, 24632, 20358, 18059, 17855, 16840, 14836, 15017, 13108, 12514];

// Lender-level stages 6-15 MTD (from lender-mtd-sample: row index 0-9)
const MTD_LEADS = {
  FULLERTON: { F1: [21917, 18024, 14975, 11108, 10984, 10119, 9235, 9215, 7004, 6718], F2: [14377, 12539, 10540, 8858, 8705, 8140, 7229, 7216, 6268, 6058] },
  KSF: { F1: [10729, 9594, 6281, 4487, 4345, 4083, 3661, 3635, 2853, 2728], F2: [6609, 5985, 4149, 3310, 3189, 3048, 2602, 2590, 2154, 2080] },
  MFL: { F1: [2091, 1901, 1471, 1004, 997, 969, 881, 835, 708, 425], F2: [925, 845, 608, 456, 450, 434, 374, 358, 325, 222] },
  NACL: { F1: [2898, 2437, 1855, 1314, 1280, 1167, 1071, 1062, 771, 733], F2: [1497, 1326, 1006, 801, 786, 729, 646, 642, 515, 490] },
  PIRAMAL: { F1: [21044, 6550, 3994, 2118, 2098, 1960, 1807, 1805, 1496, 1432], F2: [7478, 3540, 2207, 1465, 1446, 1361, 1229, 1228, 1104, 1071] },
  PYFL: { F1: [4697, 3640, 3469, 1863, 1838, 1695, 1495, 1695, 1150, 1102], F2: [3058, 2587, 2495, 1634, 1613, 1533, 1308, 1533, 1077, 1037] },
  SHRIRAM: { F1: [6822, 6189, 4294, 3444, 3409, 3071, 2900, 2897, 2383, 2038], F2: [3041, 2799, 1903, 1614, 1579, 1426, 1303, 1299, 1140, 993] },
};
// Lender-level stages 6-15 LMTD (from lender-lmtd-sample)
const LMTD_LEADS = {
  FULLERTON: { F1: [14562, 11802, 9758, 7393, 7301, 6670, 6048, 6042, 4670, 4483], F2: [10781, 9381, 7871, 6731, 6642, 6196, 5477, 5469, 4835, 4676] },
  KSF: { F1: [8398, 7555, 5105, 3978, 3920, 3713, 3309, 3289, 2903, 2748], F2: [6567, 6004, 4436, 3835, 3779, 3605, 3142, 3119, 2839, 2739] },
  MFL: { F1: [4460, 3963, 2810, 1781, 1766, 1687, 1528, 1448, 1287, 1075], F2: [2415, 2211, 1580, 1176, 1163, 1117, 960, 911, 851, 710] },
  NACL: { F1: [2364, 2062, 1592, 1114, 1091, 1015, 935, 922, 628, 615], F2: [1332, 1194, 904, 714, 700, 644, 577, 567, 430, 417] },
  PIRAMAL: { F1: [20877, 6923, 4456, 2595, 2569, 2386, 2204, 2201, 1914, 1834], F2: [9360, 4464, 2917, 2034, 2018, 1917, 1752, 1749, 1622, 1573] },
  PYFL: { F1: [4965, 4013, 3850, 2178, 2163, 1981, 1715, 1981, 1335, 1285], F2: [3461, 3015, 2903, 1942, 1922, 1800, 1533, 1800, 1274, 1228] },
  SHRIRAM: { F1: [6463, 5800, 3957, 3221, 3195, 2998, 2822, 2821, 2419, 2203], F2: [3085, 2818, 1943, 1662, 1644, 1572, 1406, 1405, 1257, 1171] },
};

function distribute(total, proportions) {
  const out = proportions.map((p) => Math.round(total * p));
  const diff = total - out.reduce((s, x) => s + x, 0);
  if (diff !== 0) out[0] += diff;
  return out;
}

const rows = [];
const stages = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

for (const period of ["1.MTD", "2.LMTD"]) {
  const isMtd = period === "1.MTD";
  const f1Totals = isMtd ? MTD_F1 : LMTD_F1;
  const f2Totals = isMtd ? MTD_F2 : LMTD_F2;

  for (let i = 0; i < stages.length; i++) {
    const idx = stages[i];
    const stageName = STAGE_NAMES[idx];
    const f1Total = f1Totals[i];
    const f2Total = f2Totals[i];

    if (idx >= 6) {
      for (let l = 0; l < LENDERS.length; l++) {
        const lender = LENDERS[l];
        const data = isMtd ? MTD_LEADS[lender] : LMTD_LEADS[lender];
        const leadF1 = data.F1[idx - 6];
        const leadF2 = data.F2[idx - 6];
        rows.push({ lender, month_start: period, product_type: "Fresh", isautoleadcreated: "Flow1(Auto)", major_index: idx, original_major_stage: stageName, sub_stage: "", Leads: leadF1, Stuck: "" });
        rows.push({ lender, month_start: period, product_type: "Fresh", isautoleadcreated: "Flow2(Manual)", major_index: idx, original_major_stage: stageName, sub_stage: "", Leads: leadF2, Stuck: "" });
      }
    } else {
      const f1ByLender = distribute(f1Total, propF1);
      const f2ByLender = distribute(f2Total, propF2);
      for (let l = 0; l < LENDERS.length; l++) {
        rows.push({ lender: LENDERS[l], month_start: period, product_type: "Fresh", isautoleadcreated: "Flow1(Auto)", major_index: idx, original_major_stage: stageName, sub_stage: "", Leads: f1ByLender[l], Stuck: "" });
        rows.push({ lender: LENDERS[l], month_start: period, product_type: "Fresh", isautoleadcreated: "Flow2(Manual)", major_index: idx, original_major_stage: stageName, sub_stage: "", Leads: f2ByLender[l], Stuck: "" });
      }
    }
  }
}

// Add a few sub_stage rows (8.1) for drill-down - proportional to KYC stage
for (const period of ["1.MTD", "2.LMTD"]) {
  const kycIdx = period === "1.MTD" ? 8 : 8;
  const pct = 0.08;
  for (const lender of LENDERS) {
    const r1 = rows.find((r) => r.lender === lender && r.month_start === period && r.major_index === 8 && r.isautoleadcreated === "Flow1(Auto)");
    const r2 = rows.find((r) => r.lender === lender && r.month_start === period && r.major_index === 8 && r.isautoleadcreated === "Flow2(Manual)");
    if (r1) rows.push({ lender, month_start: period, product_type: "Fresh", isautoleadcreated: "Flow1(Auto)", major_index: 8.1, original_major_stage: "KYC completed", sub_stage: "BRE2_FAILURE", Leads: Math.max(1, Math.round(r1.Leads * pct)), Stuck: "32.3" });
    if (r2) rows.push({ lender, month_start: period, product_type: "Fresh", isautoleadcreated: "Flow2(Manual)", major_index: 8.1, original_major_stage: "KYC completed", sub_stage: "BRE2_FAILURE", Leads: Math.max(1, Math.round(r2.Leads * pct)), Stuck: "28.5" });
  }
}

const header = "lender,month_start,product_type,isautoleadcreated,major_index,original_major_stage,sub_stage,Leads,Stuck%";
const lines = [header, ...rows.map((r) => [r.lender, r.month_start, r.product_type, r.isautoleadcreated, r.major_index, r.original_major_stage, r.sub_stage, r.Leads, r.Stuck].join(","))];
const outPath = path.join(__dirname, "../public/data/L2_Analysis.csv");
fs.writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
console.log("Wrote", outPath, "rows:", rows.length);
console.log("MTD Fresh Flow1 stage 2 sum:", rows.filter((r) => r.month_start === "1.MTD" && r.isautoleadcreated === "Flow1(Auto)" && r.major_index === 2).reduce((s, r) => s + r.Leads, 0));
console.log("LMTD Fresh Flow1 stage 2 sum:", rows.filter((r) => r.month_start === "2.LMTD" && r.isautoleadcreated === "Flow1(Auto)" && r.major_index === 2).reduce((s, r) => s + r.Leads, 0));
