using System;
using System.Reflection;
using Autodesk.Revit.UI;
using Autodesk.Revit.DB;

namespace CEDDSlopeModeler
{
    public class App : IExternalApplication
    {
        public Result OnStartup(UIControlledApplication application)
        {
            try
            {
                // Create a custom ribbon tab
                string tabName = "CEDD BIM";
                application.CreateRibbonTab(tabName);

                // Add a new ribbon panel
                RibbonPanel ribbonPanel = application.CreateRibbonPanel(tabName, "Slope Modeling");

                // Create a push button to trigger the command
                string thisAssemblyPath = Assembly.GetExecutingAssembly().Location;
                PushButtonData buttonData = new PushButtonData("cmdGenerateSlopeBIM",
                    "Generate\nBIM Model", thisAssemblyPath, "CEDDSlopeModeler.Command");

                PushButton pushButton = ribbonPanel.AddItem(buttonData) as PushButton;
                pushButton.ToolTip = "Reads CSV/DGN data and generates Soil Nails, U-Channels, and Hoarding using CEDD BIM Families.";

                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                TaskDialog.Show("Error", ex.Message);
                return Result.Failed;
            }
        }

        public Result OnShutdown(UIControlledApplication application)
        {
            return Result.Succeeded;
        }
    }
}
