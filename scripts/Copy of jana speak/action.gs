function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('🗣 Speak Tool')
    .addItem('Speak All Rows', 'readRowAndSpeak')
    .addToUi();
}
