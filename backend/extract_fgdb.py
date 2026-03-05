import sys
import json
import fiona
import geopandas as gpd
import zipfile
import tempfile
import os
import shutil

def process_fgdb(zip_path, mode, target_feature_no=None):
    """
    Extracts a .gdb.zip and processes the FGDB.
    Mode 'list': Returns a list of available Feature Numbers in the 'Man-Made Features' layer.
    Mode 'extract': Returns GeoJSON of the specific Feature Number.
    """
    temp_dir = tempfile.mkdtemp()
    
    try:
        # Extract the zip file
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(temp_dir)
            
        # Find the .gdb directory inside the extracted contents
        gdb_dir = None
        for root, dirs, files in os.walk(temp_dir):
            for d in dirs:
                if d.endswith('.gdb'):
                    gdb_dir = os.path.join(root, d)
                    break
            if gdb_dir:
                break
                
        if not gdb_dir:
            return {"error": "No .gdb directory found inside the zip file."}
            
        # Check layers
        layers = fiona.listlayers(gdb_dir)
        target_layer = None
        
        # Look for a layer that might contain Man-Made Features
        for layer in layers:
            # You can adjust this matching logic based on the actual layer name in the CEDD FGDB
            if "man_made" in layer.lower() or "manmade" in layer.lower() or "feature" in layer.lower():
                target_layer = layer
                break
                
        if not target_layer:
            # Fallback to the first layer if we can't find a specifically named one
            if layers:
                target_layer = layers[0]
            else:
                return {"error": "No layers found in the FGDB."}

        # Read the layer
        gdf = gpd.read_file(gdb_dir, layer=target_layer)
        
        # We need to find the column that holds the Feature Number.
        # It might be named "FEATURE_NO", "FeatureNo", "ID", etc.
        feature_col = None
        for col in gdf.columns:
            if "feature" in col.lower() and "no" in col.lower() or "id" in col.lower():
                feature_col = col
                break
                
        if not feature_col:
            # If we really can't guess, just use the first column that isn't the geometry
            feature_col = [c for c in gdf.columns if c != 'geometry'][0]

        if mode == 'list':
            # Drop NaN and get unique features
            features = gdf[feature_col].dropna().astype(str).unique().tolist()
            return {"features": sorted(features)}
            
        elif mode == 'extract' and target_feature_no:
            # Filter the GeoDataFrame
            filtered_gdf = gdf[gdf[feature_col].astype(str) == str(target_feature_no)]
            
            if filtered_gdf.empty:
                return {"error": f"Feature {target_feature_no} not found."}
                
            # Convert to EPSG:4326 (WGS84) for Leaflet if it's not already
            if filtered_gdf.crs and filtered_gdf.crs.to_epsg() != 4326:
                filtered_gdf = filtered_gdf.to_crs(epsg=4326)
                
            # Get GeoJSON
            geojson_str = filtered_gdf.to_json()
            return json.loads(geojson_str)
            
    except Exception as e:
        return {"error": str(e)}
        
    finally:
        # Clean up the temporary directory
        shutil.rmtree(temp_dir, ignore_errors=True)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Insufficient arguments."}))
        sys.exit(1)
        
    zip_path = sys.argv[1]
    mode = sys.argv[2] # 'list' or 'extract'
    target_feature = sys.argv[3] if len(sys.argv) > 3 else None
    
    result = process_fgdb(zip_path, mode, target_feature)
    print(json.dumps(result))
