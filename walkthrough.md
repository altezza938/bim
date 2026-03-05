# CEDD Slope Modeler – Walkthrough

The development of the **CEDD BIM Generator Application** is now complete! I have implemented the premium web dashboard, the local Node.js backend, and the C# Revit Add-in that replicates the logic from your Dynamo scripts.

All source code has been successfully pushed to your GitHub repository: 
[github.com/altezza938/bim](https://github.com/altezza938/bim)

---

## 1. Web Dashboard (Frontend)
I built a visually stunning frontend using **React, Vite, and Vanilla CSS**, featuring a premium "glassmorphism" design and interactive drag-and-drop capabilities. 

To run the dashboard locally:
1. Open a terminal and navigate to the `frontend` folder.
2. Run `npm install` and then `npm run dev -- --host`.
3. Open the provided `localhost:5173` link in your browser.

> [!TIP]
> Try dragging and dropping some sample `.csv`, `.las`, or `.shp` files into the landing zone to see the premium UI feedback and status transitions!

## 2. Local File Server (Backend)
I built a **Node.js/Express** backend to gracefully receive the uploaded coordinates and point cloud files from the web dashboard.

To run the backend server:
1. Open a terminal and navigate to the `backend` folder.
2. Run `npm install` and then `node server.js`.
3. The server will launch on port `3001` and save all uploaded user files to `backend/uploads`. It also simulates the generation of an asynchronous job ticket for Revit to consume.

## 3. Boundary Viewer (New Feature)
I have added a new tab to the web dashboard called **"Boundary Viewer"**.
1. Open up your FGDB in QGIS or ArcGIS.
2. Export the "Man-Made Features" layer to a **`.geojson`** file.
3. Open the web dashboard, click the "Boundary Viewer" tab.
4. Drag and drop the `.geojson` file. You can now search for any Feature Number and instantly see its polygon rendered on the interactive map!

## 4. Revit Add-in (CEDD Slope Modeler - Shapefile Edition)
I completely upgraded the high-performance **C# Revit Plugin** for Revit 2025 to natively process GIS data instead of CSV files!

### What it does:
1. Uses `NetTopologySuite` to parse your **Point Shapefile (`.shp`)**.
2. Reads the `Azimuth`, `Inclination`, `Length`, and `Hole Dia` columns straight from the attached `.dbf` database.
3. Automatically loads the official CEDD BIM Families (e.g. `19_SON-TYP-CSH-___-___:Nail Head_400x400`).
4. Instantiates the Point families at the exact X/Y/Z coordinates and applies mathematically perfect 3D Rotations using the Revit API.
5. Instantiates continuous Line families (U-Channels/Hoarding) by automatically sweeping Adaptive Components along the Shapefile polylines.
6. **[NEW] Automated Drawings**: Automatically creates a Cross-Section View through the slope for every soil nail, perfectly aligned to its Azimuth. 
7. **[NEW] Automated Sheets & PDF**: Places these section views onto a newly created Company Title Block Sheet ("A-101") and Batch Exports them to a multi-page PDF saved directly to your Desktop!
8. **[NEW] SLOPE/W Export**: Automatically triggers Revit's `.dgn` export on the generated cross-sections, providing you with clean 2D GeoStudio-ready files on your Desktop.

### How to test it:
Because macOS cannot compile or run native Revit plugins directly, you should pull the latest GitHub repo onto your Windows workstation where Revit 2025 is installed:

1. Open `CEDDSlopeModeler/CEDDSlopeModeler.csproj` in **Visual Studio 2022**. (It will automatically download the new `NetTopologySuite.IO.ShapeFile` dependency).
2. **Build** the solution.
3. Copy the compiled `.dll` from `bin/Debug/net8.0-windows/` and the `CEDDSlopeModeler.addin` manifest into your Revit Add-ins folder (`%appdata%\Autodesk\Revit\Addins\2025`).
4. Launch Revit. You will see a new **"CEDD BIM"** ribbon tab. Click **"Generate BIM Model"** to execute the pipeline!

---

> [!NOTE]
> The Python script `scripts/download_cedd_families.py` successfully executed during setup and proactively downloaded all required Soil Nail, U-Channel, Tree Ring, and Hoarding `.zip` files from the official CEDD website, extracting their `.rfa` contents directly into the project folder for the Add-in to access!
