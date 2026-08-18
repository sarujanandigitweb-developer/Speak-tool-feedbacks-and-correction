from flask import Flask, render_template, request, redirect, url_for
import os
import re
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from bs4 import BeautifulSoup

app = Flask(__name__)

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Google Sheets API credentials setup
creds = Credentials.from_service_account_file(
    r'C:\speak_tool\service-account-file.json',
    scopes=['https://www.googleapis.com/auth/spreadsheets']
)
service = build('sheets', 'v4', credentials=creds)

# Google Spreadsheet ID
SPREADSHEET_ID = '1KyC8IONfHAlufQvsRKUfqDAUran0EQ3OC0MOHanRRfY'

def get_pack_size_from_sku(sku):
    """
    This function maps the SKU suffix to the corresponding pack size.
    """
    pack_code_map = {
        '2PK': 2, '3PK': 3, '4PK': 4, '5PK': 5, '6PK': 6,
        '7PK': 7, '8PK': 8, '9PK': 9, 'APK': 10, 'CPK': 20,
        'DPK': 30, 'EPK': 50, 'FPK': 100, 'NPK': 200, 'PPK': 300,
        'QPK': 500, 'RPK': 1000
    }
    suffix = sku[-3:].upper() if len(sku) >= 3 else ''
    return pack_code_map.get(suffix, 1)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    """
    Handles the file upload and processing of the HTML files.
    After processing the files, the data is written to Google Sheets.
    """
    files = request.files.getlist("file")
    if not files:
        return redirect(request.url)

    filepaths = []
    for file in files:
        if file.filename == '':
            return redirect(request.url)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
        file.save(filepath)
        filepaths.append(filepath)

    all_data = []
    for filepath in filepaths:
        all_data.extend(process_file_and_get_data(filepath))

    write_to_google_sheets(all_data)
    return redirect(url_for('index'))

def process_file_and_get_data(filepath):
    """
    Processes the uploaded file and extracts the order details,
    including SKU, quantity, price, customer, address, etc.
    """
    data = []
    merge_order_counter = 1  # Initialize counter to track merge order numbers
    previous_merge_order = ""  # Track the last merge order for the same set

    try:
        with open(filepath, "r", encoding="utf-8") as f:
            soup = BeautifulSoup(f, "html.parser")

        orders = soup.select("li.bg-white")

        for order in orders:
            # Default status as empty
            status = ""
            set_status = ""

            # Extracting set status for 'zzzmerge_order' or other conditions
            set_elem = order.select_one("div.bg-warning.border.border-white.mt-1.ps-3.rounded-2.rounded-pill")
            if set_elem:
                set_text = set_elem.get_text(strip=True)
                if "zzzmerge_order" in set_text.lower():
                    set_status = "combo"
                elif "multi_line" in set_text.lower() or "merged" in set_text.lower():
                    if previous_merge_order == "merge order":
                        # Increment the counter if there are multiple merge orders in the same batch
                        merge_order_counter += 1
                    set_status = f"merge order {merge_order_counter}"
                    previous_merge_order = "merge order"

            # Extracting other order details
            customer_blocks = order.select("div.col-2.small")
            customer = customer_blocks[1].get_text(" ", strip=True) if len(customer_blocks) > 1 else ""
            address_elem = order.select_one("div.fs-6")
            address = address_elem.get_text(" ", strip=True) if address_elem else ""
            platform_elem = order.select_one("div.bg-light.border")
            platform = platform_elem.get_text(" ", strip=True) if platform_elem else ""

            price_elem = order.select_one("div.text-end span span:nth-child(2)")
            price = price_elem.get_text(strip=True) if price_elem else ""

            # Product info extraction for merge and combo items
            product_divs = order.select("div.p-1[id$='-li']")
            for product_div in product_divs:
                try:
                    title_elem = product_div.select_one("div.fw-bold.border-bottom span, div.fw-bold.border-bottom a span")
                    title = title_elem.get_text(strip=True) if title_elem else ""

                    sku_elem = product_div.select_one("span[onclick^='copyText']")
                    sku = sku_elem.get_text(strip=True) if sku_elem else ""

                    # pack size using the new function
                    pack_size = get_pack_size_from_sku(sku)

                    qty_text = product_div.find(string=lambda t: "Quantity:" in t)
                    qty = int(qty_text.find_next(string=True).strip()) if qty_text else 1

                    adjusted_qty = qty * pack_size

                    link_elem = product_div.select_one("div.fw-bold.border-bottom a")
                    link = link_elem['href'] if link_elem and link_elem.has_attr('href') else ""

                    img_tags = product_div.select("img")
                    main_img_elem = img_tags[-1] if img_tags else None
                    main_img_url = main_img_elem['src'].strip() if main_img_elem and main_img_elem.has_attr('src') else ""

                    combo_items = product_div.select("label.col-3.mb-3")
                    has_combo = False
                    component_data = []  # Store components if available

                    if combo_items:
                        for item in combo_items:
                            combo_texts = item.select("div.text-center div.small")
                            combo_qty_elem = item.select_one("span.alert")

                            combo_sku = combo_texts[0].text.strip() if len(combo_texts) > 0 else ""
                            combo_color = combo_texts[1].text.strip() if len(combo_texts) > 1 else ""
                            combo_qty = combo_qty_elem.text.replace("x", "").strip() if combo_qty_elem else ""

                            img_elem = item.select_one("img")
                            img_url = img_elem['src'].strip() if img_elem and img_elem.has_attr('src') else ""

                            has_combo = True
                            component_data.append(f"component")  # Adding components to the list

                            data.append([title, sku, adjusted_qty, combo_sku, combo_color, combo_qty,
                                         price, link, customer, address, platform, status,
                                         img_url, set_status, ", ".join(component_data)])  # Adding component info in the new column

                    if not has_combo:
                        # For merge order or single items without combo
                        component_info = sku if set_status == "merge order" else ""
                        data.append([title, sku, adjusted_qty, "", "", "",
                                     price, link, customer, address, platform, status,
                                     main_img_url, set_status, component_info])  # Adding SKU to "Component" if it's a merge order

                except Exception as e:
                    print(f"Error parsing a product: {e}")
                    continue

    except Exception as e:
        print(f"Failed to process file {filepath}: {e}")

    return data

def write_to_google_sheets(data):
    try:
        # Add 'Component' as a new column in the header
        header = [["Title", "Combo SKU", "Quantity", "SKU", "Combo Color", "Combo Quantity",
                   "Price", "Link", "Customer Info", "Address", "Selling Platform", "Status", "Image URLs", "Merge Order", "Component"]]

        sheet = service.spreadsheets()

        # Write the header row
        sheet.values().update(
            spreadsheetId=SPREADSHEET_ID,
            range="Sheet1!A1",
            valueInputOption="RAW",
            body={"values": header}
        ).execute()

        # Write the data rows
        sheet.values().update(
            spreadsheetId=SPREADSHEET_ID,
            range="Sheet1!A2",
            valueInputOption="RAW",
            body={"values": data}
        ).execute()

        print("✅ Data successfully uploaded to Google Sheets!")

    except HttpError as err:
        print(f"❌ Google Sheets API error: {err}")

if __name__ == '__main__':
    app.run(debug=True)