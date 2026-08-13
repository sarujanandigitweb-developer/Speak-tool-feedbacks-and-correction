function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('🗣 Speak Tool')
    .addItem('Speak All Rows', 'readRowAndSpeak')
    .addItem('Run Clean and Merge', 'mergeAndCleanSheets')
    .addToUi();
}

function mergeAndCleanSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet1 = ss.getSheetByName("Sheet1");
  // Get "names" sheet from another Google Sheet
  const namesSheet = SpreadsheetApp
    .openById("16rx5Dz-YYp-GTvRfytjq9e4p6AHw3qYh8Tm9rOPkS6M")
    .getSheetByName("names");

  if (!sheet1 || !namesSheet) {
    Logger.log("Sheet1 or names sheet not found.");
    return;
  }

  const existingSheet = ss.getSheetByName("Cleaned Data");
  if (existingSheet) ss.deleteSheet(existingSheet);

  const cleanedSheet = ss.insertSheet("Cleaned Data");

  const sheet1Data = sheet1.getDataRange().getValues();
  const namesData = namesSheet.getDataRange().getValues();

  const skuToName = {};
  for (let i = 1; i < namesData.length; i++) {
    const sku = namesData[i][0];
    const name = namesData[i][1];
    skuToName[sku] = name;
  }

  const headers = sheet1Data[0];
  const comboSkuIndex = headers.indexOf("Combo SKU");
  const skuIndex = headers.indexOf("SKU");
  const quantityIndex = headers.indexOf("Quantity");
  const comboQuantityIndex = headers.indexOf("Combo Quantity");
  const addressIndex = headers.indexOf("Address");
  const sellingPlatformIndex = headers.indexOf("Selling Platform");
  const instructionQRIndex = headers.indexOf("Instruction QR");
  const imageUrlsIndex = headers.indexOf("Image URLs");
  const titleIndex = headers.indexOf("Title");
  const priceIndex = headers.indexOf("Price");
  const customerInfoIndex = headers.indexOf("Customer Info");
  const statusIndex = headers.indexOf("Status");
  const mergeOrderIndex = headers.indexOf("Merge Order");
  const componentIndex = headers.indexOf("Component");
  const SendOrderInstructionIndex = headers.indexOf("Send Order Instruction");

  if (skuIndex === -1) throw new Error("SKU column not found in Sheet1.");

  const outputHeaders = ["SKU", "Name", "Quantity", "Post Code", "Selling Platform", "Instruction QR", "Image URLs", "Merge Order", "Component"];
  if (titleIndex !== -1) outputHeaders.push("Title");
  if (priceIndex !== -1) outputHeaders.push("Price");
  if (customerInfoIndex !== -1) outputHeaders.push("Customer Info");
  outputHeaders.push("Combo SKU");
  if (statusIndex !== -1) outputHeaders.push("Status");
  if (SendOrderInstructionIndex !== -1) outputHeaders.push("Send Order Instruction");
 // merged SKU
  mergeAdjacentRowsAndRepeat();
  const output = [outputHeaders];

  let j = 1;
  while (j < sheet1Data.length) {
    const row = sheet1Data[j];
    const mergeOrderVal = (mergeOrderIndex !== -1) ? (row[mergeOrderIndex] || "").toString().trim() : "";

    if (!mergeOrderVal) {
      processRow(j, "");
      j++;
      continue;
    }

    let groupRows = [];
    let k = j;
    while (k < sheet1Data.length &&
           (sheet1Data[k][mergeOrderIndex] || "").toString().trim() === mergeOrderVal) {
      const compRawInner = (componentIndex !== -1) ? (sheet1Data[k][componentIndex] || "").toString().trim() : "";
      const compCountInner = compRawInner ? compRawInner.split(',').filter(c => c.trim() !== "").length : 0;
      groupRows.push({ index: k, componentCount: compCountInner });
      k++;
    }

    const labelCount = groupRows.filter(r => r.componentCount <= 1).length;
    let mergeOrderLabelCounter = 1;
    for (const r of groupRows) {
      if (r.componentCount <= 1) {
        const label = mergeOrderLabelCounter === 1
          ? `merge order total: ${labelCount} : merge order: 1`
          : `merge order : ${mergeOrderLabelCounter}`;
        processRow(r.index, label);
        mergeOrderLabelCounter++;
      } else {
        processRow(r.index, "");
      }
    }

    j = k;
  }

  function processRow(rowIndex, mergeOrderLabel) {
    const row = sheet1Data[rowIndex];

    let rawSku = (row[skuIndex]) ? row[skuIndex] : ((comboSkuIndex !== -1 && row[comboSkuIndex]) ? row[comboSkuIndex] : "");
    rawSku = (rawSku || "").toString().trim().toUpperCase();

    const comboSku = (comboSkuIndex !== -1 && row[comboSkuIndex]) ? row[comboSkuIndex].toString().trim().toUpperCase() : "";
    let lookupSku = rawSku.endsWith("PK") ? rawSku.slice(0, -3) : rawSku;
    let name = skuToName[lookupSku] || "";

    let quantity = (comboQuantityIndex !== -1 && row[comboQuantityIndex]) ? row[comboQuantityIndex] : row[quantityIndex];
    if (!name) quantity = '';

    if (rawSku.startsWith("CL") && quantity) {
      quantity = `${quantity} meter`;
    }

    const componentRaw = (componentIndex !== -1) ? row[componentIndex] : "";
    let componentLabel = "";
    if (mergeOrderLabel || componentRaw) {
      const componentCount = componentRaw.split(',').filter(c => c.trim() !== "").length;
      if (componentCount > 0) {
        componentLabel = `Combo: ${componentCount}`;
      }
    }

    const mergedRow = [
      rawSku,
      name,
      quantity,
      row[addressIndex],
      row[sellingPlatformIndex],
      row[instructionQRIndex],
      row[imageUrlsIndex],
      mergeOrderLabel,
      componentLabel
    ];

    if (titleIndex !== -1) mergedRow.push(row[titleIndex]);
    if (priceIndex !== -1) mergedRow.push(row[priceIndex]);
    if (customerInfoIndex !== -1) mergedRow.push(row[customerInfoIndex]);
    mergedRow.push(comboSku);
    if (statusIndex !== -1) mergedRow.push(row[statusIndex]);
    if (SendOrderInstructionIndex !== -1) mergedRow.push(row[SendOrderInstructionIndex]);

    output.push(mergedRow);
  }

  cleanedSheet.getRange(1, 1, output.length, output[0].length).setValues(output);

  keepOnlyLastOccurrenceInD(cleanedSheet);
  keepOnlyLastOccurrenceInE(cleanedSheet);
  clearFIfDIsEmptyInSheet(cleanedSheet);
  removeRPR44WHAndTransferPostCode(cleanedSheet);
  addCombinedSKUSet();
}

function keepOnlyLastOccurrenceInD(sheet) {
  const valuesD = sheet.getRange(2, 4, sheet.getLastRow() - 1).getValues();
  for (let i = 1; i < valuesD.length; i++) {
    const current = valuesD[i][0];
    const previous = valuesD[i - 1][0];
    if (current && current === previous) {
      valuesD[i - 1][0] = '';
    }
  }
  sheet.getRange(2, 4, valuesD.length).setValues(valuesD);
}

function keepOnlyLastOccurrenceInE(sheet) {
  const valuesE = sheet.getRange(2, 5, sheet.getLastRow() - 1).getValues();
  for (let i = 1; i < valuesE.length; i++) {
    const current = valuesE[i][0];
    const previous = valuesE[i - 1][0];
    if (current && current === previous) {
      valuesE[i - 1][0] = '';
    }
  }
  sheet.getRange(2, 5, valuesE.length).setValues(valuesE);
}

function clearFIfDIsEmptyInSheet(sheet) {
  const numRows = sheet.getLastRow() - 1;
  const valuesD = sheet.getRange(2, 4, numRows).getValues();
  const valuesF = sheet.getRange(2, 6, numRows).getValues();
  for (let i = 0; i < numRows; i++) if (!valuesD[i][0]) valuesF[i][0] = '';
  sheet.getRange(2, 6, numRows).setValues(valuesF);
}

function addCombinedSKUSet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Cleaned Data");
  var data = sheet.getDataRange().getValues();

  var headers = data[0];
  var componentIndex = headers.indexOf("Component");
  var skuIndex = headers.indexOf("SKU");
  var comboSKUIndex = headers.indexOf("Combo SKU");
  var mergeOrderIndex = headers.indexOf("Merge Order");

  if (skuIndex === -1 || comboSKUIndex === -1) {
    throw new Error("Could not find 'SKU' or 'Combo SKU' column.");
  }

  // --- Merge Order sets ---
  if (mergeOrderIndex !== -1) {
    var mergeGroups = {};
    for (var i = 1; i < data.length; i++) {
      var mergeVal = (data[i][mergeOrderIndex] || "").toString().trim();
      if (!mergeVal) continue;
      if (!mergeGroups[mergeVal]) mergeGroups[mergeVal] = [];
      if (data[i][skuIndex]) mergeGroups[mergeVal].push(data[i][skuIndex]);
    }
    for (var i = 1; i < data.length; i++) {
      var mergeVal = (data[i][mergeOrderIndex] || "").toString().trim();
      if (mergeVal && mergeGroups[mergeVal]) {
        data[i][comboSKUIndex] = mergeGroups[mergeVal].join("+");
      }
    }
  }

  // --- Component sets ---
  if (componentIndex !== -1) {
    var currentSetRows = [];
    var currentSetSKUs = [];
    var inSet = false;

    function flushSet() {
      if (currentSetRows.length > 0) {
        var joinedSKU = currentSetSKUs.join("+");
        currentSetRows.forEach(function(rowIndex) {
          data[rowIndex][comboSKUIndex] = joinedSKU;
        });
      }
      currentSetRows = [];
      currentSetSKUs = [];
      inSet = false;
    }

    for (var i = 1; i < data.length; i++) {
      var comp = data[i][componentIndex];
      if (comp && typeof comp === "string" && comp.trim() === "Combo: 1") {
        flushSet();
        inSet = true;
        currentSetRows.push(i);
        if (data[i][skuIndex]) currentSetSKUs.push(data[i][skuIndex]);
      } 
      else if (inSet && comp && typeof comp === "string" && /^Combo:\s*\d+/.test(comp)) {
        currentSetRows.push(i);
        if (data[i][skuIndex]) currentSetSKUs.push(data[i][skuIndex]);
      } 
      else {
        flushSet();
      }
    }
    flushSet();
  }

  sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
}

function removeRPR44WHAndTransferPostCode(sheet) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const skuIndex = headers.indexOf("SKU");
  const addressIndex = headers.indexOf("Post Code");
  const componentIndex = headers.indexOf("Component");

  const cleaned = [headers];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const sku = (row[skuIndex] || "").toString().trim().toUpperCase();
    const component = (componentIndex !== -1) ? (row[componentIndex] || "").toString().trim() : "";

    if (sku === "RPR44WH" && component) { // Only process RPR44WH with non-empty Component
      const postCode = row[addressIndex];
      for (let k = cleaned.length - 1; k >= 1; k--) {
        if (!cleaned[k][addressIndex]) {
          cleaned[k][addressIndex] = postCode;
          break;
        }
      }
      continue; // Skip RPR44WH row
    }

    cleaned.push(row); // Include row if not RPR44WH or if Component is empty
  }

  sheet.clearContents();
  sheet.getRange(1, 1, cleaned.length, cleaned[0].length).setValues(cleaned);
}
