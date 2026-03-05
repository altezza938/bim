using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using Autodesk.Revit.Attributes;
using NetTopologySuite.IO;
using NetTopologySuite.Geometries;

namespace CEDDSlopeModeler
{
    // DTO to hold rows representing Geo-features from the DBF table
    public class SoilNailFeature
    {
        public double X { get; set; }
        public double Y { get; set; }
        public double Z { get; set; }
        public double Azimuth { get; set; }
        public double Inclination { get; set; }
        public double Length { get; set; }
        public string HoleDia { get; set; } 
    }

    [Transaction(TransactionMode.Manual)]
    public class Command : IExternalCommand
    {
        public Result Execute(
            ExternalCommandData commandData, 
            ref string message, 
            ElementSet elements)
        {
            UIApplication uiapp = commandData.Application;
            Document doc = uiapp.ActiveUIDocument.Document;

            // Step 1: Prompt user for the path to the SHP file
            string shpFilePath = @"C:\Path\To\soil_nails.shp"; 
            string familyFilePath = @"C:\Path\To\CEDDSlopeModeler\Families\19_SON-TYP-CSH-___-___.rfa"; 
            string familySymbolName = "Nail Head_400x400"; // Example symbol name for Soil Nail

            if (!File.Exists(shpFilePath))
            {
                TaskDialog.Show("CEDD Slope Modeler", 
                    "Could not find the Shapefile (.shp). In a real environment, allow user to browse.");
                return Result.Cancelled;
            }

            // Step 2: Read Shapefile and DBF
            List<SoilNailFeature> nails = ReadShapefile(shpFilePath);
            if (nails == null || nails.Count == 0)
            {
                TaskDialog.Show("CEDD Slope Modeler", "No valid point features found in the Shapefile.");
                return Result.Failed;
            }

            // Step 3: Start Revit Transaction
            using (Transaction trans = new Transaction(doc, "Generate CEDD BIM Models (SHP Workflow)"))
            {
                trans.Start();

                // Ensure the Family is loaded
                FamilySymbol familySymbol = GetOrLoadFamilySymbol(doc, familyFilePath, familySymbolName);
                if (familySymbol == null)
                {
                    message = "Could not find or load the required CEDD Family Symbol.";
                    trans.RollBack();
                    return Result.Failed;
                }

                int count = 0;
                // Note: Revit internal units are decimal feet. 1 m = 3.28084 feet.
                double mToFt = 3.28084;

                foreach (var nail in nails)
                {
                    // Create XYZ for location
                    XYZ location = new XYZ(nail.X * mToFt, nail.Y * mToFt, nail.Z * mToFt);

                    // Place the Family Instance
                    FamilyInstance instance = doc.Create.NewFamilyInstance(
                        location, 
                        familySymbol, 
                        Autodesk.Revit.DB.Structure.StructuralType.NonStructural);

                    // 1. Azimuth Rotation (Z-Axis / Horizontal Direction)
                    // Azimuth is usually 0 = North, 90 = East, but in Revit 0 = East, 90 = North.
                    // We must convert degrees to radians and adjust axis.
                    if (nail.Azimuth != 0)
                    {
                        double azimuthRad = nail.Azimuth * (Math.PI / 180.0);
                        // Convert North-based Azimuth to East-based standard mathematical angle if necessary, 
                        // or just apply directly depending on family orientation.
                        Line zAxis = Line.CreateBound(location, location + XYZ.BasisZ);
                        ElementTransformUtils.RotateElement(doc, instance.Id, zAxis, azimuthRad);
                    }

                    // 2. Inclination Rotation (Vertical Tilt)
                    // Assuming Inclination is the downward dip from horizontal
                    if (nail.Inclination != 0)
                    {
                        double inclRad = nail.Inclination * (Math.PI / 180.0);
                        
                        // We must rotate around the local perpendicular axis, which depends on the Azimuth.
                        // Calculate horizontal vector:
                        double azRad = nail.Azimuth * (Math.PI / 180.0);
                        XYZ dir = new XYZ(Math.Cos(azRad), Math.Sin(azRad), 0).Normalize();
                        
                        // Cross product with Z to get the horizontal pitch axis
                        XYZ horizontalPitchAxis = dir.CrossProduct(XYZ.BasisZ).Normalize();
                        
                        Line pitchAxisLine = Line.CreateBound(location, location + horizontalPitchAxis);
                        ElementTransformUtils.RotateElement(doc, instance.Id, pitchAxisLine, inclRad);
                    }

                    // 3. Set custom parameters defined in the CEDD rfa
                    SetParameter(instance, "Overall Length", nail.Length * mToFt);
                    SetParameter(instance, "Hole Dia", nail.HoleDia);

                    count++;
                }

                trans.Commit();
                TaskDialog.Show("Success", $"Successfully generated {count} CEDD Soil Nails from Shapefile attributes.");
            }

            return Result.Succeeded;
        }

        private void SetParameter(FamilyInstance instance, string paramName, object value)
        {
            Parameter param = instance.LookupParameter(paramName);
            if (param != null && !param.IsReadOnly)
            {
                if (value is double dList) param.Set(dList);
                else if (value is string sList) param.Set(sList);
            }
        }

        private List<SoilNailFeature> ReadShapefile(string shpPath)
        {
            var features = new List<SoilNailFeature>();
            try
            {
                // NetTopologySuite built-in Shapefile reader
                using (var reader = new ShapefileDataReader(shpPath, new GeometryFactory()))
                {
                    while (reader.Read())
                    {
                        var geom = reader.Geometry;
                        if (geom is NetTopologySuite.Geometries.Point pt)
                        {
                            var feature = new SoilNailFeature
                            {
                                X = pt.X,
                                Y = pt.Y,
                                Z = pt.Coordinate.Z > 0 || pt.Coordinate.Z < 0 ? pt.Coordinate.Z : 0 // Some SHPs don't have true Z
                            };

                            // Read attributes from DBF
                            // Property names depend exactly on the generated Shapefile columns
                            try { feature.Azimuth = Convert.ToDouble(reader["Azimuth"] ?? 0); } catch { }
                            try { feature.Inclination = Convert.ToDouble(reader["Inclin"] ?? 0); } catch { }
                            try { feature.Length = Convert.ToDouble(reader["Length"] ?? 0); } catch { }
                            try { feature.HoleDia = Convert.ToString(reader["HoleDia"]) ?? ""; } catch { }

                            features.Add(feature);
                        }
                    }
                }
                return features;
            }
            catch(Exception e)
            {
                TaskDialog.Show("SHP Error", "Error reading Shapefile/DBF: " + e.Message);
                return null;
            }
        }

        private FamilySymbol GetOrLoadFamilySymbol(Document doc, string rfaPath, string symbolName)
        {
            FilteredElementCollector collector = new FilteredElementCollector(doc)
                .OfClass(typeof(FamilySymbol));

            foreach (FamilySymbol symbol in collector)
            {
                if (symbol.Name == symbolName)
                {
                    if (!symbol.IsActive) symbol.Activate();
                    return symbol;
                }
            }

            if (doc.LoadFamily(rfaPath, out Family family))
            {
                ISet<ElementId> symbolIds = family.GetFamilySymbolIds();
                foreach (ElementId id in symbolIds)
                {
                    FamilySymbol symbol = doc.GetElement(id) as FamilySymbol;
                    if (symbol != null && symbol.Name == symbolName)
                    {
                        if (!symbol.IsActive) symbol.Activate();
                        return symbol;
                    }
                }
                
                ElementId firstId = symbolIds.FirstOrDefault();
                if (firstId != ElementId.InvalidElementId)
                {
                    FamilySymbol firstSymbol = doc.GetElement(firstId) as FamilySymbol;
                    if (!firstSymbol.IsActive) firstSymbol.Activate();
                    return firstSymbol;
                }
            }
            return null;
        }
    }
}
