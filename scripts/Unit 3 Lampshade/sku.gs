/**
 * DISABLED 2026-08-14 — THIS FUNCTION DESTROYED LIVE DATA.
 *
 * What it did: it scanned Sheet1, and for any SKU appearing more than once it
 * BLANKED every occurrence after the first, then wrote that back over Sheet1:
 *
 *     if (seen.has(sku)) { data[i][skuIndex] = ''; }     // <-- permanent
 *     sheet.getRange(1, 1, ...).setValues(data);
 *
 * That is exactly the reported fault: "if the same SKU appears twice only the
 * first shows; if it appears six times only one shows". Measured on the live
 * Unit 3 Lampshade Sheet1: 60 of 169 rows had their SKU blanked, and ZERO SKUs
 * remained duplicated - the signature of a full pass of this function.
 *
 * It is not called by mergeAndCleanSheets() or by any menu item, so it can only
 * have been run by hand from the Apps Script editor. The same function exists in
 * every other station but has never been run there, which is why only Unit 3
 * Lampshade is affected.
 *
 * It now refuses to run. Duplicate SKUs are NORMAL and REQUIRED: the same product
 * legitimately appears on many different customer orders.
 *
 * The blanked SKUs cannot be restored from code. Recovery was measured against
 * the live sheet: matching on Title recovers only 29 of 60 safely - 27 have no
 * other row to match against, and 4 are combo listings whose Title maps to
 * several different SKUs. Guessing there would write the WRONG SKU onto a
 * customer's order, which is worse than a blank. Re-import Sheet1 from the order
 * source instead.
 */
function blankDuplicateSKUsInSheet1() {
  var msg = "blankDuplicateSKUsInSheet1() is disabled.\n\n" +
            "It permanently blanks duplicate SKUs in Sheet1. Duplicate SKUs are " +
            "normal - the same product appears on many orders.\n\n" +
            "If SKUs are missing from Sheet1, re-import Sheet1 from the order source.";
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { /* no UI when run headless */ }
  return;
}


function addProductNamesFromSKU() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet1 = ss.getSheetByName("Sheet1");
  // Get "names" sheet from another Google Sheet
  const namesSheet = SpreadsheetApp
    .openById("16rx5Dz-YYp-GTvRfytjq9e4p6AHw3qYh8Tm9rOPkS6M")
    .getSheetByName("names");

  if (!sheet1 || !namesSheet) {
    Logger.log("One or both sheets not found.");
    return;
  }

  const sheet1Data = sheet1.getDataRange().getValues();
  const namesData = namesSheet.getDataRange().getValues();

  if (sheet1Data.length < 2 || namesData.length < 2) {
    Logger.log("Not enough data.");
    return;
  }

  const sheet1Headers = sheet1Data[0];
  const comboSkuIndex = sheet1Headers.indexOf("Combo SKU");
  let productNameIndex = sheet1Headers.indexOf("Product Name");

  // Add "Product Name" column if not exists
  if (productNameIndex === -1) {
    productNameIndex = sheet1Headers.length;
    sheet1.getRange(1, productNameIndex + 1).setValue("Product Name");
  }

  // Build SKU -> Name map from names sheet
  const skuToName = {};
  for (let i = 1; i < namesData.length; i++) {
    const sku = namesData[i][0];
    const name = namesData[i][1];
    if (sku) skuToName[sku] = name;
  }

  // Populate "Product Name" column in Sheet1
  const updates = [];
  for (let i = 1; i < sheet1Data.length; i++) {
    const row = sheet1Data[i];
    const comboSku = row[comboSkuIndex];
    const productName = skuToName[comboSku] || '';
    row[productNameIndex] = productName;
    updates.push(row);
  }

  // Update Sheet1 with new values
  sheet1.getRange(2, 1, updates.length, sheet1Headers.length + 1).setValues(updates);
  Logger.log("Product names added to Sheet1.");
}


function copySKUFromSheet1ToCleanedData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet1 = ss.getSheetByName("Sheet1");
  const cleanedData = ss.getSheetByName("Cleaned Data");

  if (!sheet1 || !cleanedData) {
    Logger.log("Sheet1 or Cleaned Data sheet not found.");
    return;
  }

  const sheet1Data = sheet1.getDataRange().getValues();
  const cleanedDataValues = cleanedData.getDataRange().getValues();

  const sheet1Headers = sheet1Data[0] || [];
  const cleanedHeaders = cleanedDataValues[0] || [];

  const sheet1SKUIndex = sheet1Headers.indexOf("SKU");
  if (sheet1SKUIndex === -1) {
    Logger.log("SKU column not found in Sheet1.");
    return;
  }

  // Add new header to Cleaned Data
  const newHeader = "Combo SKU";
  const cleanedLastCol = cleanedHeaders.length;
  cleanedData.getRange(1, cleanedLastCol + 1).setValue(newHeader);

  // Get SKUs from Sheet1 (excluding header)
  const skus = sheet1Data.length > 1 ? sheet1Data.slice(1).map(row => [row[sheet1SKUIndex]]) : [];

  const cleanedDataRows = Math.max(cleanedDataValues.length - 1, 0);
  const rowsToWrite = Math.min(skus.length, cleanedDataRows);

  if (rowsToWrite === 0) {
    Logger.log("No SKU data to write (Sheet1 may be empty or Cleaned Data has no entries).");
    if (cleanedDataRows > 0) {
      cleanedData.getRange(2, cleanedLastCol + 1, cleanedDataRows, 1).setValues(
        Array(cleanedDataRows).fill([""])
      );
      Logger.log(`Filled ${cleanedDataRows} empty SKU values in Cleaned Data.`);
    }
    return;
  }

  // Write SKUs and fill remaining rows with empty strings
  cleanedData.getRange(2, cleanedLastCol + 1, rowsToWrite, 1)
             .setValues(skus.slice(0, rowsToWrite));
  if (cleanedDataRows > rowsToWrite) {
    cleanedData.getRange(2 + rowsToWrite, cleanedLastCol + 1, cleanedDataRows - rowsToWrite, 1)
               .setValues(Array(cleanedDataRows - rowsToWrite).fill([""]));
  }

  Logger.log(`Copied ${rowsToWrite} SKU values from Sheet1 to Cleaned Data.`);
}
