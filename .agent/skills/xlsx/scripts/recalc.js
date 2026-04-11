#!/usr/bin/env node
/**
 * Excel Formula Recalculation Script
 * Recalculates all formulas in an Excel file using LibreOffice
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const { getSofficeEnv, getSofficeBin } = require('./office/soffice');
const XLSX = require('xlsx');

const MACRO_DIR_MACOS =
  '~/Library/Application Support/LibreOffice/4/user/basic/Standard';
const MACRO_DIR_LINUX = '~/.config/libreoffice/4/user/basic/Standard';
const MACRO_DIR_WINDOWS = '~/AppData/Roaming/LibreOffice/4/user/basic/Standard';
const MACRO_FILENAME = 'Module1.xba';

const RECALCULATE_MACRO = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE script:module PUBLIC "-//OpenOffice.org//DTD OfficeDocument 1.0//EN" "module.dtd">
<script:module xmlns:script="http://openoffice.org/2000/script" script:name="Module1" script:language="StarBasic">
    Sub RecalculateAndSave()
      On Error Resume Next
      ThisComponent.calculateAll()
      ThisComponent.store()
      ThisComponent.close(True)
      StarDesktop.terminate()
    End Sub
</script:module>`;

function expandHomeDir(filepath) {
  if (filepath[0] === '~') {
    return path.join(os.homedir(), filepath.slice(1));
  }
  return filepath;
}

function hasGTimeout() {
  try {
    const result = spawnSync('gtimeout', ['--version'], { timeout: 1000 });
    return result.status === 0;
  } catch (e) {
    return false;
  }
}

function setupLibreOfficeMacro() {
  const system = os.platform();
  let macroDir = '';
  if (system === 'darwin') {
    macroDir = expandHomeDir(MACRO_DIR_MACOS);
  } else if (system === 'win32') {
    macroDir = expandHomeDir(MACRO_DIR_WINDOWS);
  } else {
    macroDir = expandHomeDir(MACRO_DIR_LINUX);
  }
  const macroFile = path.join(macroDir, MACRO_FILENAME);

  if (fs.existsSync(macroFile)) {
    const content = fs.readFileSync(macroFile, 'utf8');
    if (content.includes('RecalculateAndSave')) {
      return true;
    }
  }

  if (!fs.existsSync(macroDir)) {
    spawnSync(getSofficeBin(), ['--headless', '--terminate_after_init'], {
      env: getSofficeEnv(),
      timeout: 10000,
    });
    fs.mkdirSync(macroDir, { recursive: true });
  }

  try {
    fs.writeFileSync(macroFile, RECALCULATE_MACRO);
    return true;
  } catch (e) {
    return false;
  }
}

function recalc(filename, timeoutSec = 30) {
  if (!fs.existsSync(filename)) {
    return { error: `File ${filename} does not exist` };
  }

  const absPath = path.resolve(filename);

  if (!setupLibreOfficeMacro()) {
    return { error: 'Failed to setup LibreOffice macro' };
  }

  let cmdBase = getSofficeBin();
  let args = [
    '--headless',
    '--norestore',
    'vnd.sun.star.script:Standard.Module1.RecalculateAndSave?language=Basic&location=application',
    absPath,
  ];

  let finalCmd = cmdBase;
  let finalArgs = args;

  if (os.platform() === 'linux') {
    finalCmd = 'timeout';
    finalArgs = [timeoutSec.toString(), cmdBase, ...args];
  } else if (os.platform() === 'darwin' && hasGTimeout()) {
    finalCmd = 'gtimeout';
    finalArgs = [timeoutSec.toString(), cmdBase, ...args];
  }

  try {
    const result = spawnSync(finalCmd, finalArgs, {
      env: getSofficeEnv(),
      timeout: (timeoutSec + 5) * 1000,
      encoding: 'utf8',
    });

    if (result.error && result.error.code === 'ETIMEDOUT') {
      return { error: `Recalculation timed out after ${timeoutSec} seconds` };
    }

    if (result.status !== 0 && result.status !== 124) {
      const errorMsg = result.stderr || 'Unknown error during recalculation';
      if (
        errorMsg.includes('Module1') ||
        !errorMsg.includes('RecalculateAndSave')
      ) {
        return { error: 'LibreOffice macro not configured properly' };
      }
      return { error: errorMsg };
    }
  } catch (e) {
    if (e.code === 'ETIMEDOUT') {
      return { error: `Recalculation timed out after ${timeoutSec} seconds` };
    }
  }

  try {
    const wb = XLSX.readFile(filename, {
      cellFormula: true,
      cellNF: false,
      cellText: true,
    });

    const excelErrors = [
      '#VALUE!',
      '#DIV/0!',
      '#REF!',
      '#NAME?',
      '#NULL!',
      '#NUM!',
      '#N/A',
    ];
    const errorDetails = {};
    excelErrors.forEach(err => (errorDetails[err] = []));
    let totalErrors = 0;
    let formulaCount = 0;

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      if (!ws) continue;

      for (const cellAddress in ws) {
        if (cellAddress[0] === '!') continue;
        const cell = ws[cellAddress];
        if (!cell) continue;

        if (cell.f) {
          formulaCount++;
        }

        let val = '';
        if (cell.t === 'e') {
          const errMap = {
            0x00: '#NULL!',
            0x07: '#DIV/0!',
            0x0f: '#VALUE!',
            0x17: '#REF!',
            0x1d: '#NAME?',
            0x24: '#NUM!',
            0x2a: '#N/A',
          };
          val = errMap[cell.v] || String(cell.w || cell.v || '');

          if (errorDetails[val]) {
            errorDetails[val].push(`${sheetName}!${cellAddress}`);
            totalErrors++;
            continue;
          }
        } else {
          val = String(cell.w || cell.v || '');
        }

        for (const err of excelErrors) {
          if (val.includes(err)) {
            errorDetails[err].push(`${sheetName}!${cellAddress}`);
            totalErrors++;
            break;
          }
        }
      }
    }

    const resultObj = {
      status: totalErrors === 0 ? 'success' : 'errors_found',
      total_errors: totalErrors,
      error_summary: {},
    };

    for (const errType of excelErrors) {
      const spaces = errorDetails[errType];
      if (spaces.length > 0) {
        resultObj.error_summary[errType] = {
          count: spaces.length,
          locations: spaces.slice(0, 20),
        };
      }
    }

    resultObj.total_formulas = formulaCount;
    return resultObj;
  } catch (e) {
    return { error: String(e) };
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log('Usage: node recalc.js <excel_file> [timeout_seconds]');
    console.log(
      '\nRecalculates all formulas in an Excel file using LibreOffice',
    );
    console.log('\nReturns JSON with error details:');
    console.log("  - status: 'success' or 'errors_found'");
    console.log('  - total_errors: Total number of Excel errors found');
    console.log('  - total_formulas: Number of formulas in the file');
    console.log('  - error_summary: Breakdown by error type with locations');
    console.log('    - #VALUE!, #DIV/0!, #REF!, #NAME?, #NULL!, #NUM!, #N/A');
    process.exit(1);
  }

  const filename = args[0];
  const timeout = args.length > 1 ? parseInt(args[1], 10) : 30;

  const result = recalc(filename, timeout);
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { recalc };
