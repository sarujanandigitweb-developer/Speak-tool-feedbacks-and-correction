function readRowAndSpeak() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Cleaned Data");

  if (!sheet) {
    SpreadsheetApp.getUi().alert("Sheet 'Cleaned Data' not found.");
    return;
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow < 2) {
    SpreadsheetApp.getUi().alert("No data rows found in 'Cleaned Data'.");
    return;
  }

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  const colIndex = {};
  const neededColumns = [
    "SKU", "Name", "Quantity", "Post Code", "Selling Platform",
    "Instruction QR", "Image URLs", "Title", "Price", "Customer Info", 
    "Combo SKU", "Status", "Merge Order", "Component", "Send Order Instruction",
    "SKU Combined"
  ];

  neededColumns.forEach(colName => {
    const idx = headers.findIndex(h => h.toString().trim().toLowerCase() === colName.toLowerCase());
    colIndex[colName] = idx;
  });

  for (const colName of neededColumns) {
    if (colIndex[colName] === -1) {
      SpreadsheetApp.getUi().alert('Column "' + colName + '" not found in header row.');
      return;
    }
  }

  // Optional column. Looked up separately from neededColumns on purpose: that
  // list ABORTS the tool when a column is missing, and a sheet cleaned by an
  // older script will not have this one.
  const collectionIdx = headers.findIndex(h => h.toString().trim().toLowerCase() === "lampshade collection");
  const collectionSayIdx = headers.findIndex(h => h.toString().trim().toLowerCase() === "lampshade collection speech");
  // Also optional. Used only to describe a product the names sheet does not know.
  const colourIdx = headers.findIndex(h => h.toString().trim().toLowerCase() === "colour");

  // Speech for one product line.
  //
  // When the names sheet has no entry for the SKU there is nothing to read out,
  // and the row used to be skipped in silence even though its picture was on
  // screen — so the packer was shown an item they were never asked to pick.
  // Such a row is now announced as "This one", plus its colour when one is known,
  // and the quantity. The packer identifies the product from the picture.
  function productSpeech(name, colour, sku) {
    if (name !== "") return ":: " + name.split(" ").join(" ");
    if (sku === "") return "";                       // truly empty row - nothing to say
    return ":: This one" + (colour !== "" ? " " + colour : "");
  }


  // ---------------------------------------------------------------------------
  // LAMPSHADE COLLECTION VIEW  (separate phase - never mixed with an order card)
  // Renders the structured BATCH|/ITEM| text written by ppStampCollections().
  // Contains ONLY lampshade collection data: no customer, no order products,
  // no bulbs, no ceiling roses, no order images.
  // ---------------------------------------------------------------------------
  // Image for a collection card. The ITEM field may carry several SKUs joined by
  // " + " (same size and colour), so the first one with a picture wins.
  // Reads the same skuToImageUrl map the order cards use — no new data source.
  function collectionImageFor(skuField) {
    const parts = String(skuField || "").split("+");
    for (let i = 0; i < parts.length; i++) {
      const key = parts[i].toUpperCase().trim();
      if (key && skuToImageUrl[key]) return skuToImageUrl[key];
    }
    // Nothing in Cleaned Data — fall back to the Lampshade SOT's IMG_LINK, which
    // carries a picture for all 451 lampshade SKUs.
    for (let j = 0; j < parts.length; j++) {
      const k2 = parts[j].toUpperCase().trim();
      if (k2 && typeof ppProductImage === "function") {
        const sotImg = ppProductImage(k2);
        if (sotImg) return sotImg;
      }
    }
    return "";
  }

  function buildCollectionView(raw) {
    const lines = String(raw).split("\n");
    let batch = "", total = "", max = "", overflow = false;
    const items = [];
    lines.forEach(function (ln) {
      const p = ln.split("|");
      if (p[0] === "BATCH") { batch = p[1]; total = p[2]; max = p[3]; overflow = (p[4] === "OVERFLOW"); }
      else if (p[0] === "ITEM") { items.push({ sku: p[1], size: p[2], colour: p[3], qty: p[4], order: p[5] }); }
    });

    // One card per lampshade, each carrying its product image.
    // An ITEM may hold several SKUs joined by " + " when they share size+colour,
    // so the image is taken from the first of those SKUs that has one.
    const cardsHtml = items.map(function (it) {
      const img = collectionImageFor(it.sku);
      const imgHtml = img
        ? '<img src="' + img + '" alt="' + it.sku + '" style="width:100%; height:170px;'
          + ' object-fit:contain; background:#fff; border-radius:10px; display:block;"'
          + ' onerror="this.onerror=null;this.src=\'https://via.placeholder.com/170?text=No+Image\';" />'
        : '<div style="width:100%; height:170px; background:#fff; border-radius:10px;'
          + ' display:flex; align-items:center; justify-content:center; color:#b9a88f;'
          + ' font-size:15px;">No image</div>';

      return '<div style="flex:0 0 232px; background:#fffdf8; border:2px solid #e0c9a4;'
           + ' border-radius:14px; padding:12px; text-align:left; box-shadow:0 2px 5px rgba(0,0,0,.08);">'
           // image with the quantity badge sitting on it — the number the packer acts on
           + '<div style="position:relative;">'
           +   imgHtml
           +   '<div style="position:absolute; top:6px; right:6px; background:#b45f06; color:#fff;'
           +   ' min-width:42px; height:42px; border-radius:21px; display:flex; align-items:center;'
           +   ' justify-content:center; font-size:24px; font-weight:bold; padding:0 8px;'
           +   ' box-shadow:0 2px 5px rgba(0,0,0,.3);">' + it.qty + '</div>'
           + '</div>'
           + '<div style="font-size:19px; font-weight:bold; color:#3b2a12; margin-top:10px;'
           + ' word-break:break-all;">' + it.sku + '</div>'
           + '<div style="font-size:17px; color:#5a2d03; margin-top:3px;">' + it.colour + '</div>'
           + '<div style="font-size:16px; color:#7a6a55; margin-top:2px;">' + it.size + '</div>'
           + '<div style="margin-top:8px; background:#f3e3c8; border-radius:8px; padding:5px 8px;'
           + ' font-size:18px; font-weight:bold; color:#8a4405;">Take ' + it.qty + '</div>'
           + '<div style="font-size:13px; color:#9a8a75; margin-top:6px;">' + it.order + '</div>'
           + '</div>';
    }).join("");

    return '<div style="font-family: sans-serif; max-width:1560px; margin:0 auto; border:4px solid #b45f06;'
         + ' background:#fff6e8; border-radius:16px; padding:24px 28px;">'
         + '<div style="font-size:30px; font-weight:bold; color:#8a4405; text-align:center;">🛒 LAMPSHADE COLLECTION</div>'
         + '<div style="font-size:22px; font-weight:bold; color:#5a2d03; text-align:center; margin:6px 0 18px;">Collection Batch ' + batch + '</div>'
         + '<div style="display:flex; flex-wrap:wrap; gap:16px; justify-content:center;">' + cardsHtml + '</div>'
         + '<div style="margin-top:18px; font-size:24px; font-weight:bold; color:#5a2d03; text-align:center;">Collection Total: ' + total + ' / ' + max + '</div>'
         + (overflow ? '<div style="text-align:center; color:#a01c10; font-weight:bold; margin-top:6px;">This order alone exceeds the limit</div>' : '')
         + '<div style="margin-top:20px; text-align:center; background:#b45f06; color:#fff; font-size:20px;'
         + ' font-weight:bold; border-radius:10px; padding:12px;">COLLECTION COMPLETE — press Next</div>'
         + '</div>';
  }

  // Pushes the collection as its OWN queue entry, immediately BEFORE the order
  // that triggered it. The order entry itself stays exactly as the original code
  // built it.
  function pushCollectionEntry(collectionRaw, collectionSay) {
    if (!collectionRaw) return;
    speakTexts.push([collectionSay || "Collect lampshades first."]);
    qrTexts.push("");
    postcodeTexts.push("");
    displays.push({
      html: buildCollectionView(collectionRaw),
      comboImages: [],
      mainImageUrl: "",
      rowImages: [],
      pauseTime: 0,
      isCollection: true
    });
  }

  const dataRange = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const speakTexts = [];
  const displays = [];
  const qrTexts = [];
  // Postcode kept on its own, per queue entry. The spoken sequence now glues the
  // postcode onto the last component so no extra Next is needed, but the
  // "Postcode" button must still be able to repeat JUST the postcode.
  const postcodeTexts = [];

  // Build SKU to Image URL mapping
  const skuToImageUrl = {};
  dataRange.forEach(row => {
    const sku = (row[colIndex["SKU"]] || "").toString().toUpperCase().trim();
    const imgUrl = row[colIndex["Image URLs"]] || "";
    if (sku) skuToImageUrl[sku] = imgUrl;
  });

  Logger.log("SKU to Image URL mapping: " + JSON.stringify(skuToImageUrl));

  // The key a row is grouped under.
  //
  // The combined-SKU string ALONE is not safe: it describes the product set, not
  // the order, so two customers who happen to buy the same kit collapse into one
  // queue entry and the packer is shown both parcels at once. The customer is
  // therefore part of the key, and rows are only ever grouped within one order.
  //
  // Kept separate from the DISPLAYED key — the card shows the SKU string on its
  // own, with no customer appended.
  function groupKeyOf(row) {
    const skuCombined = (row[colIndex["SKU Combined"]] || "").toString().trim();
    const comboSku = (row[colIndex["Combo SKU"]] || "").toString().trim();
    const label = skuCombined !== "" ? skuCombined : comboSku;   // shown on the card
    if (label === "") return { label: "", key: "" };
    const cust = (row[colIndex["Customer Info"]] || "").toString().trim();
    return { label: label, key: label + " || " + cust };
  }

  // Pre-scan to group rows by EITHER SKU Combined OR Combo SKU (treating them as equivalent)
  const combinedGroups = {};
  dataRange.forEach((row, idx) => {
    const groupKey = groupKeyOf(row).key;

    if (groupKey !== "") {
      if (!combinedGroups[groupKey]) {
        combinedGroups[groupKey] = [];
      }
      combinedGroups[groupKey].push({ row: row, index: idx });
    }
  });

  // Process rows in sheet order
  const processedIndices = new Set();
  
  dataRange.forEach((row, idx) => {
    if (processedIndices.has(idx)) {
      return; // Already processed as part of a group
    }

    const gk = groupKeyOf(row);
    const groupKey = gk.label;          // what the card prints
    const groupId  = gk.key;            // combined SKU + customer

    if (groupId !== "" && combinedGroups[groupId]) {
      // This is a grouped row - process entire group
      const group = combinedGroups[groupId];
      
      // Mark all rows in this group as processed
      group.forEach(item => processedIndices.add(item.index));

      // Get data from first row for display purposes
      const firstRow = group[0].row;
      
      // Find postcode AND QR from any row in the group that has them
      let postCode = "";
      let qr = "";
      for (let i = 0; i < group.length; i++) {
        const rowPostCode = (group[i].row[colIndex["Post Code"]] === null || 
                             group[i].row[colIndex["Post Code"]] === undefined || 
                             group[i].row[colIndex["Post Code"]] === "") 
          ? "" : group[i].row[colIndex["Post Code"]].toString();
        const rowQr = (group[i].row[colIndex["Instruction QR"]] || "").toString().trim();
        
        if (postCode === "" && rowPostCode !== "") {
          postCode = rowPostCode;
        }
        if (qr === "" && rowQr !== "" && rowQr.toLowerCase() !== "no instruction qr") {
          qr = rowQr;
        }
        
        // If both found, no need to continue
        if (postCode !== "" && qr !== "") break;
      }
      
      const platform = (firstRow[colIndex["Selling Platform"]] || "").toString();
      const imageUrl = firstRow[colIndex["Image URLs"]] || "";
      const title = (firstRow[colIndex["Title"]] || "").toString().trim();
      const price = (firstRow[colIndex["Price"]] || "").toString().trim();
      const customerInfo = (firstRow[colIndex["Customer Info"]] || "").toString().trim();
      const status = (firstRow[colIndex["Status"]] || "").toString().trim();
      const sendOrderInstruction = (firstRow[colIndex["Send Order Instruction"]] || "").toString().trim();
      const firstSku = (firstRow[colIndex["SKU"]] || "").toString().toUpperCase().trim();
      let collectionText = "";
      let collectionSpeech = "";
      for (let ci = 0; ci < group.length; ci++) {
        if (collectionIdx !== -1 && !collectionText) {
          const cv = (group[ci].row[collectionIdx] || "").toString().trim();
          if (cv) collectionText = cv;
        }
        if (collectionSayIdx !== -1 && !collectionSpeech) {
          const sv = (group[ci].row[collectionSayIdx] || "").toString().trim();
          if (sv) collectionSpeech = sv;
        }
      }

      // Collect all combo images from all rows in this group.
      //
      // ORDER MATTERS. The thumbnails must appear in the SAME sequence the packer
      // hears, which is the packing priority (Lampshade first, then Rect Ceiling
      // Rose, Bulb, Other). The rows in `group` are already in that order, because
      // ppApplyPackingPriority() sorted Cleaned Data before this ran.
      //
      // The previous version read the order from the "SKU Combined" STRING
      // ("CRSF100BM+PHSH2PBRYB+SPUWBM+SPWRBM+LSDO210BI"). That string is built by
      // the merge step BEFORE the priority sort, so it kept the old sequence — the
      // lampshade was spoken first but shown last. Row order is used now instead.
      let comboImages = [];

      // Pass 1 — each row's OWN image cell, in the sorted (spoken) order.
      //
      // Read from the row, not from skuToImageUrl. That map holds one image per
      // SKU and the last row wins, so when the same SKU appears twice in an order
      // with two different pictures only one of them ever reached the strip.
      // Live example 2026-08-17 (lindsey bain, SN11 0PA): ENC9045 appears twice
      // carrying 1355.jpg and SCRN70BM.jpg — five rows produced four thumbnails,
      // and the picture on the main panel was the one missing from the strip.
      group.forEach(item => {
        const rowImg = (item.row[colIndex["Image URLs"]] || "").toString().trim();
        if (rowImg) comboImages.push(rowImg);
      });

      // Pass 2 — components named in the combined SKU that have no row of their
      // own. Without this a component whose row was dropped upstream would lose
      // its thumbnail, so nothing that used to be shown disappears.
      group.forEach(item => {
        const rowSkuCombined = item.row[colIndex["SKU Combined"]] || "";
        const rowComboSku = item.row[colIndex["Combo SKU"]] || "";
        const rowComboSkuRaw = rowSkuCombined !== "" ? rowSkuCombined : rowComboSku;
        if (!rowComboSkuRaw || rowComboSkuRaw === "") return;

        const comboSkus = rowComboSkuRaw.toString().toUpperCase().split('+').map(s => s.trim());
        comboSkus.forEach(skuItem => {
          if (skuToImageUrl[skuItem]) {
            comboImages.push(skuToImageUrl[skuItem]);
          } else if (/[0-9]+PK$/.test(skuItem)) {
            const baseSku = skuItem.replace(/[0-9]+PK$/, '');
            if (skuToImageUrl[baseSku]) {
              comboImages.push(skuToImageUrl[baseSku]);
            }
          }
        });
      });

      // Remove duplicates. Set keeps FIRST insertion order, so the pass-1
      // (priority-ordered) entries win and pass-2 only adds what was missing.
      comboImages = [...new Set(comboImages)];

      // Build speech segments for all rows in this group
      const speechSegments = [];
      const rowImages = []; // Store each row's image URL
      
      group.forEach((item, groupIdx) => {
        const groupRow = item.row;
        const mergeOrder = (groupRow[colIndex["Merge Order"]] || "").toString().trim();
        const name = (groupRow[colIndex["Name"]] === null || groupRow[colIndex["Name"]] === undefined || groupRow[colIndex["Name"]] === "") 
          ? "" : groupRow[colIndex["Name"]].toString();
        const quantity = (groupRow[colIndex["Quantity"]] === null || groupRow[colIndex["Quantity"]] === undefined || groupRow[colIndex["Quantity"]] === "") 
          ? "" : groupRow[colIndex["Quantity"]].toString();
        const rowImageUrl = groupRow[colIndex["Image URLs"]] || "";

        // For each row: Merge Order :: Name (or "This one" + colour) :: Quantity ::
        const rowSkuForSpeech = (groupRow[colIndex["SKU"]] || "").toString().trim();
        const rowColour = (colourIdx !== -1 && groupRow[colourIdx]) ? groupRow[colourIdx].toString().trim() : "";
        const segmentParts = [];
        if (mergeOrder !== "") segmentParts.push(mergeOrder);
        const productText = productSpeech(name, rowColour, rowSkuForSpeech);
        if (productText !== "") segmentParts.push(productText);
        if (quantity !== "") segmentParts.push(" :: " + quantity + " ::");

        // A row with no Name produces no speech — processRow() blanks the
        // quantity too when the names sheet has no entry for the SKU, so there
        // is nothing to say. Skip it entirely rather than pushing an empty
        // segment.
        //
        // It MUST be skipped here, not filtered later. speechSegments and
        // rowImages are read by position: the client shows rowImages[n] while
        // speaking segment n. Pushing an image for a row whose segment was then
        // dropped shifted every following image by one, so the packer heard
        // "Extension Short Holder" while looking at a different product.
        // Verified on the live sheet 2026-08-17 (lindsey bain, SN11 0PA — two
        // nameless ENC9045 rows).
        const segmentText = segmentParts.join(" ");
        if (segmentText.trim() === "") return;

        speechSegments.push(segmentText);
        rowImages.push(rowImageUrl);
      });
      
      // Postcode, then note. Both are spoken as part of the LAST component's
      // step, NOT as steps of their own — the packer should not have to press
      // Next again just to hear where the parcel is going. Reading order is
      // still  last component -> Post Code -> Note.
      const postcodeSegmentParts = [];
      if (postCode !== "") {
        postcodeSegmentParts.push(":Post Code:");
        const postCodeDetails = postCode.split("");
        postCodeDetails.forEach((char, i) => {
          if (char.trim() !== "") {
            postcodeSegmentParts.push(char);
          }
        });
      }
      const postcodeText = postcodeSegmentParts.join(" ");

      // The QR flag and the Send Order Instruction are both notes the packer has
      // to act on, so both are read. Previously the Send Order Instruction was
      // shown on screen but never spoken at all.
      const noteParts = [];
      if (qr !== "") noteParts.push(qr);
      if (sendOrderInstruction !== "") noteParts.push(sendOrderInstruction);
      const noteText = noteParts.length ? ": Note : " + noteParts.join(" . ") : "";

      const tailText = [postcodeText, noteText].filter(t => t !== "").join(" ");
      if (tailText !== "") {
        if (speechSegments.length > 0) {
          // Glue onto the last component so it is one uninterrupted step.
          speechSegments[speechSegments.length - 1] =
            (speechSegments[speechSegments.length - 1] + " " + tailText).trim();
        } else {
          // Defensive: an order with no component rows still says the postcode.
          speechSegments.push(tailText);
          rowImages.push(imageUrl);
        }
      }

      pushCollectionEntry(collectionText, collectionSpeech);   // separate view, before this order

      speakTexts.push(speechSegments);
      qrTexts.push(qr);
      postcodeTexts.push(postcodeText);

      // Calculate total quantity for pause time
      const totalQuantity = group.reduce((sum, item) => {
        const qty = parseInt(item.row[colIndex["Quantity"]]) || 1;
        return sum + qty;
      }, 0);
      const pauseTime = totalQuantity * 1000;

      const display = `
        <div style="text-align: center; font-family: sans-serif; margin-bottom: 40px;">
          <div style="display: flex; justify-content: center; gap: 30px; align-items: center;">
            <div style="flex: 1; font-size: 14px; text-align: left; padding-right: 20px;">
              <div><b>Title:</b> ${title}</div>
              <div style="color:blue; font-weight:bold;">${group.map(g => {
                const n = g.row[colIndex["Name"]];
                return n ? n.toString() : "";
              }).filter(n => n).join(" + ")}</div>
              <div style="margin: 6px 0;">
                <span style="background:#f1f3f7; border-radius:16px; padding:4px 12px; font-weight: bold; color:#004080;">
                  ${platform || " "}
                </span>
              </div>
              <div style="color:#c10000;">
                ${qr !== "" ? qr : ""}
              </div>
              <div style="margin-top: 20px; font-weight: bold; font-size: 25px; color: #d10000;">
                ${status}
              </div>
            </div>
            <div style="flex: 1; max-width: 300px; text-align: center;">
              <img id="mainImage" src="${imageUrl}" style="max-height: 400px; max-width: 100%; border-radius: 16px; border: 6px solid limegreen; cursor: pointer;" onerror="this.src='https://via.placeholder.com/150';" onclick="zoomImageClicked()" />
            </div>
            <div style="flex: 1; font-size: 14px; text-align: left;">
              <div style="background:#dbe8ff; padding:3px 16px; border-radius:28px; font-size: 18px; color:#004080; font-weight:bold;">
                \u00A3 ${price ? price.toString().replace(/[^0-9.]/g, '') || '0.00' : '0.00'}
              </div>
              <div style="margin-top: 12px; line-height: 1.6; font-size: 15px;">
                ${(customerInfo || "").replace(/\n/g, "<br/>")}<br/>
                <b style="font-size: 18px;">${postCode}</b><br/>
              </div>
              <div style="margin-top: 12px; font-size: 15px; color: #ff0000;">
                ${sendOrderInstruction ? `<b>Send Order Instruction:</b> ${sendOrderInstruction}` : ""}
              </div>
            </div>
          </div>
          <div style="padding-top: 20px; font-size: 44px; font-weight: bold;">
            <div style="background: #d4edda; border-radius: 20px; display: inline-block; padding: 6px 400px; color: #004080;">
              ${group.map(g => {
                const qty = g.row[colIndex["Quantity"]];
                return qty ? "x " + qty.toString() : "";
              }).filter(q => q).join(" + ")}
            </div>
            <div style="font-size: 22px; font-weight: normal; margin-top: 6px;">${groupKey}</div>
          </div>
        </div>`;

      displays.push({
        html: display,
        comboImages: comboImages,
        mainImageUrl: imageUrl,
        rowImages: rowImages,
        pauseTime: pauseTime
      });

    } else {
      // Standalone row (no grouping value in either column)
      processedIndices.add(idx);

      const sku = (row[colIndex["SKU"]] || "").toString().toUpperCase().trim();
      const skuCombinedVal = row[colIndex["SKU Combined"]] || "";
      const comboSkuVal = row[colIndex["Combo SKU"]] || "";
      const comboSkuRaw = skuCombinedVal !== "" ? skuCombinedVal : comboSkuVal;
      const nameRaw = row[colIndex["Name"]];
      const quantityRaw = row[colIndex["Quantity"]];
      const postCodeRaw = row[colIndex["Post Code"]];
      const platform = (row[colIndex["Selling Platform"]] || "").toString();
      const qr = (row[colIndex["Instruction QR"]] || "").toString().trim();
      const imageUrl = row[colIndex["Image URLs"]] || "";
      const title = (row[colIndex["Title"]] || "").toString().trim();
      const price = (row[colIndex["Price"]] || "").toString().trim();
      const customerInfo = (row[colIndex["Customer Info"]] || "").toString().trim();
      const status = (row[colIndex["Status"]] || "").toString().trim();
      const mergeOrder = (row[colIndex["Merge Order"]] || "").toString().trim();
      const sendOrderInstruction = (row[colIndex["Send Order Instruction"]] || "").toString().trim();
      const collectionText = (collectionIdx !== -1 && row[collectionIdx]) ? row[collectionIdx].toString().trim() : "";
      const collectionSpeech = (collectionSayIdx !== -1 && row[collectionSayIdx]) ? row[collectionSayIdx].toString().trim() : "";

      const name = (nameRaw === null || nameRaw === undefined || nameRaw === "") ? "" : nameRaw.toString();
      const quantity = (quantityRaw === null || quantityRaw === undefined || quantityRaw === "") ? "" : quantityRaw.toString();
      const postCode = (postCodeRaw === null || postCodeRaw === undefined || postCodeRaw === "") ? "" : postCodeRaw.toString();

      let comboImages = [];

      if (comboSkuRaw && comboSkuRaw !== "") {
        const comboSkus = comboSkuRaw.toString().toUpperCase().split('+').map(sku => sku.trim());
        comboSkus.forEach(skuItem => {
          if (skuToImageUrl[skuItem]) {
            comboImages.push(skuToImageUrl[skuItem]);
          } else if (/[0-9]+PK$/.test(skuItem)) {
            const baseSku = skuItem.replace(/[0-9]+PK$/, '');
            if (skuToImageUrl[baseSku]) {
              comboImages.push(skuToImageUrl[baseSku]);
            }
          }
        });
      } else {
        if (skuToImageUrl[sku]) comboImages.push(skuToImageUrl[sku]);
      }

      // Create speech segments
      const segment1Parts = [];
      if (mergeOrder !== "") segment1Parts.push(" " + mergeOrder);

      // Same rule as the combo branch: a SKU the names sheet does not know is
      // still announced, as "This one" plus its colour, so it is never silent.
      const rowColour = (colourIdx !== -1 && row[colourIdx]) ? row[colourIdx].toString().trim() : "";
      const productText = productSpeech(name, rowColour, sku);
      if (productText !== "") segment1Parts.push(productText);

      if (quantity !== "") segment1Parts.push(" :: " + quantity + ":  ");

      // Single product: product, then postcode, then note — all in ONE step, so
      // the packer never has to press Next inside a one-item order.
      const segment3Parts = [];
      if (postCode !== "") {
        segment3Parts.push(" :Post Code:");
        const postCodeDetails = postCode.split("");
        postCodeDetails.forEach((char, i) => {
          if (char.trim() !== "") {
            segment3Parts.push(" " + char);
          }
        });
      }
      const postcodeText = segment3Parts.join("");

      // Same rule as the combo branch: QR flag and Send Order Instruction are
      // both read out, after the postcode.
      const noteParts = [];
      if (qr !== "" && qr.toLowerCase() !== "no instruction qr") noteParts.push(qr);
      if (sendOrderInstruction !== "") noteParts.push(sendOrderInstruction);
      const noteText = noteParts.length ? " : Note : " + noteParts.join(" . ") : "";

      pushCollectionEntry(collectionText, collectionSpeech);   // separate view, before this order

      speakTexts.push([
        (segment1Parts.join(" ") + postcodeText + noteText).trim()
      ]);

      qrTexts.push(qr);
      postcodeTexts.push(postcodeText);

      const pauseTime = (parseInt(quantity) || 1) * 1000;

      const display = `
        <div style="text-align: center; font-family: sans-serif; margin-bottom: 40px;">
          <div style="display: flex; justify-content: center; gap: 30px; align-items: center;">
            <div style="flex: 1; font-size: 14px; text-align: left; padding-right: 20px;">
              <div><b>Title:</b> ${title}</div>
              <div style="color:blue; font-weight:bold;">${name}</div>
              <div style="margin: 6px 0;">
                <span style="background:#f1f3f7; border-radius:16px; padding:4px 12px; font-weight: bold; color:#004080;">
                  ${platform || " "}
                </span>
              </div>
              <div style="color:#c10000;">
                ${qr && qr.toLowerCase() !== "no instruction qr" ? qr : ""}
              </div>
              <div style="margin-top: 20px; font-weight: bold; font-size: 25px; color: #d10000;">
                ${status}
              </div>
            </div>
            <div style="flex: 1; max-width: 300px; text-align: center;">
              <img id="mainImage" src="${imageUrl}" style="max-height: 400px; max-width: 100%; border-radius: 16px; border: 6px solid limegreen; cursor: pointer;" onerror="this.src='https://via.placeholder.com/150';" onclick="zoomImageClicked()" />
            </div>
            <div style="flex: 1; font-size: 14px; text-align: left;">
              <div style="background:#dbe8ff; padding:3px 16px; border-radius:28px; font-size: 18px; color:#004080; font-weight:bold;">
                \u00A3 ${price ? price.toString().replace(/[^0-9.]/g, '') || '0.00' : '0.00'}
              </div>
              <div style="margin-top: 12px; line-height: 1.6; font-size: 15px;">
                ${(customerInfo || "").replace(/\n/g, "<br/>")}<br/>
                <b style="font-size: 18px;">${postCode}</b><br/>
              </div>
              <div style="margin-top: 12px; font-size: 15px; color: #ff0000;">
                ${sendOrderInstruction ? `<b>Send Order Instruction:</b> ${sendOrderInstruction}` : ""}
              </div>
            </div>
          </div>
          <div style="padding-top: 20px; font-size: 44px; font-weight: bold;">
            <div style="background: #d4edda; border-radius: 20px; display: inline-block; padding: 6px 400px; color: #004080;">
              x ${quantity}
            </div>
            <div style="font-size: 22px; font-weight: normal; margin-top: 6px;">${sku}</div>
          </div>
        </div>`;

      displays.push({
        html: display,
        comboImages: comboImages,
        mainImageUrl: imageUrl,
        pauseTime: pauseTime
      });
    }
  });

  speakTextDialog(speakTexts, displays, qrTexts, postcodeTexts);
}

function speakTextDialog(speakTexts, displays, qrTexts, postcodeTexts) {
  if (!speakTexts || speakTexts.length === 0) {
    SpreadsheetApp.getUi().alert("No data to speak. Check spreadsheet content.");
    return;
  }

  const speakTextsStr = JSON.stringify(speakTexts);
  const displaysStr = JSON.stringify(displays);
  const qrTextsStr = JSON.stringify(qrTexts);
  const postcodeTextsStr = JSON.stringify(postcodeTexts || []);

  const html = `
  <html>
  <head>
    <base target="_top">
    <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
    <style>
      body { font-family: sans-serif; background: #f9f9f9; padding: 16px; }
      #spokenText { padding: 12px; background: #eef6ff; border: 1px solid #aaccee; border-radius: 8px; font-size: 15px; font-weight: bold; margin-bottom: 16px; color: #003366; }
      button { margin: 4px; padding: 8px 14px; font-size: 14px; cursor: pointer; }
      label { font-weight: bold; margin-right: 8px; }
      .settings { text-align: center; margin-bottom: 16px; display: flex; justify-content: center; gap: 20px; align-items: center; }
      .combo-images { display: block; overflow-x: auto; white-space: nowrap; max-width: 100%; margin-bottom: 20px; }
      .combo-images img { display: inline-block; margin-right: 12px; height: 90px; width: 90px; object-fit: contain; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,128,0,0.4); cursor: pointer; transition: transform 0.3s ease; }
      .combo-images img:hover { transform: scale(1.2); }
      #zoomOverlay { display: none; position: fixed; top: 10%; left: 50%; transform: translateX(-50%); z-index: 10000; background: rgba(0,0,0,0.75); border-radius: 18px; padding: 16px; box-shadow: 0 0 22px black; max-width: 70%; max-height: 70%; cursor: pointer; }
      #zoomOverlay img { max-width: 100%; max-height: 100%; border-radius: 18px; display: block; margin: auto; }
      #voiceFeedback { margin-top: 10px; font-size: 12px; color: #555; }
      /* --- microphone / listening indicator --- */
      #micIndicator { display: inline-flex; align-items: center; gap: 8px; margin: 8px auto 0; padding: 6px 14px;
                      border-radius: 20px; font-size: 14px; font-weight: bold; border: 2px solid transparent; }
      #micIndicator .mic-dot { width: 12px; height: 12px; border-radius: 50%; background: #999; flex: none; }
      #micIndicator.mic-listening { background: #e6f7ec; color: #10633b; border-color: #34a853; }
      #micIndicator.mic-listening .mic-dot { background: #34a853; animation: micPulse 1.4s ease-in-out infinite; }
      #micIndicator.mic-hearing   { background: #d5f2e1; color: #0b4f2e; border-color: #0f9d58; }
      #micIndicator.mic-hearing .mic-dot { background: #0f9d58; animation: micPulse .5s ease-in-out infinite; }
      #micIndicator.mic-processing{ background: #e0f7fa; color: #004080; border-color: #4dd0e1; }
      #micIndicator.mic-speaking  { background: #eef1f5; color: #5b6470; border-color: #b9c2cc; }
      #micIndicator.mic-paused    { background: #fff3cd; color: #7a5b00; border-color: #e0a800; }
      #micIndicator.mic-paused .mic-dot { background: #e0a800; }
      #micIndicator.mic-error     { background: #fdecea; color: #8a1c12; border-color: #d93025; }
      #micIndicator.mic-error .mic-dot { background: #d93025; }
      @keyframes micPulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.55); opacity: .45; } }
      @media (prefers-reduced-motion: reduce) { #micIndicator .mic-dot { animation: none !important; } }
      #micBtn.mic-off { background: #fff3cd; border: 1px solid #e0a800; }
      #pauseBtn.is-paused { background: #d4edda; border: 2px solid #34a853; font-weight: bold; color: #10633b; }
      #rowCounter, #rowTimeTracker, #totalTimeTracker { font-size: 14px; font-weight: bold; color: #004080; }
      #loadingIndicator { display: none; font-size: 16px; font-weight: bold; color: #004080; background: #e0f7fa; padding: 10px; border-radius: 8px; text-align: center; margin-bottom: 10px; }
      #loadingIndicator.back { background: #ffe0e0; }
      #heldRows { margin-top: 20px; padding: 10px; background: #fff; border: 1px solid #ccc; border-radius: 8px; }
      .held-row { padding: 8px; margin: 4px 0; background: #fff3cd; border-radius: 4px; font-size: 14px; }
    </style>
  </head>
  <body>
    <div class="settings">
      <div id="rowCounter">Row: 1 of ${speakTexts.length}</div>
      <div id="rowTimeTracker">Row Time: 00:00:00</div>
      <div id="totalTimeTracker">Total Time: 00:00:00</div>
      <label>Voice: <select id="voiceSelect"></select></label>
      <label>Speed: 
        <select id="rateSelect">
          <option value="0.6">Slow</option>
          <option value="0.7" selected>Normal</option>
          <option value="1.2">Fast</option>
          <option value="1.5">Very Fast</option>
        </select>
      </label>
    </div>
    <div id="loadingIndicator">Processing command... <span class="spinner">⏳</span></div>
    <div style="text-align:center; margin-bottom: 20px;">
      <button onclick="controlSpeech('back')">⏮️Back</button>
      <button onclick="controlSpeech('restart')">🔁Restart</button>
      <button onclick="controlSpeech('respeak')">🔄Respeak</button>
      <button onclick="controlSpeech('postcode')">📍Postcode</button>
      <button onclick="togglePause()" id="pauseBtn">⏸️ Pause</button>
      <button onclick="controlSpeech('next')">⏭️Next</button>
    </div>
    <div style="text-align:center; margin-bottom: 12px;">
      <button onclick="toggleMic()" id="micBtn" title="Pause or resume voice commands">🎙️ Mic On</button>
      <div id="micIndicator" class="mic-processing"><span class="mic-dot"></span><span id="micText">Starting…</span></div>
    </div>
    <div id="spokenText"></div>
    <div id="voiceFeedback"></div>
    <div class="combo-images" id="comboImagesContainer"></div>
    <div id="display" style="margin-top: 20px;"></div>
    <div id="heldRows"></div>
    <div id="zoomOverlay" onclick="hideZoom()">
      <img id="zoomImg" src="" alt="Zoomed Image"/>
    </div>
    <script>
      const speakTexts = ${speakTextsStr};
      const displays = ${displaysStr};
      const qrTexts = ${qrTextsStr};
      const postcodeTexts = ${postcodeTextsStr};
      var index = 0, paused = false, isSpeaking = false;
      // Position WITHIN the current order. A combo is read one component at a
      // time and only advances when the packer asks for the next one, so they can
      // pick that component and put it in the box before hearing the next.
      // Segment layout per order:  component… -> Post Code -> Note (if any)
      var segIndex = 0;
      var rowStartTime = new Date();
      var totalTimeSeconds = 0;
      var rowTimerInterval;
      var synth = window.speechSynthesis;
      var voices = [], selectedVoice = null;
      var toSpeak = Array.from({length: speakTexts.length}, (_, i) => i);
      var held = [];
      var currentSpeakIndex = 0;

      var comboImagesContainer = document.getElementById("comboImagesContainer");
      var displayDiv = document.getElementById("display");
      var spokenTextDiv = document.getElementById("spokenText");
      var voiceFeedbackDiv = document.getElementById("voiceFeedback");
      var zoomOverlay = document.getElementById("zoomOverlay");
      var zoomImg = document.getElementById("zoomImg");
      var rowCounterDiv = document.getElementById("rowCounter");
      var rowTimeTrackerDiv = document.getElementById("rowTimeTracker");
      var totalTimeTrackerDiv = document.getElementById("totalTimeTracker");
      var loadingIndicator = document.getElementById("loadingIndicator");
      var heldRowsDiv = document.getElementById("heldRows");

      function showLoading(action) {
        loadingIndicator.classList.remove("back");
        if (action === "back") loadingIndicator.classList.add("back");
        loadingIndicator.style.display = "block";
        voiceFeedbackDiv.innerText = "Processing " + action + " command...";
      }

      function hideLoading() {
        loadingIndicator.style.display = "none";
        loadingIndicator.classList.remove("back");
        voiceFeedbackDiv.innerText = "";
      }

      function formatTime(seconds) {
        const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return \`\${hrs}:\${mins}:\${secs}\`;
      }

      function updateRowTimeTracker() {
        const elapsedSeconds = Math.floor((new Date() - rowStartTime) / 1000);
        rowTimeTrackerDiv.innerText = \`Row Time: \${formatTime(elapsedSeconds)}\`;
      }

      function updateTotalTimeTracker() {
        totalTimeTrackerDiv.innerText = \`Total Time: \${formatTime(totalTimeSeconds)}\`;
      }

      function startRowTimer() {
        rowStartTime = new Date();
        clearInterval(rowTimerInterval);
        rowTimerInterval = setInterval(updateRowTimeTracker, 1000);
      }

      function stopRowTimer() {
        clearInterval(rowTimerInterval);
        const elapsedSeconds = Math.floor((new Date() - rowStartTime) / 1000);
        totalTimeSeconds += elapsedSeconds;
        updateTotalTimeTracker();
      }

      function updateComboImages() {
        comboImagesContainer.innerHTML = "";
        var imgs = (displays[index].comboImages || []).slice(0, 50);
        console.log("Combo images for index " + index + ": ", imgs);
        imgs.forEach(function(url) {
          var img = document.createElement("img");
          img.src = url;
          img.alt = "Combo Image";
          img.onerror = function() { console.error("Failed to load image: " + url); };
          img.onclick = function() { showZoom(url); };
          comboImagesContainer.appendChild(img);
        });
      }

      // The speakable parts of the current order, blanks dropped, in order:
      //   component 1 … component N, Post Code, Note
      function currentSegments() {
        var segs = speakTexts[index] || [];
        return segs.filter(function (s) { return s && s.trim() !== ""; });
      }

      // Speaks ONLY the component the packer is on, and shows that component's
      // picture. Nothing runs on past it — the next one waits for "Next".
      function speakCurrentSegment(onEnd) {
        var segs = currentSegments();
        if (!segs.length) { if (onEnd) onEnd(); return; }
        if (segIndex < 0) segIndex = 0;
        if (segIndex >= segs.length) segIndex = segs.length - 1;

        var imgs = displays[index].rowImages || [];
        if (imgs.length && imgs[segIndex]) {
          var mainImg = document.getElementById("mainImage");
          if (mainImg) mainImg.src = imgs[segIndex];
        }
        updateSegmentUI();
        speakLine([segs[segIndex]], onEnd);
      }

      // Shows "Item 2 of 7" and the exact words being spoken right now, so the
      // packer can see where they are inside a long combo.
      function updateSegmentUI() {
        var segs = currentSegments();
        spokenTextDiv.innerText = segs[segIndex] || "";
        rowCounterDiv.innerText = "Row: " + (index + 1) + " of " + speakTexts.length +
          (segs.length > 1 ? "   ·   Item: " + (segIndex + 1) + " of " + segs.length : "");
      }

      function changeIndex(direction) {
        stopRowTimer();
        segIndex = 0;                 // every order starts at its first component
        if (direction === "next") {
          currentSpeakIndex += 1;
          if (currentSpeakIndex >= toSpeak.length && held.length > 0) {
            toSpeak = held;
            held = [];
            currentSpeakIndex = 0;
          } else if (currentSpeakIndex >= toSpeak.length) {
            currentSpeakIndex = 0;
          }
        } else if (direction === "prev") {
          currentSpeakIndex -= 1;
          if (currentSpeakIndex < 0) {
            currentSpeakIndex = toSpeak.length - 1;
          }
        }
        index = toSpeak[currentSpeakIndex];
        startRowTimer();
        updateUI();
        if (synth.speaking) synth.cancel();
        speakCurrentSegment(function() {
          hideLoading();
        });
      }

      function controlSpeech(action) {
        console.log("Control speech action:", action);
        voiceFeedbackDiv.innerText = "Action: " + action;
        showLoading(action);
        switch (action) {
          case "next":
            if (toSpeak.length === 0 && held.length === 0) {
              voiceFeedbackDiv.innerText = "No data to speak.";
              hideLoading();
              return;
            }
            // Step to the next component of THIS order first. Only once the
            // postcode and note have been read does "next" move to a new order.
            if (segIndex < currentSegments().length - 1) {
              segIndex++;
              if (synth.speaking) synth.cancel();
              speakCurrentSegment(function () { hideLoading(); });
            } else {
              changeIndex("next");
            }
            break;
          case "back":
            if (toSpeak.length === 0 && held.length === 0) {
              voiceFeedbackDiv.innerText = "No data to speak.";
              hideLoading();
              return;
            }
            // Mirror of "next": step back through the components, and only leave
            // the order once the packer is already on its first component.
            if (segIndex > 0) {
              segIndex--;
              if (synth.speaking) synth.cancel();
              speakCurrentSegment(function () { hideLoading(); });
            } else {
              changeIndex("prev");
            }
            break;
          case "respeak":
            if (paused || !synth.speaking) {
              if (toSpeak.length === 0 && held.length === 0) {
                voiceFeedbackDiv.innerText = "No data to speak.";
                hideLoading();
                return;
              }
              // Repeats the CURRENT component only, not the whole order.
              speakCurrentSegment(function() {
                hideLoading();
              });
            } else {
              hideLoading();
            }
            break;
          case "postcode":
            if (paused || !synth.speaking) {
              if (toSpeak.length === 0 && held.length === 0) {
                voiceFeedbackDiv.innerText = "No data to speak.";
                hideLoading();
                return;
              }
              // Reads JUST the postcode, and does not move segIndex — the packer
              // stays on whatever component they were on. The postcode is stored
              // separately because it is now spoken as part of the last
              // component's step, so it is no longer a segment of its own.
              const pc = (postcodeTexts && postcodeTexts[index]) || "";
              if (pc.trim() !== "") {
                if (synth.speaking) synth.cancel();
                speakLine([pc], function() {
                  hideLoading();
                });
              } else {
                voiceFeedbackDiv.innerText = "No postcode found for this row.";
                hideLoading();
              }
            } else {
              hideLoading();
            }
            break;
          case "restart":
            paused = false;
            if (synth.speaking) synth.cancel();
            currentSpeakIndex = 0;
            segIndex = 0;
            toSpeak = Array.from({length: speakTexts.length}, (_, i) => i);
            held = [];
            index = toSpeak[currentSpeakIndex];
            resetTimers();
            updateUI();
            if (toSpeak.length === 0) {
              voiceFeedbackDiv.innerText = "No data to speak.";
              hideLoading();
              return;
            }
            speakCurrentSegment(function() {
              hideLoading();
            });
            break;
          default:
            console.warn("Unknown action:", action);
            voiceFeedbackDiv.innerText = "Unknown action: " + action;
            hideLoading();
        }
      }

      // Pause / Resume toggle for SPEECH PLAYBACK.
      //
      // Previously this only ever paused: synth.resume() appeared nowhere in the
      // file, so once paused the speech could not be restarted and the button
      // stayed on "Paused" for ever. It is now a real two-way toggle and the
      // label returns to "Pause" on resume.
      //
      // Microphone interaction: while speech is paused the tool produces no audio,
      // so it cannot hear itself - the mic is released so the packer can still say
      // "next". It is muted again the moment speech resumes.
      function togglePause() {
        var btn = document.getElementById("pauseBtn");

        if (synth.speaking && !synth.paused) {
          synth.pause();
          paused = true;
          if (btn) { btn.innerText = "▶️ Resume"; btn.className = "is-paused"; }
          voiceFeedbackDiv.innerText = "Speech paused - press Resume to continue.";
          micResumeAfterSpeech();

        } else if (synth.paused) {
          micSuspendForSpeech();        // mute before audio starts again
          synth.resume();
          paused = false;
          if (btn) { btn.innerText = "⏸️ Pause"; btn.className = ""; }
          voiceFeedbackDiv.innerText = "Speech resumed.";

        } else {
          paused = false;
          if (btn) { btn.innerText = "⏸️ Pause"; btn.className = ""; }
          voiceFeedbackDiv.innerText = "Nothing is playing - press Respeak to hear this order.";
        }
      }

      function showZoom(src) {
        zoomImg.src = src;
        zoomOverlay.style.display = "block";
      }

      function hideZoom() {
        zoomOverlay.style.display = "none";
        zoomImg.src = "";
      }

      window.zoomImageClicked = function() {
        var mainImgUrl = displays[index].mainImageUrl;
        if (mainImgUrl) showZoom(mainImgUrl);
      };

      function populateVoiceList() {
        voices = synth.getVoices();
        console.log("Available voices:", voices);
        var voiceSelect = document.getElementById("voiceSelect");
        voiceSelect.innerHTML = "";
        voices.forEach(function(voice, i) {
          var option = document.createElement("option");
          option.textContent = voice.name + " (" + voice.lang + ")";
          option.value = i;
          voiceSelect.appendChild(option);
        });
        var defaultIndex = voices.findIndex(function(v) { return v.name === "Google US English" && v.lang === "en-US"; });
        if (defaultIndex !== -1) {
          voiceSelect.selectedIndex = defaultIndex;
          selectedVoice = voices[defaultIndex];
        } else if (voiceSelect.options.length > 0) {
          voiceSelect.selectedIndex = 0;
          selectedVoice = voices[0];
        } else {
          console.warn("No voices available");
          voiceFeedbackDiv.innerText = "No voices available. Speech may not work.";
        }
        voiceSelect.onchange = function() {
          selectedVoice = voices[voiceSelect.value];
          console.log("Voice changed to:", selectedVoice.name);
          if (speakTexts[index]) {
            // Re-read the component the packer is on, in the new voice — not the
            // whole order, which would jump them back to component 1.
            speakCurrentSegment(function() {});
          }
        };
      }

      var speechRate = 0.7;
      var speechToken = 0;   // generation counter for speakLine() chains
      document.getElementById("rateSelect").onchange = function() {
        speechRate = parseFloat(this.value);
        console.log("Speech rate changed to:", speechRate);
      };

      function speakLine(segments, onEnd) {
        synth.cancel();
        paused = false;
        var pb = document.getElementById("pauseBtn");
        if (pb) { pb.innerText = "⏸️ Pause"; pb.className = ""; }

        if (!segments || segments.length === 0 || segments.every(segment => !segment || segment.trim() === "")) {
          voiceFeedbackDiv.innerText = "No valid speech content.";
          if (onEnd) onEnd();
          return;
        }

        // Mute the microphone while the tool speaks, so its own output
        // (e.g. ":Post Code:") is never recognised as a user command.
        micSuspendForSpeech();

        // Generation guard: pressing Next mid-speech cancels the old utterance
        // chain. Without this, the orphaned chain could un-mute the microphone
        // while the NEW order is still being spoken.
        speechToken++;
        const myToken = speechToken;

        const validSegments = segments.filter(seg => seg && seg.trim() !== "");
        const rowImages = displays[index].rowImages || [];
        let currentSegmentIndex = 0;

        function speakNextSegment() {
          if (myToken !== speechToken) return;          // superseded - stay silent
          if (currentSegmentIndex >= validSegments.length) {
            micResumeAfterSpeech();
            if (onEnd) onEnd();
            return;
          }

          // Image is no longer switched here. speakLine() is now handed ONE
          // segment at a time, so it has no idea which component that is.
          // speakCurrentSegment() sets the image from segIndex before calling.

          const text = validSegments[currentSegmentIndex];
          const utter = new SpeechSynthesisUtterance(text);
          utter.lang = "en-US";
          utter.rate = speechRate;

          if (selectedVoice) {
            utter.voice = selectedVoice;
          }

          utter.onend = () => {
            currentSegmentIndex++;
            speakNextSegment();
          };

          utter.onerror = (event) => {
            if (myToken !== speechToken) return;        // superseded by a newer call
            console.error("Speech error:", event.error);
            voiceFeedbackDiv.innerText = "Speech error: " + event.error;
            micResumeAfterSpeech();
            if (onEnd) onEnd();
          };

          synth.speak(utter);
        }

        speakNextSegment();
      }

      function updateUI() {
        console.log("Updating UI for index:", index);
        displayDiv.innerHTML = displays[index].html || "";
        updateSegmentUI();          // sets spokenText + "Row x of y · Item a of b"
        updateRowTimeTracker();
        updateTotalTimeTracker();
        updateComboImages();
        heldRowsDiv.innerHTML = held.length > 0 ? 
          '<h3>Held Rows:</h3>' + held.map(i => 
            \`<div class="held-row">Row \${i + 1}: \${speakTexts[i].join(" ")}</div>\`
          ).join("") : "";
        
        displayDiv.offsetHeight;
      }

      function resetTimers() {
        totalTimeSeconds = 0;
        rowStartTime = new Date();
        clearInterval(rowTimerInterval);
        rowTimeTrackerDiv.innerText = "Row Time: 00:00:00";
        totalTimeTrackerDiv.innerText = "Total Time: 00:00:00";
        startRowTimer();
      }

      if ('mediaSession' in navigator) {
        console.log("MediaSession API is supported");
        navigator.mediaSession.setActionHandler('play', function() {
          console.log("Headset play button pressed");
          if (synth.paused) {
            togglePause();          // resume where it stopped
          } else {
            controlSpeech('respeak');
          }
        });
        navigator.mediaSession.setActionHandler('pause', function() {
          console.log("Headset pause button pressed");
          togglePause();
        });
        navigator.mediaSession.setActionHandler('nexttrack', function() {
          console.log("Headset next button pressed");
          controlSpeech('next');
        });
        navigator.mediaSession.setActionHandler('previoustrack', function() {
          console.log("Headset previous button pressed");
          controlSpeech('back');
        });
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'Speak Products',
          artist: 'Google Sheets',
          album: 'Product Reader'
        });
      } else {
        console.warn("MediaSession API not supported");
        voiceFeedbackDiv.innerText = "MediaSession API not supported. Headset controls may not work.";
      }

      document.addEventListener('keydown', function(event) {
        console.log("Key pressed:", event.key);
        switch (event.key) {
          case 'ArrowRight':
            controlSpeech('next');
            break;
          case 'ArrowLeft':
            controlSpeech('back');
            break;
          case 'ArrowUp':
            controlSpeech('respeak');
            break;
          case 'ArrowDown':
            togglePause();
            break;
          case 'Enter':
            controlSpeech('restart');
            break;
        }
      });

      // =====================================================================
      // VOICE RECOGNITION — single authoritative lifecycle
      // ---------------------------------------------------------------------
      // Previous behaviour and why it failed:
      //   onresult ended with  recognition.stop(); recognition.start();
      //   stop() is asynchronous, so start() on the next line threw
      //   InvalidStateError. That landed in onerror, which only logged - it
      //   never restarted. Recognition could die permanently mid-session with
      //   no visible sign, which is why "next" had to be repeated.
      //   onend also called start() unconditionally, racing the same call.
      // =====================================================================
      var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      var recognition = null;

      var micPausedByUser   = false;  // user intent - the ONLY thing that blocks auto-restart
      var micRunning        = false;  // true between onstart and onend
      var micSuspendedForTTS= false;  // muted because the tool itself is speaking
      var micFatalError     = "";     // permission / hardware failure - do not retry
      var micRestartTimer   = null;
      var lastCommand       = "";
      var lastCommandTime   = 0;

      function setMicState(state, text) {
        var el = document.getElementById("micIndicator");
        var tx = document.getElementById("micText");
        if (!el || !tx) return;
        el.className = "mic-" + state;
        tx.innerText = text;
      }

      function refreshMicUI() {
        var btn = document.getElementById("micBtn");
        if (micFatalError)          { setMicState("error", "Microphone unavailable - " + micFatalError); }
        else if (micPausedByUser)   { setMicState("paused", "PAUSED - voice commands off"); }
        else if (micSuspendedForTTS){ setMicState("speaking", "Speaking - mic off"); }
        else if (micRunning)        { setMicState("listening", "Listening"); }
        else                        { setMicState("processing", "Starting…"); }
        if (btn) {
          btn.innerText = micPausedByUser ? "🎙️ Mic Off" : "🎙️ Mic On";
          btn.className = micPausedByUser ? "mic-off" : "";
        }
      }

      // Safe start: never throws, never creates a second recognition object.
      function micStart() {
        if (!recognition || micPausedByUser || micFatalError || micSuspendedForTTS || micRunning) return;
        try {
          recognition.start();
        } catch (e) {
          // "already started" - benign, onstart will follow or onend will retry
          console.warn("recognition.start() ignored:", e && e.message);
        }
      }

      function micStop() {
        if (!recognition || !micRunning) return;
        try { recognition.stop(); } catch (e) { console.warn("recognition.stop():", e && e.message); }
      }

      function micScheduleRestart(delay) {
        if (micRestartTimer) clearTimeout(micRestartTimer);
        micRestartTimer = setTimeout(function () {
          micRestartTimer = null;
          micStart();
        }, delay || 250);
      }

      // Called by speakLine() so the tool never hears its own speech.
      //
      // Watchdog: Chrome does not always fire utterance onend (notably after
      // synth.cancel(), or when the tab is backgrounded). Without a safety net a
      // missed onend would leave the microphone muted for the rest of the
      // session - the exact "voice stopped working" failure we are fixing. The
      // watchdog force-resumes if speech never reports completion.
      var micSpeechWatchdog = null;
      var MIC_SPEECH_MAX_MS = 45000;

      function micSuspendForSpeech() {
        micSuspendedForTTS = true;
        micStop();
        refreshMicUI();
        if (micSpeechWatchdog) clearTimeout(micSpeechWatchdog);
        micSpeechWatchdog = setTimeout(function () {
          micSpeechWatchdog = null;
          if (micSuspendedForTTS) {
            console.warn("Speech completion never reported - releasing microphone.");
            micResumeAfterSpeech();
          }
        }, MIC_SPEECH_MAX_MS);
      }

      function micResumeAfterSpeech() {
        if (micSpeechWatchdog) { clearTimeout(micSpeechWatchdog); micSpeechWatchdog = null; }
        if (!micSuspendedForTTS) return;
        micSuspendedForTTS = false;
        refreshMicUI();
        micScheduleRestart(200);
      }

      // Same button toggles pause / resume (one recognition object throughout).
      function toggleMic() {
        if (micFatalError) { refreshMicUI(); return; }
        micPausedByUser = !micPausedByUser;
        if (micPausedByUser) {
          if (micRestartTimer) { clearTimeout(micRestartTimer); micRestartTimer = null; }
          micStop();
        } else {
          micScheduleRestart(0);
        }
        refreshMicUI();
      }
      window.toggleMic = toggleMic;

      // --- transcript normalisation (case, punctuation, whitespace) ---
      function normalizeTranscript(t) {
        return String(t || "")
          .toLowerCase()
          .replace(/[.,!?;:]+/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      }

      // --- command vocabulary (unchanged set, matched on word boundaries) ---
      // Order matters: "restart"/"start" is tested before "again" so that
      // "start again" resolves to restart, matching the previous behaviour.
      var VOICE_COMMANDS = [
        { action: "restart",  re: /\b(restart|start)\b/ },
        { action: "next",     re: /\b(next|forward)\b|\bgo on\b|\bgo next\b/ },
        { action: "back",     re: /\b(back|previous|prev)\b/ },
        { action: "respeak",  re: /\b(respeak|again|repeat)\b/ },
        { action: "postcode", re: /\bpost ?code\b/ }
      ];

      function matchCommand(text) {
        // Guard against arbitrary sentences that merely contain a keyword.
        if (!text) return null;
        var words = text.split(" ");
        if (words.length > 5) return null;
        for (var i = 0; i < VOICE_COMMANDS.length; i++) {
          if (VOICE_COMMANDS[i].re.test(text)) return VOICE_COMMANDS[i].action;
        }
        return null;
      }

      if (!SpeechRecognition) {
        micFatalError = "not supported in this browser (use Chrome)";
        refreshMicUI();
        voiceFeedbackDiv.innerText = "Speech recognition not supported. Buttons and keyboard still work.";
      } else {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onstart = function () {
          micRunning = true;
          refreshMicUI();
        };

        // Real signal from the API - not a simulated volume meter.
        recognition.onspeechstart = function () {
          if (!micPausedByUser && !micSuspendedForTTS) setMicState("hearing", "Listening…");
        };
        recognition.onspeechend = function () {
          if (!micPausedByUser && !micSuspendedForTTS) refreshMicUI();
        };

        recognition.onresult = function (event) {
          if (micPausedByUser || micSuspendedForTTS) return;   // ignore late results

          for (var i = event.resultIndex; i < event.results.length; i++) {
            if (!event.results[i].isFinal) continue;

            var raw  = event.results[i][0].transcript;
            var text = normalizeTranscript(raw);
            console.log("Heard:", text);
            voiceFeedbackDiv.innerText = "Heard: " + text;

            var action = matchCommand(text);
            if (!action) continue;

            // De-duplicate: the same command inside 1s is one utterance,
            // not two. Different commands are never blocked.
            var now = new Date().getTime();
            if (action === lastCommand && (now - lastCommandTime) < 1000) {
              console.log("Duplicate '" + action + "' ignored");
              continue;
            }
            lastCommand = action;
            lastCommandTime = now;

            setMicState("processing", "Processing " + action + "…");
            showLoading(action);
            controlSpeech(action);      // the SAME handler the buttons use
          }
        };

        recognition.onerror = function (event) {
          var err = event && event.error ? event.error : "unknown";
          console.warn("Speech recognition error:", err);
          micRunning = false;

          if (err === "not-allowed" || err === "service-not-allowed") {
            micFatalError = "permission denied";      // do not retry
          } else if (err === "audio-capture") {
            micFatalError = "no microphone found";    // do not retry
          } else if (err === "no-speech" || err === "aborted") {
            // Normal lifecycle events - stay quiet, onend will restart.
          } else {
            voiceFeedbackDiv.innerText = "Voice error (" + err + ") - retrying…";
          }
          hideLoading();
          refreshMicUI();
        };

        recognition.onend = function () {
          micRunning = false;
          refreshMicUI();
          // Restart ONLY when the user has not paused and speech is not playing.
          if (!micPausedByUser && !micFatalError && !micSuspendedForTTS) {
            micScheduleRestart(250);
          }
        };

        micStart();
      }
      refreshMicUI();

      window.onload = function() {
        if (!window.speechSynthesis) {
          alert("Speech Synthesis not supported. Please use Google Chrome.");
          return;
        }
        console.log("speakTexts:", speakTexts);
        
        updateUI();
        startRowTimer();
        
        function initialize() {
          populateVoiceList();
          updateUI();
          if (voices.length > 0) {
            console.log("Initial speak for index:", index);
            setTimeout(function() {
              speakCurrentSegment(function() {});
            }, 100);
          } else {
            console.warn("Voices not loaded yet");
            voiceFeedbackDiv.innerText = "Waiting for voices to load...";
          }
        }
        if (speechSynthesis.onvoiceschanged !== undefined) {
          speechSynthesis.onvoiceschanged = function() {
            console.log("Voices changed event fired");
            initialize();
          };
        } else {
          initialize();
        }
      };

      window.resume = function() { controlSpeech("respeak"); };
      window.prev = function() { controlSpeech("back"); };
      window.next = function() { controlSpeech("next"); };
      window.restart = function() { controlSpeech("restart"); };
      window.postcode = function() { controlSpeech("postcode"); };
    </script>
  </body>
  </html>`;

  // 1600 is the practical ceiling: Google caps a modal dialog at the browser
  // window width, so anything larger is silently clipped rather than honoured.
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(1600).setHeight(1300), "Speak Products");
}