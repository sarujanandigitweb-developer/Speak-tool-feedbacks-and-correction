function blankDuplicateSKUsInSheet1() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Sheet1");
  if (!sheet) {
    Logger.log("Sheet1 not found.");
    return;
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return;

  const headers = data[0];
  const skuIndex = headers.indexOf("SKU");

  if (skuIndex === -1) {
    Logger.log("SKU column not found.");
    return;
  }

  const skuCount = {};
  
  // First pass: count all SKUs
  for (let i = 1; i < data.length; i++) {
    const sku = data[i][skuIndex];
    if (!sku) continue;
    skuCount[sku] = (skuCount[sku] || 0) + 1;
  }

  const seen = new Set();

  // Second pass: blank duplicates
  for (let i = 1; i < data.length; i++) {
    const sku = data[i][skuIndex];
    if (!sku || skuCount[sku] < 2) continue;

    if (seen.has(sku)) {
      data[i][skuIndex] = '';  // Blank duplicate
    } else {
      seen.add(sku);  // First appearance — keep
    }
  }

  sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
  Logger.log("Duplicate SKUs (SKU column only) blanked, first occurrence kept.");
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
