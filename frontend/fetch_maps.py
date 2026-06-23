import urllib.request
import json
import os

maps = {
    "world": "https://raw.githubusercontent.com/apache/echarts/master/test/data/map/json/world.json",
    "usa": "https://raw.githubusercontent.com/apache/echarts/master/test/data/map/json/usa.json",
    "india": "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/india.geojson"
}

out_dir = r"D:\MediQuery\frontend\public\maps"
os.makedirs(out_dir, exist_ok=True)

for name, url in maps.items():
    path = os.path.join(out_dir, f"{name}.json")
    print(f"Downloading {name}...")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(data, f)
        print(f"Saved {name}.json")
    except Exception as e:
        print(f"Error downloading {name}: {e}")
