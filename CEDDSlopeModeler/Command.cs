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
    // DTO for discrete points (Soil Nails, Tree Rings)
    public class PointFeature
    {
        public double X { get; set; }
        public double Y { get; set; }
        public double Z { get; set; }
        public double Azimuth { get; set; }
        public double Inclination { get; set; }
        public double Length { get; set; }
        public string HoleDia { get; set; } 
    }

    // DTO for continuous elements (U-Channels, Hoarding)
    public class LineFeature
    {
        public List<XYZ> Vertices { get; set; } = new List<XYZ>();
        public string TypeName { get; set; }
    }

    [Transaction(TransactionMode.Manual)]
    public class Command : IExternalCommand
    {
        // Conversion factor (meters to decimal feet)
        private const double mToFt = 3.28084;

        public Result Execute(
            ExternalCommandData commandData, 
            ref string message, 
            ElementSet elements)
        {
            UIApplication uiapp = commandData.Application;
            Document doc = uiapp.ActiveUIDocument.Document;

            // Step 1: Prompt user for the path to the SHP file and target family
            string shpFilePath = @"C:\Path\To\features.shp"; 
            string familyFilePath = @"C:\Path\To\CEDDSlopeModeler\Families\19_SON-TYP-CSH-___-___.rfa"; 
            string familySymbolName = "Nail Head_400x400"; // Can be changed based on UI selection

            if (!File.Exists(shpFilePath))
            {
                TaskDialog.Show("CEDD Slope Modeler", "Could not find the Shapefile (.shp).");
                return Result.Cancelled;
            }

            // Step 2: Read Shapefile and DBF
            var (points, lines) = ReadShapefile(shpFilePath);

            if (points.Count == 0 && lines.Count == 0)
            {
                TaskDialog.Show("CEDD Slope Modeler", "No valid point or line geometries found in the Shapefile.");
                return Result.Failed;
            }

            // Step 3: Start Revit Transaction
            using (Transaction trans = new Transaction(doc, "Generate CEDD BIM Models (SHP Workflow)"))
            {
                trans.Start();

                FamilySymbol familySymbol = GetOrLoadFamilySymbol(doc, familyFilePath, familySymbolName);
                if (familySymbol == null)
                {
                    message = "Could not find or load the required CEDD Family Symbol.";
                    trans.RollBack();
                    return Result.Failed;
                }

                int pointCount = 0;
                int lineCount = 0;

                // 3a: Process Point Features (Soil Nails, Tree Rings)
                foreach (var ptFeature in points)
                {
                    XYZ location = new XYZ(ptFeature.X * mToFt, ptFeature.Y * mToFt, ptFeature.Z * mToFt);
                    FamilyInstance instance = doc.Create.NewFamilyInstance(location, familySymbol, Autodesk.Revit.DB.Structure.StructuralType.NonStructural);

                    // Azimuth Rotation
                    if (ptFeature.Azimuth != 0)
                    {
                        double azimuthRad = ptFeature.Azimuth * (Math.PI / 180.0);
                        Line zAxis = Line.CreateBound(location, location + XYZ.BasisZ);
                        ElementTransformUtils.RotateElement(doc, instance.Id, zAxis, azimuthRad);
                    }

                    // Inclination Rotation
                    if (ptFeature.Inclination != 0)
                    {
                        double inclRad = ptFeature.Inclination * (Math.PI / 180.0);
                        double azRad = ptFeature.Azimuth * (Math.PI / 180.0);
                        XYZ dir = new XYZ(Math.Cos(azRad), Math.Sin(azRad), 0).Normalize();
                        XYZ horizontalPitchAxis = dir.CrossProduct(XYZ.BasisZ).Normalize();
                        
                        Line pitchAxisLine = Line.CreateBound(location, location + horizontalPitchAxis);
                        ElementTransformUtils.RotateElement(doc, instance.Id, pitchAxisLine, inclRad);
                    }

                    // Properties
                    SetParameter(instance, "Overall Length", ptFeature.Length * mToFt);
                    SetParameter(instance, "Hole Dia", ptFeature.HoleDia);
                    pointCount++;
                }

                // 3b: Process Line Features (U-Channels, Hoarding)
                foreach (var lineFeature in lines)
                {
                    // For line-based families like U-Channels, we usually build Adaptive Components 
                    // or Line-Based Generic Models in Revit. 
                    // This logic assumes `familySymbol` is a Line-Based Family (2 reference points).
                    
                    for (int i = 0; i < lineFeature.Vertices.Count - 1; i++)
                    {
                        XYZ startPt = lineFeature.Vertices[i];
                        XYZ endPt = lineFeature.Vertices[i + 1];
                        
                        // Avoid segmenting elements if distance is near zero
                        if (startPt.DistanceTo(endPt) > 0.1) 
                        {
                            Line curve = Line.CreateBound(startPt, endPt);
                            FamilyInstance instance = doc.Create.NewFamilyInstance(curve, familySymbol, doc.ActiveView);
                            lineCount++;
                        }
                    }
                }

                trans.Commit();
                TaskDialog.Show("Success", $"Successfully generated {pointCount} Points (Nails/Trees) and {lineCount} Curve Segments (Channels/Hoarding).");
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

        private (List<PointFeature>, List<LineFeature>) ReadShapefile(string shpPath)
        {
            var points = new List<PointFeature>();
            var lines = new List<LineFeature>();

            try
            {
                using (var reader = new ShapefileDataReader(shpPath, new GeometryFactory()))
                {
                    while (reader.Read())
                    {
                        var geom = reader.Geometry;

                        // Parse Points
                        if (geom is NetTopologySuite.Geometries.Point pt)
                        {
                            var feature = new PointFeature
                            {
                                X = pt.X,
                                Y = pt.Y,
                                Z = pt.Coordinate.Z > 0 || pt.Coordinate.Z < 0 ? pt.Coordinate.Z : 0
                            };

                            try { feature.Azimuth = Convert.ToDouble(reader["Azimuth"] ?? 0); } catch { }
                            try { feature.Inclination = Convert.ToDouble(reader["Inclin"] ?? 0); } catch { }
                            try { feature.Length = Convert.ToDouble(reader["Length"] ?? 0); } catch { }
                            try { feature.HoleDia = Convert.ToString(reader["HoleDia"]) ?? ""; } catch { }

                            points.Add(feature);
                        }
                        // Parse Lines
                        else if (geom is NetTopologySuite.Geometries.LineString ls)
                        {
                            var feature = new LineFeature();
                            foreach (var coord in ls.Coordinates)
                            {
                                // Handle missing Z coordinates in 2D shapefiles gracefully
                                double z = coord.Z > 0 || coord.Z < 0 ? coord.Z : 0;
                                feature.Vertices.Add(new XYZ(coord.X * mToFt, coord.Y * mToFt, z * mToFt));
                            }
                            lines.Add(feature);
                        }
                        // Parse MultiLines (often used for fragmented U-channel networks)
                        else if (geom is NetTopologySuite.Geometries.MultiLineString mls)
                        {
                            foreach (var lineString in mls.Geometries)
                            {
                                var feature = new LineFeature();
                                foreach (var coord in lineString.Coordinates)
                                {
                                    double z = coord.Z > 0 || coord.Z < 0 ? coord.Z : 0;
                                    feature.Vertices.Add(new XYZ(coord.X * mToFt, coord.Y * mToFt, z * mToFt));
                                }
                                lines.Add(feature);
                            }
                        }
                    }
                }
                return (points, lines);
            }
            catch(Exception e)
            {
                TaskDialog.Show("SHP Error", "Error reading Shapefile: " + e.Message);
                return (points, lines);
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
