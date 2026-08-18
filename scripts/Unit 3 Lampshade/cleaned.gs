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
  // Packing-priority fields. Appended at the END so the hardcoded column
  // positions used by keepOnlyLastOccurrenceInD/E (4, 5) and
  // clearFIfDIsEmptyInSheet (6) are unaffected.
  // SKU Combined used to survive only as RESIDUE: mergeAdjacentRowsAndRepeat()
  // writes 18 columns and `output` used to write 15, so column 18 was never
  // overwritten. Adding columns made `output` wider than 18 and destroyed it,
  // which broke the Speak Tool ("Column SKU Combined not found"). It is now
  // captured and written deliberately.
  outputHeaders.push("SKU Combined");
  outputHeaders.push("Product Type");
  outputHeaders.push("Colour");
  outputHeaders.push("Lampshade Collection");
  outputHeaders.push("Lampshade Collection Speech");
 // merged SKU
  mergeAdjacentRowsAndRepeat();

  // Read back the SKU Combined column it produced. Rows are 1:1 with Sheet1 in
  // the same order, so index i of this array belongs to sheet1Data[i + 1].
  var skuCombinedByRow = [];
  try {
    var mrgData = cleanedSheet.getDataRange().getValues();
    var mrgIdx  = mrgData.length ? mrgData[0].indexOf("SKU Combined") : -1;
    if (mrgIdx !== -1) {
      for (var mi = 1; mi < mrgData.length; mi++) skuCombinedByRow.push(mrgData[mi][mrgIdx]);
    }
  } catch (e) {
    Logger.log("Could not read SKU Combined: " + e);
  }

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
    // Was: if (!name) quantity = '';
    //
    // Blanking the quantity whenever the names sheet had no entry made the whole
    // row silent — no name AND no count, so the Speak Tool said nothing while the
    // product image still appeared in the strip. 19 rows across 14 SKUs were
    // affected (ENC9045, ENC10233, the LSGL glass shades, …), and a packer who is
    // never told to pick an item will not pick it.
    //
    // The count is now kept whenever the row has a SKU. Lithursan.gs announces
    // such a row as "This one" plus its colour, and the packer identifies it from
    // the picture. Rows with no SKU at all are still blanked, which is the case
    // the original rule was really guarding against.
    if (!name && !rawSku) quantity = '';

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
    mergedRow.push(skuCombinedByRow[rowIndex - 1] || "");
    mergedRow.push(ppProductType(rawSku, name));
    mergedRow.push(ppProductColour(rawSku));
    mergedRow.push("");   // Lampshade Collection - filled in by ppStampCollections()
    mergedRow.push("");   // Lampshade Collection Speech - same

    output.push(mergedRow);
  }

  // --- Just-in-time lampshade collection (max 15 per trip) ---
  // Stamps the "Lampshade Collection" column on the first row of each order
  // that triggers a collection. Changes no other column.
  var ppRows = output.slice(1);
  var ppColl = ppStampCollections(ppRows, outputHeaders);
  for (var ppJ = 0; ppJ < ppRows.length; ppJ++) output[ppJ + 1] = ppRows[ppJ];
  Logger.log("Lampshade collections triggered: " + ppColl);

  cleanedSheet.getRange(1, 1, output.length, output[0].length).setValues(output);

  keepOnlyLastOccurrenceInD(cleanedSheet);
  keepOnlyLastOccurrenceInE(cleanedSheet);
  clearFIfDIsEmptyInSheet(cleanedSheet);
  removeRPR44WHAndTransferPostCode(cleanedSheet);
  addCombinedSKUSet();

  // --- Packing priority (Lampshade -> Rectangle Ceiling Rose -> Bulb -> Other) ---
  // Reorders rows only WITHIN one customer's block. Rows are never moved between
  // customers, so the existing order/customer identity is untouched.
  //
  // MUST RUN LAST — after addCombinedSKUSet(). That function rebuilds "Combo SKU"
  // by walking the rows looking for a "Combo: 1" marker and absorbing the
  // "Combo: 2", "Combo: 3" … rows that FOLLOW it. It therefore depends on the
  // components still sitting in their original order.
  //
  // Sorting first broke exactly that. Moving a lampshade tagged "Combo: 7" to the
  // top of its order left it above the "Combo: 1" marker, so addCombinedSKUSet()
  // built its set from the remaining six rows only. One customer order came out
  // as TWO different Combo SKU values and the Speak Tool showed it as two
  // separate orders — the lampshade alone, then everything else.
  // Verified on the live sheet 2026-08-17 (Andreea Szasz, GU4 7HZ).
  var ppSorted = ppSortCleanedSheetRows(cleanedSheet);
  Logger.log("Packing priority applied: " + ppSorted + " row(s) reordered.");
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
  var skuCombinedIndex = headers.indexOf("SKU Combined");

  if (skuIndex === -1 || comboSKUIndex === -1) {
    throw new Error("Could not find 'SKU' or 'Combo SKU' column.");
  }

  // --- Merge Order sets ---
  if (mergeOrderIndex !== -1) {
    var mergeGroups = {};
    for (var i = 1; i < data.length; i++) {
      var mergeVal = (data[i][mergeOrderIndex] || "").toString().trim();
      if (!mergeVal) continue;
      // Group by "SKU Combined" (adjacency-based, already unique per order) instead
      // of the Merge Order label text. The label (e.g. "merge order total: 2 :
      // merge order: 1") only encodes the item count, so unrelated orders with the
      // same count were colliding into one group here. Fall back to the label only
      // if SKU Combined isn't populated for this row.
      var groupKey = (skuCombinedIndex !== -1 && data[i][skuCombinedIndex])
        ? data[i][skuCombinedIndex].toString().trim()
        : mergeVal;
      if (!groupKey) continue;
      if (!mergeGroups[groupKey]) mergeGroups[groupKey] = [];
      if (data[i][skuIndex]) mergeGroups[groupKey].push(data[i][skuIndex]);
    }
    for (var i = 1; i < data.length; i++) {
      var mergeVal = (data[i][mergeOrderIndex] || "").toString().trim();
      if (!mergeVal) continue;
      var groupKey = (skuCombinedIndex !== -1 && data[i][skuCombinedIndex])
        ? data[i][skuCombinedIndex].toString().trim()
        : mergeVal;
      if (groupKey && mergeGroups[groupKey]) {
        data[i][comboSKUIndex] = mergeGroups[groupKey].join("+");
      }
    }
  }

  // --- Component sets ---
  //
  // A set starts at a "Combo: 1" marker and absorbs the "Combo: 2", "Combo: 3" …
  // rows that follow it. It must NEVER run past the end of one customer's order.
  //
  // It used to do exactly that. The loop tracked only the marker sequence, so
  // when an order's own "Combo: 1" row was missing its rows were swallowed by
  // the PREVIOUS customer's set. Live example 2026-08-17:
  //
  //   row 96  PHSF2BMRBY  Combo: 1  £29.76  Emeline martinez
  //   row 97  SPSDP2BM    Combo: 2  £29.76  Emeline martinez
  //   row 98  RPM40WH     Combo: 2  £13.89  Andrew Thomas    <-- absorbed
  //
  // All three were stamped "PHSF2BMRBY+SPSDP2BM+RPM40WH", so the Speak Tool read
  // Andrew's reducer as part of Emeline's parcel — a mis-pick waiting to happen.
  // The customer is now part of the condition, so a set ends at the boundary.
  var customerIndex = headers.indexOf("Customer Info");
  if (componentIndex !== -1) {
    var currentSetRows = [];
    var currentSetSKUs = [];
    var currentSetCustomer = null;
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
      currentSetCustomer = null;
      inSet = false;
    }

    for (var i = 1; i < data.length; i++) {
      var comp = data[i][componentIndex];
      var cust = (customerIndex !== -1 && data[i][customerIndex] != null)
        ? data[i][customerIndex].toString().trim() : "";

      if (comp && typeof comp === "string" && comp.trim() === "Combo: 1") {
        flushSet();
        inSet = true;
        currentSetCustomer = cust;
        currentSetRows.push(i);
        if (data[i][skuIndex]) currentSetSKUs.push(data[i][skuIndex]);
      }
      // Continue the set ONLY while the row still belongs to the same customer.
      else if (inSet && cust === currentSetCustomer &&
               comp && typeof comp === "string" && /^Combo:\s*\d+/.test(comp)) {
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
