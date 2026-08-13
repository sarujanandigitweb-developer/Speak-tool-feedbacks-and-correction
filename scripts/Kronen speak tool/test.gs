function replaceComboSKUsInPlace() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // Get "names" sheet from another Google Sheet
  const namesSheet = SpreadsheetApp
    .openById("16rx5Dz-YYp-GTvRfytjq9e4p6AHw3qYh8Tm9rOPkS6M")
    .getSheetByName("names");

  const dataSheet = ss.getSheetByName('Cleaned Data');

  // Read mapping data from "names" sheet
  const nameData = namesSheet.getDataRange().getValues();
  const skuIndex = nameData[0].indexOf('SKU.1');
  const mappingIndex = nameData[0].indexOf('Mapping SKU');

  // Create SKU mapping dictionary (only if SKU != Mapping SKU)
  const skuMap = {};
  for (let i = 1; i < nameData.length; i++) {
    const sku = nameData[i][skuIndex];
    const mapped = nameData[i][mappingIndex];
    if (sku && mapped && sku !== mapped) {
      skuMap[sku] = mapped;
    }
  }

  // Read Cleaned Data
  const dataRange = dataSheet.getDataRange();
  const data = dataRange.getValues();
  const comboIndex = data[0].indexOf('Combo SKU');

  // Modify Combo SKU in place
  for (let i = 1; i < data.length; i++) {
    let combo = data[i][comboIndex];
    if (typeof combo === 'string' && combo.includes('+')) {
      const skus = combo.split('+');
      const mappedSkus = skus.map(sku => skuMap[sku] || sku);
      data[i][comboIndex] = mappedSkus.join('+');
    } else if (typeof combo === 'string') {
      data[i][comboIndex] = skuMap[combo] || combo;
    }
  }

  // Write back the modified data (overwrite original "Combo SKU" column)
  dataRange.setValues(data);
}
