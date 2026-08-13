function mergeAdjacentRowsAndRepeat() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getSheetByName("Sheet1");       // Source sheet
  const cleanedSheet = ss.getSheetByName("Cleaned Data"); // Destination sheet

  cleanedSheet.clear(); // Clear previous data

  const data = sourceSheet.getDataRange().getValues();
  const headers = data.shift(); // First row = headers
  const mergeOrderIdx = headers.indexOf("Merge Order");
  const skuIdx = headers.indexOf("SKU");

  // Add new header with "SKU Combined"
  const result = [ [...headers, "SKU Combined"] ];

  let currentMerge = null;
  let currentGroup = [];
  let groupStartIndex = 0;

  data.forEach((row, i) => {
    const mergeOrder = row[mergeOrderIdx];
    const sku = row[skuIdx];

    if (mergeOrder && mergeOrder === currentMerge) {
      // Continue the same group
      currentGroup.push(sku);
    } else {
      // Flush the previous group
      if (currentGroup.length > 0) {
        const combined = currentGroup.join("+");
        for (let j = groupStartIndex; j < i; j++) {
          result.push([...data[j], combined]);
        }
      }

      // Start a new group
      currentMerge = mergeOrder || null;
      currentGroup = mergeOrder ? [sku] : [];
      groupStartIndex = i;

      // If mergeOrder is empty → push immediately with blank combined SKU
      if (!mergeOrder) {
        result.push([...row, ""]);
        currentGroup = []; // Reset because it's not a group
      }
    }
  });

  // Flush the last group
  if (currentGroup.length > 0) {
    const combined = currentGroup.join("+");
    for (let j = groupStartIndex; j < data.length; j++) {
      result.push([...data[j], combined]);
    }
  }

  // Write the result to "Cleaned Data" sheet
  cleanedSheet.getRange(1, 1, result.length, result[0].length).setValues(result);
}
