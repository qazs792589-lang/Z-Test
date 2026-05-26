import json

file_path = r'e:\Google Antigravity資料\Z-Money-\Z-Money-FullBackup-2026-05-04.json'

# Excel data provided in screenshot
new_twii_data = [
    {"date": "2026-01-02", "ticker": "^TWII", "price": 29349.81},
    {"date": "2026-01-09", "ticker": "^TWII", "price": 30360.55},
    {"date": "2026-01-16", "ticker": "^TWII", "price": 30941.78},
    {"date": "2026-01-23", "ticker": "^TWII", "price": 31759.99},
    {"date": "2026-01-30", "ticker": "^TWII", "price": 32063.75},
    {"date": "2026-02-06", "ticker": "^TWII", "price": 31801.27},
    {"date": "2026-02-26", "ticker": "^TWII", "price": 35414.49},
    {"date": "2026-03-07", "ticker": "^TWII", "price": 33672.94},
    {"date": "2026-03-13", "ticker": "^TWII", "price": 32771.87},
    {"date": "2026-03-20", "ticker": "^TWII", "price": 33543.88},
    {"date": "2026-03-27", "ticker": "^TWII", "price": 33337.62},
    {"date": "2026-04-02", "ticker": "^TWII", "price": 32572.43},
    {"date": "2026-04-10", "ticker": "^TWII", "price": 35417.83},
    {"date": "2026-04-17", "ticker": "^TWII", "price": 36804.34},
    {"date": "2026-04-24", "ticker": "^TWII", "price": 38932.4},
    {"date": "2026-04-30", "ticker": "^TWII", "price": 38926.63}
]

with open(file_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Remove old TWII data and add new data
data['weeklyPrices'] = [p for p in data['weeklyPrices'] if p['ticker'] != '^TWII']
data['weeklyPrices'].extend(new_twii_data)
data['weeklyPrices'].sort(key=lambda x: (x['date'], x['ticker']))

with open(file_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("Updated TAIEX data successfully.")
