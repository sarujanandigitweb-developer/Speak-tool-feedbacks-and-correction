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

  const dataRange = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const speakTexts = [];
  const displays = [];
  const qrTexts = [];

  // Build SKU to Image URL mapping
  const skuToImageUrl = {};
  dataRange.forEach(row => {
    const sku = (row[colIndex["SKU"]] || "").toString().toUpperCase().trim();
    const imgUrl = row[colIndex["Image URLs"]] || "";
    if (sku) skuToImageUrl[sku] = imgUrl;
  });

  Logger.log("SKU to Image URL mapping: " + JSON.stringify(skuToImageUrl));

  // Pre-scan to group rows by EITHER SKU Combined OR Combo SKU (treating them as equivalent)
  const combinedGroups = {};
  dataRange.forEach((row, idx) => {
    // Check SKU Combined first, then fall back to Combo SKU
    const skuCombined = (row[colIndex["SKU Combined"]] || "").toString().trim();
    const comboSku = (row[colIndex["Combo SKU"]] || "").toString().trim();
    
    // Use whichever one is not empty, prioritizing SKU Combined
    const groupKey = skuCombined !== "" ? skuCombined : comboSku;
    
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

    const skuCombined = (row[colIndex["SKU Combined"]] || "").toString().trim();
    const comboSku = (row[colIndex["Combo SKU"]] || "").toString().trim();
    const groupKey = skuCombined !== "" ? skuCombined : comboSku;

    if (groupKey !== "" && combinedGroups[groupKey]) {
      // This is a grouped row - process entire group
      const group = combinedGroups[groupKey];
      
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

      // Collect all combo images from all rows in this group
      let comboImages = [];
      group.forEach(item => {
        const rowSku = (item.row[colIndex["SKU"]] || "").toString().toUpperCase().trim();
        const rowSkuCombined = item.row[colIndex["SKU Combined"]] || "";
        const rowComboSku = item.row[colIndex["Combo SKU"]] || "";
        const rowComboSkuRaw = rowSkuCombined !== "" ? rowSkuCombined : rowComboSku;
        
        if (rowComboSkuRaw && rowComboSkuRaw !== "") {
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
        } else {
          if (skuToImageUrl[rowSku]) comboImages.push(skuToImageUrl[rowSku]);
        }
      });

      // Remove duplicates
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
        
        // Store this row's image URL
        rowImages.push(rowImageUrl);
        
        // For each row: Merge Order :: Name :: Quantity ::
        const segmentParts = [];
        if (mergeOrder !== "") segmentParts.push(mergeOrder);
        if (name !== "") {
          const nameWords = name.split(" ");
          segmentParts.push(":: " + nameWords.join(" "));
        }
        if (quantity !== "") segmentParts.push(" :: " + quantity + " ::");
        
        speechSegments.push(segmentParts.join(" "));
      });
      
      // Add postcode and QR at the very end, after ALL items
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
      
      // Add QR instruction AFTER postcode if it exists
      if (qr !== "") {
        postcodeSegmentParts.push(": : " + qr);
      }
      
      if (postcodeSegmentParts.length > 0) {
        // Add the postcode+QR segment at the end
        speechSegments.push(postcodeSegmentParts.join(" "));
        // Postcode uses the last row's image
        rowImages.push(rowImages[rowImages.length - 1] || imageUrl);
      }

      speakTexts.push(speechSegments);
      qrTexts.push(qr);

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
      
      if (name !== "") {
        const nameWords = name.split(" ");
        segment1Parts.push(":: " + nameWords.join(" "));
      }
      
      if (quantity !== "") segment1Parts.push(" :: " + quantity + ":  ");

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
      
      // Add QR instruction AFTER postcode if it exists
      if (qr !== "" && qr.toLowerCase() !== "no instruction qr") {
        segment3Parts.push(" : : " + qr);
      }

      speakTexts.push([
        segment1Parts.join(" "),
        segment3Parts.join("")
      ]);

      qrTexts.push(qr);

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

  speakTextDialog(speakTexts, displays, qrTexts);
}

function speakTextDialog(speakTexts, displays, qrTexts) {
  if (!speakTexts || speakTexts.length === 0) {
    SpreadsheetApp.getUi().alert("No data to speak. Check spreadsheet content.");
    return;
  }

  const speakTextsStr = JSON.stringify(speakTexts);
  const displaysStr = JSON.stringify(displays);
  const qrTextsStr = JSON.stringify(qrTexts);

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
      var index = 0, paused = false, isSpeaking = false;
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

      function changeIndex(direction) {
        stopRowTimer();
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
        speakLine(speakTexts[index], function() {
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
            changeIndex("next");
            break;
          case "back":
            if (toSpeak.length === 0 && held.length === 0) {
              voiceFeedbackDiv.innerText = "No data to speak.";
              hideLoading();
              return;
            }
            changeIndex("prev");
            break;
          case "respeak":
            if (paused || !synth.speaking) {
              if (toSpeak.length === 0 && held.length === 0) {
                voiceFeedbackDiv.innerText = "No data to speak.";
                hideLoading();
                return;
              }
              speakLine(speakTexts[index], function() {
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
              const segments = speakTexts[index];
              const postcodeSegment = segments.find(seg => seg && seg.includes("Post Code"));
              if (postcodeSegment) {
                speakLine([postcodeSegment], function() {
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
            speakLine(speakTexts[index], function() {
              hideLoading();
            });
            break;
          default:
            console.warn("Unknown action:", action);
            voiceFeedbackDiv.innerText = "Unknown action: " + action;
            hideLoading();
        }
      }

      function togglePause() {
        if (synth.speaking && !synth.paused) {
          synth.pause();
          paused = true;
          document.getElementById("pauseBtn").innerText = "⏸️ Paused";
          voiceFeedbackDiv.innerText = "Speech paused.";
        } else {
          voiceFeedbackDiv.innerText = "Nothing to pause or already paused.";
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
            speakLine(speakTexts[index], function() {});
          }
        };
      }

      var speechRate = 0.7;
      document.getElementById("rateSelect").onchange = function() {
        speechRate = parseFloat(this.value);
        console.log("Speech rate changed to:", speechRate);
      };

      function speakLine(segments, onEnd) {
        synth.cancel();
        paused = false;
        document.getElementById("pauseBtn").innerText = "⏸️ Pause";

        if (!segments || segments.length === 0 || segments.every(segment => !segment || segment.trim() === "")) {
          voiceFeedbackDiv.innerText = "No valid speech content.";
          if (onEnd) onEnd();
          return;
        }

        const validSegments = segments.filter(seg => seg && seg.trim() !== "");
        const rowImages = displays[index].rowImages || [];
        let currentSegmentIndex = 0;

        function speakNextSegment() {
          if (currentSegmentIndex >= validSegments.length) {
            if (onEnd) onEnd();
            return;
          }

          if (rowImages.length > 0 && currentSegmentIndex < rowImages.length) {
            const mainImg = document.getElementById("mainImage");
            if (mainImg && rowImages[currentSegmentIndex]) {
              mainImg.src = rowImages[currentSegmentIndex];
            }
          }

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
            console.error("Speech error:", event.error);
            voiceFeedbackDiv.innerText = "Speech error: " + event.error;
            if (onEnd) onEnd();
          };

          synth.speak(utter);
        }

        speakNextSegment();
      }

      function updateUI() {
        console.log("Updating UI for index:", index);
        spokenTextDiv.innerText = speakTexts[index].join(" ");
        displayDiv.innerHTML = displays[index].html || "";
        rowCounterDiv.innerText = \`Row: \${index + 1} of \${speakTexts.length}\`;
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
          if (paused) {
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

      var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      var recognition;
      if (!SpeechRecognition) {
        alert("Speech recognition not supported. Use Chrome for full functionality.");
      } else {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onresult = function(event) {
          for (var i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              var spokenText = event.results[i][0].transcript.trim().toLowerCase();
              console.log("Heard:", spokenText);
              voiceFeedbackDiv.innerText = "Heard: " + spokenText;

              if (spokenText.includes("next") || spokenText.includes("forward") || spokenText.includes("go on")) {
                showLoading("next");
                controlSpeech("next");
              } else if (spokenText.includes("back") || spokenText.includes("prev") || spokenText.includes("previous")) {
                showLoading("back");
                controlSpeech("back");
              } else if (spokenText.includes("respeak") || spokenText.includes("again") || spokenText.includes("repeat")) {
                showLoading("respeak");
                controlSpeech("respeak");
              } else if (spokenText.includes("postcode") || spokenText.includes("post code")) {
                showLoading("postcode");
                controlSpeech("postcode");
              } else if (spokenText.includes("restart") || spokenText.includes("start")) {
                showLoading("restart");
                controlSpeech("restart");
              }
              recognition.stop();
              recognition.start();
            }
          }
        };

        recognition.onerror = function(event) {
          console.error("Speech recognition error:", event.error);
          voiceFeedbackDiv.innerText = "Speech recognition error: " + event.error;
          hideLoading();
        };

        recognition.onend = function() {
          recognition.start();
          console.log("Recognition restarted");
        };
        
        recognition.start();
      }

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
              speakLine(speakTexts[index], function() {});
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

  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(1100).setHeight(1300), "Speak Products");
}