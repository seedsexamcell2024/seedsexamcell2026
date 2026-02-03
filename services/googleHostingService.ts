
/**
 * SEEDS UNIFIED LEDGER PROXY v300.0
 * MISSION: SINGLE-SHEET PERSISTENCE (MASTER_VAULT)
 * AUTHOR: MR. A. RASHEED
 */

export const generateGoogleDeploymentScript = (schoolName: string): string => {
  return `
/**
 * SEEDS INSTITUTIONAL CORE ENGINE v300.0 (Unified Ledger)
 * Optimized for: ${schoolName}
 */

const SHEET_NAME = "MASTER_VAULT";
const HEADERS = ["id", "storeType", "yearId", "termId", "timestamp", "jsonData"];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🛡️ SEEDS AUTOMATION')
    .addItem('Initialize Master Vault', 'setupDatabase')
    .addToUi();
}

function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, HEADERS.length)
         .setValues([HEADERS])
         .setBackground("#000000")
         .setFontColor("white")
         .setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
}

function doGet(e) {
  if (!e || !e.parameter) return ContentService.createTextOutput("System Idle").setMimeType(ContentService.MimeType.TEXT);
  const params = e.parameter;
  
  try {
    if (params.test) return ContentService.createTextOutput(JSON.stringify({status: "READY"})).setMimeType(ContentService.MimeType.JSON);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) return ContentService.createTextOutput(JSON.stringify({status: "SUCCESS", data: []})).setMimeType(ContentService.MimeType.JSON);
    
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return ContentService.createTextOutput(JSON.stringify({status: "SUCCESS", data: []})).setMimeType(ContentService.MimeType.JSON);
    
    const headers = values[0];
    const data = values.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });

    return ContentService.createTextOutput(JSON.stringify({status: "SUCCESS", data: data})).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({status: "ERROR", msg: err.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const storeType = payload.store.toUpperCase();
    const incomingData = payload.data;
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      setupDatabase();
      sheet = ss.getSheetByName(SHEET_NAME);
    }

    // Load current data
    const range = sheet.getDataRange();
    const values = range.getValues();
    const headers = values[0];
    
    // Filter out existing data of THIS type to perform a "Clean Replace" for this store
    let otherData = values.slice(1).filter(row => row[1] !== storeType);
    
    // Prepare new rows
    const newRows = incomingData.map(item => {
      return [
        item.id || "",
        storeType,
        payload.year || "",
        payload.term || "",
        new Date().toISOString(),
        JSON.stringify(item)
      ];
    });

    const finalRows = [...otherData, ...newRows];
    
    // Write back
    sheet.clear();
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
         .setBackground("#000000").setFontColor("white").setFontWeight("bold");
    if (finalRows.length > 0) {
      sheet.getRange(2, 1, finalRows.length, HEADERS.length).setValues(finalRows);
    }

    return ContentService.createTextOutput(JSON.stringify({status: "SUCCESS"})).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({status: "ERROR", msg: err.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}
`;
};
