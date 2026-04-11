---
name: xlsx
description: "Use this skill any time a spreadsheet file is the primary input or output. This means any task where the user wants to: open, read, edit, or fix an existing .xlsx, .xlsm, .csv, or .tsv file (e.g., adding columns, computing formulas, formatting, charting, cleaning messy data); create a new spreadsheet from scratch or from other data sources; or convert between tabular file formats. Trigger especially when the user references a spreadsheet file by name or path — even casually (like \"the xlsx in my downloads\") — and wants something done to it or produced from it. Also trigger for cleaning or restructuring messy tabular data files (malformed rows, misplaced headers, junk data) into proper spreadsheets. The deliverable must be a spreadsheet file. Do NOT trigger when the primary deliverable is a Word document, HTML report, standalone Python script, database pipeline, or Google Sheets API integration, even if tabular data is involved."
license: Proprietary. LICENSE.txt has complete terms
---

### Professional Font
- Use a consistent, professional font (e.g., Arial, Times New Roman) for all deliverables unless otherwise instructed by the user

### Zero Formula Errors
- Every Excel model MUST be delivered with ZERO formula errors (#REF!, #DIV/0!, #VALUE!, #N/A, #NAME?)

### Preserve Existing Templates (when updating templates)
- Study and EXACTLY match existing format, style, and conventions when modifying files
- Never impose standardized formatting on files with established patterns
- Existing template conventions ALWAYS override these guidelines

### Color Coding Standards
Unless otherwise stated by the user or existing template

#### Industry-Standard Color Conventions
- **Blue text (RGB: 0,0,255)**: Hardcoded inputs, and numbers users will change for scenarios
- **Black text (RGB: 0,0,0)**: ALL formulas and calculations
- **Green text (RGB: 0,128,0)**: Links pulling from other worksheets within same workbook
- **Red text (RGB: 255,0,0)**: External links to other files
- **Yellow background (RGB: 255,255,0)**: Key assumptions needing attention or cells that need to be updated

### Number Formatting Standards
#### Required Format Rules
- **Years**: Format as text strings (e.g., "2024" not "2,024")
- **Currency**: Use $#,##0 format; ALWAYS specify units in headers ("Revenue ($mm)")
- **Zeros**: Use number formatting to make all zeros "-", including percentages (e.g., "$#,##0;($#,##0);-")
- **Percentages**: Default to 0.0% format (one decimal)
- **Multiples**: Format as 0.0x for valuation multiples (EV/EBITDA, P/E)
- **Negative numbers**: Use parentheses (123) not minus -123

### Formula Construction Rules
#### Assumptions Placement
- Place ALL assumptions (growth rates, margins, multiples, etc.) in separate assumption cells
- Use cell references instead of hardcoded values in formulas
- Example: Use =B5*(1+$B$6) instead of =B5*1.05

#### Formula Error Prevention
- Verify all cell references are correct
- Check for off-by-one errors in ranges
- Ensure consistent formulas across all projection periods
- Test with edge cases (zero values, negative numbers)
- Verify no unintended circular references

#### Documentation Requirements for Hardcodes
- Comment or in cells beside (if end of table). Format: "Source: [System/Document], [Date], [Specific Reference], [URL if applicable]"
- Examples:
  - "Source: Company 10-K, FY2024, Page 45, Revenue Note, [SEC EDGAR URL]"
  - "Source: Company 10-Q, Q2 2025, Exhibit 99.1, [SEC EDGAR URL]"
  - "Source: Bloomberg Terminal, 8/15/2025, AAPL US Equity"
  - "Source: FactSet, 8/20/2025, Consensus Estimates Screen"

## Overview
A user may ask you to create, edit, or analyze the contents of an .xlsx file. You have different tools and workflows available for different tasks.

## Important Requirements
**LibreOffice Required for Formula Recalculation**: You can assume LibreOffice is installed for recalculating formula values using the `scripts/recalc.js` script. The script automatically configures LibreOffice on first run, including in sandboxed environments where Unix sockets are restricted (handled by `scripts/office/soffice.js`)

For data analysis, visualization, and basic operations, use **xlsx** (SheetJS) which provides powerful data manipulation capabilities:

```javascript
const XLSX = require('xlsx');

// Read Excel
const wb = XLSX.readFile('file.xlsx');
const sheet = wb.Sheets[wb.SheetNames[0]]; // Default: first sheet

// Analyze
const data = XLSX.utils.sheet_to_json(sheet);
console.log(data.slice(0, 5)); // Preview data

// Write Excel
const newWb = XLSX.utils.book_new();
const newWs = XLSX.utils.json_to_sheet(data);
XLSX.utils.book_append_sheet(newWb, newWs, "Sheet1");
XLSX.writeFile(newWb, 'output.xlsx');
```

**Always use Excel formulas instead of calculating values in NodeJS and hardcoding them.** This ensures the spreadsheet remains dynamic and updateable.

### ❌ WRONG - Hardcoding Calculated Values
```javascript
// Bad: Calculating in Node and hardcoding result
const total = data.reduce((sum, row) => sum + row.Sales, 0);
XLSX.utils.sheet_add_aoa(ws, [[total]], {origin: "B10"}); // Hardcodes 5000

// Bad: Computing growth rate in Node
const growth = (data[data.length - 1].Revenue - data[0].Revenue) / data[0].Revenue;
XLSX.utils.sheet_add_aoa(ws, [[growth]], {origin: "C5"}); // Hardcodes 0.15
```

### ✅ CORRECT - Using Excel Formulas
```javascript
// Good: Let Excel calculate the sum
XLSX.utils.sheet_add_aoa(ws, [[ { t: 'n', f: 'SUM(B2:B9)' } ]], {origin: "B10"});

// Good: Growth rate as Excel formula
XLSX.utils.sheet_add_aoa(ws, [[ { t: 'n', f: '(C4-C2)/C2' } ]], {origin: "C5"});

// Good: Average using Excel function
XLSX.utils.sheet_add_aoa(ws, [[ { t: 'n', f: 'AVERAGE(D2:D19)' } ]], {origin: "D20"});
```

This applies to ALL calculations - totals, percentages, ratios, differences, etc. The spreadsheet should be able to recalculate when source data changes.

1. **Choose tool**: xlsx for Node
2. **Create/Load**: Create new workbook or load existing file
3. **Modify**: Add/edit data, formulas, and formatting
4. **Save**: Write to file
5. **Recalculate formulas (MANDATORY IF USING FORMULAS)**: Use the scripts/recalc.js script
   ```bash
   node scripts/recalc.js output.xlsx
   ```
6. **Verify and fix any errors**: 
   - The script returns JSON with error details
   - If `status` is `errors_found`, check `error_summary` for specific error types and locations
   - Fix the identified errors and recalculate again
   - Common errors to fix:
     - `#REF!`: Invalid cell references
     - `#DIV/0!`: Division by zero
     - `#VALUE!`: Wrong data type in formula
     - `#NAME?`: Unrecognized formula name

### Creating new Excel files
```javascript
// Using xlsx for formulas and data
const XLSX = require('xlsx');

const wb = XLSX.utils.book_new();
const wsData = [
  ['Hello', 'World'],
  ['Row', 'of', 'data']
];
const ws = XLSX.utils.aoa_to_sheet(wsData);

// Add formula
ws['B2'] = { t: 'n', f: 'SUM(A1:A10)' };

// Column width
ws['!cols'] = [ { wpx: 150 } ];

XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
XLSX.writeFile(wb, 'output.xlsx');
```

### Editing existing Excel files
```javascript
const XLSX = require('xlsx');

// Load existing file
const wb = XLSX.readFile('existing.xlsx');
let sheetName = wb.SheetNames[0];
let ws = wb.Sheets[sheetName];

// Modify cells
XLSX.utils.sheet_add_aoa(ws, [['New Value']], {origin: 'A1'});

// Add new sheet
const newSheet = XLSX.utils.aoa_to_sheet([['Data']]);
XLSX.utils.book_append_sheet(wb, newSheet, 'NewSheet');

XLSX.writeFile(wb, 'modified.xlsx');
```

## Recalculating formulas
Excel files created or modified by `xlsx` contain formulas as strings but not calculated values. Use the provided `scripts/recalc.js` script to recalculate formulas:

```bash
node scripts/recalc.js <excel_file> [timeout_seconds]
```

Example:
```bash
node scripts/recalc.js output.xlsx 30
```

The script:
- Automatically sets up LibreOffice macro on first run
- Recalculates all formulas in all sheets
- Scans ALL cells for Excel errors (#REF!, #DIV/0!, etc.)
- Returns JSON with detailed error locations and counts
- Works on both Linux and macOS

## Formula Verification Checklist
Quick checks to ensure formulas work correctly:

### Essential Verification
- [ ] **Test 2-3 sample references**: Verify they pull correct values before building full model
- [ ] **Column mapping**: Confirm Excel columns match
- [ ] **Row offset**: Remember Excel rows are 1-indexed (array row 5 = Excel row 6)

### Common Pitfalls
- [ ] **Null handling**: Check for null values
- [ ] **Far-right columns**: FY data often in columns 50+ 
- [ ] **Division by zero**: Check denominators before using `/` in formulas (#DIV/0!)
- [ ] **Wrong references**: Verify all cell references point to intended cells (#REF!)
- [ ] **Cross-sheet references**: Use correct format (Sheet1!A1) for linking sheets

### Formula Testing Strategy
- [ ] **Start small**: Test formulas on 2-3 cells before applying broadly
- [ ] **Verify dependencies**: Check all cells referenced in formulas exist
- [ ] **Test edge cases**: Include zero, negative, and very large values

### Interpreting scripts/recalc.js Output
The script returns JSON with error details:
```json
{
  "status": "success",           // or "errors_found"
  "total_errors": 0,              // Total error count
  "total_formulas": 42,           // Number of formulas in file
  "error_summary": {              // Only present if errors found
    "#REF!": {
      "count": 2,
      "locations": ["Sheet1!B5", "Sheet1!C10"]
    }
  }
}
```

### Library Selection
- **xlsx (SheetJS)**: Best for data analysis, bulk operations, formulas, and simple data export
- **exceljs** (if available): Best for complex formatting and Excel-specific features

### Working with xlsx (SheetJS)
- Cell indices are 0-based for arrays, but standard for references (A1)
- Use `cellFormula: true` when reading files to preserve formulas
- For large files: avoid `sheet_to_json` to prevent massive memory spikes, iterate using APIs instead
- Formulas are preserved but not evaluated - use scripts/recalc.js to update values

**IMPORTANT**: When generating NodeJS code for Excel operations:
- Write minimal, concise NodeJS code without unnecessary comments
- Avoid verbose variable names and redundant operations
- Avoid unnecessary console statements

**For Excel files themselves**:
- Add comments to cells with complex formulas or important assumptions
- Document data sources for hardcoded values
- Include notes for key calculations and model sections
