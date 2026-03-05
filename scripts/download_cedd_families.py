import urllib.request
import zipfile
import os

URLS = [
    # Tree Rings
    "https://www.cedd.gov.hk/filemanager/eng/content_985/STE-OTR-CSH-TreeRing-__.zip",
    # Soil Nails
    "https://www.cedd.gov.hk/filemanager/eng/content_985/GSM-SON-CSH-SoilNail-01.zip",
    "https://www.cedd.gov.hk/filemanager/eng/content_985/GSM-SON-CSH-SoilNail-02.zip",
    "https://www.cedd.gov.hk/filemanager/eng/content_985/GSM-SON-CSH-SoilNail-03.zip",
    "https://www.cedd.gov.hk/filemanager/eng/content_985/GSM-SON-CSH-SoilNail-04.zip",
    "https://www.cedd.gov.hk/filemanager/eng/content_985/GSM-SON-CSH-SoilNail-05.zip",
    # U-Channels
    "https://www.cedd.gov.hk/filemanager/eng/content_985/GSM-SUP-CSH-UChannelA-01.zip",
    "https://www.cedd.gov.hk/filemanager/eng/content_985/GSM-SUP-CSH-UChannelB-01.zip",
    "https://www.cedd.gov.hk/filemanager/eng/content_985/GSM-SUP-CSH-UChannelB-02.zip",
    "https://www.cedd.gov.hk/filemanager/eng/content_985/GSM-SUP-CSH-Connection-__.zip",
    "https://www.cedd.gov.hk/filemanager/eng/content_985/GSM-SUP-CSH-UChannelUpStand-__.zip",
    "https://www.cedd.gov.hk/filemanager/eng/content_985/GSM-SUP-CSH-UChannelAndBox-__.zip",
    # Hoarding
    "https://www.cedd.gov.hk/filemanager/eng/content_986/EHO-SIT-CSH-Hoarding-01_r1.zip",
    "https://www.cedd.gov.hk/filemanager/eng/content_986/EHO-SIT-CSH-Hoarding-02_r1.zip",
    "https://www.cedd.gov.hk/filemanager/eng/content_986/EHO-SIT-CSH-Hoarding-03.zip"
]

TARGET_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "CEDDSlopeModeler", "Families")

def download_and_extract():
    if not os.path.exists(TARGET_DIR):
        os.makedirs(TARGET_DIR)

    for url in URLS:
        filename = url.split("/")[-1]
        zip_path = os.path.join(TARGET_DIR, filename)

        print(f"Downloading {filename}...")
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response, open(zip_path, 'wb') as out_file:
                out_file.write(response.read())
            
            print(f"Extracting {filename}...")
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(TARGET_DIR)
            
            # Clean up the zip file
            os.remove(zip_path)
        except Exception as e:
            print(f"Failed to process {filename}: {e}")

    print("All downloads complete!")

if __name__ == "__main__":
    download_and_extract()
