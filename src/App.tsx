import "./App.scss";

import type { ScreenViewport } from "@itwin/core-frontend";
import { FitViewTool, IModelApp, StandardViewId, Marker, DecorateContext } from "@itwin/core-frontend";
import { FillCentered } from "@itwin/core-react";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ProgressLinear } from "@itwin/itwinui-react";
import {
  MeasurementActionToolbar,
  MeasureTools,
  MeasureToolsUiItemsProvider,
} from "@itwin/measure-tools-react";

import {
  AncestorsNavigationControls,
  CopyPropertyTextContextMenuItem,
  PropertyGridManager,
  PropertyGridUiItemsProvider,
  ShowHideNullValuesSettingsMenuItem,
} from "@itwin/property-grid-react";
import {
  CategoriesTreeComponent,
  createTreeWidget,
  ModelsTreeComponent,
  TreeWidget,
} from "@itwin/tree-widget-react";
import {
  useAccessToken,
  Viewer,
  ViewerContentToolsProvider,
  ViewerNavigationToolsProvider,
  ViewerPerformance,
  ViewerStatusbarItemsProvider,
} from "@itwin/web-viewer-react";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { Point3d } from "@itwin/core-geometry";
import { Auth } from "./Auth";
import { history } from "./history";
import { getSchemaContext, unifiedSelectionStorage } from "./selectionStorage";

import { BackgroundMapType } from "@itwin/core-common";

export class DisplacementSensorMarker extends Marker {
  constructor(location: Point3d, size: { x: number; y: number }, label: string, onClick: () => void) {
    super(location, size);

    this.title = `Displacement Sensor: ${label}`;
    this.setImageUrl("/images/icons8-sensor-96.png");
    this.label = label;
    this.labelOffset = { x: 0, y: 30 };

    this.onMouseButton = (ev) => {
      if (ev.button === 0) {
        onClick(); // Call the provided onClick function
        return true;
      }
      return false;
    };
  }
}

const App: React.FC = () => {
  const [iModelId, setIModelId] = useState(process.env.IMJS_IMODEL_ID);
  const [iTwinId, setITwinId] = useState(process.env.IMJS_ITWIN_ID);
  const [MapboxKey] = useState(process.env.REACT_APP_IMJS_MAPBOX_MAPS_KEY ?? "");
  //const [CesiumKey] = useState(process.env.REACT_APP_IMJS_CESIUM_ION_KEY ?? "");
  const [changesetId, setChangesetId] = useState(process.env.IMJS_AUTH_CLIENT_CHANGESET_ID);
  const [showVideo, setShowVideo] = useState(false);

  const accessToken = useAccessToken();
  const authClient = Auth.getClient();

  const login = useCallback(async () => {
    try {
      await authClient.signInSilent();
    } catch {
      await authClient.signIn();
    }
  }, [authClient]);

  useEffect(() => {
    void login();
  }, [login]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("iTwinId")) {
      setITwinId(urlParams.get("iTwinId") as string);
    }
    if (urlParams.has("iModelId")) {
      setIModelId(urlParams.get("iModelId") as string);
    }
    if (urlParams.has("changesetId")) {
      setChangesetId(urlParams.get("changesetId") as string);
    }
  }, []);

  useEffect(() => {
    let url = `viewer?iTwinId=${iTwinId}`;
    if (iModelId) url = `${url}&iModelId=${iModelId}`;
    if (changesetId) url = `${url}&changesetId=${changesetId}`;
    history.push(url);
  }, [iTwinId, iModelId, changesetId]);

  //** NOTE: This function will execute the "Fit View" tool after the iModel is loaded into the Viewer.
  const viewConfiguration = useCallback((viewPort: ScreenViewport) => {
    // default execute the fitview tool and use the iso standard view after tile trees are loaded
    const tileTreesLoaded = () => {
      return new Promise((resolve, reject) => {
        const start = new Date();
        const intvl = setInterval(() => {
          if (viewPort.areAllTileTreesLoaded) {
            ViewerPerformance.addMark("TilesLoaded");
            ViewerPerformance.addMeasure(
              "TileTreesLoaded",
              "ViewerStarting",
              "TilesLoaded"
            );
            clearInterval(intvl);
            resolve(true);
          }
          const now = new Date();
          // after 20 seconds, stop waiting and fit the view
          if (now.getTime() - start.getTime() > 20000) {
            reject();
          }
        }, 100);
      });
    };

    tileTreesLoaded().finally(() => {
      void IModelApp.tools.run(FitViewTool.toolId, viewPort, true, false);
      viewPort.view.setStandardRotation(StandardViewId.Iso);
    });
  }, []);

  const viewCreatorOptions = useMemo(() => {
    return {
      viewportConfigurer: async (vp: ScreenViewport) => {
        vp.changeBackgroundMapProvider({
          name: "MapBoxProvider",
          type: BackgroundMapType.Aerial,
        });
        
        vp.changeBackgroundMapProps({
          applyTerrain: true,
          nonLocatable: true,
        });
        
        class MarkerDecorator {
          private displacementMarkers: Marker[];

          constructor(displacementMarkers: Marker[]) {
            this.displacementMarkers = displacementMarkers;
          }

          public decorate(context: DecorateContext): void {
            this.displacementMarkers.forEach((marker) => marker.addDecoration(context));
          }
        }

        const displacementMarkers = [
          new DisplacementSensorMarker(new Point3d(306331.2565266246, 4704271.129384595, 34.838430597992144), { x: 40, y: 40 }, "Virtual Sensor 1", () => setShowVideo(true)),
          new DisplacementSensorMarker(new Point3d(306324.8776, 4704274.6196, 34.791), { x: 40, y: 40 }, "Virtual Sensor 2", () => setShowVideo(true)),
          new DisplacementSensorMarker(new Point3d(306337.5113, 4704266.9649, 34.5362), { x: 40, y: 40 }, "Virtual Sensor 3", () => setShowVideo(true)),
        ];

        const markerDecorator = new MarkerDecorator(displacementMarkers);
        IModelApp.viewManager.addDecorator(markerDecorator);
      },
    };
  }, []);

  const onIModelAppInit = useCallback(async () => {
    // iModel now initialized
    await TreeWidget.initialize();
    await PropertyGridManager.initialize();
    await MeasureTools.startup();
    MeasurementActionToolbar.setDefaultActionProvider();
  }, []);

return (
  <div className="viewer-container">
    {showVideo && (
      <div className="video-overlay">
        <iframe
          width="560"
          height="315"
          src="https://drive.google.com/file/d/1d5INEFKK-NBzB_bzKe_L7ligNSr-LbKT/preview"
          frameBorder="0"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
        ></iframe>
        <button onClick={() => setShowVideo(false)} className="close-button">
          Close
        </button>
      </div>
    )}
      {!accessToken && (
        <FillCentered>
          <div className="signin-content">
            <ProgressLinear indeterminate={true} labels={["Signing in..."]} />
          </div>
        </FillCentered>
      )}
      <Viewer
        iTwinId={iTwinId ?? ""}
        iModelId={iModelId ?? ""}
        changeSetId={changesetId}
        authClient={authClient}
        viewCreatorOptions={viewCreatorOptions}
        enablePerformanceMonitors={true}
        onIModelAppInit={onIModelAppInit}
        mapLayerOptions={{ MapboxImagery: { key: "access_token", value: MapboxKey } }}
        //tileAdmin={{ cesiumIonKey: CesiumKey }}
        backendConfiguration={{
          defaultBackend: {
            rpcInterfaces: [ECSchemaRpcInterface],
          },
        }}
        uiProviders={[
          new ViewerNavigationToolsProvider(),
          new ViewerContentToolsProvider({
            vertical: {
              measureGroup: false,
            },
          }),
          new ViewerStatusbarItemsProvider(),
          {
            id: "TreeWidgetUIProvider",
            getWidgets: () => [
              createTreeWidget({
                trees: [
                  {
                    id: ModelsTreeComponent.id,
                    getLabel: () => ModelsTreeComponent.getLabel(),
                    render: (props) => (
                      <ModelsTreeComponent
                        getSchemaContext={getSchemaContext}
                        density={props.density}
                        selectionStorage={unifiedSelectionStorage}
                        selectionMode={"extended"}
                        onPerformanceMeasured={props.onPerformanceMeasured}
                        onFeatureUsed={props.onFeatureUsed}
                      />
                    ),
                  },
                  {
                    id: CategoriesTreeComponent.id,
                    getLabel: () => CategoriesTreeComponent.getLabel(),
                    render: (props) => (
                      <CategoriesTreeComponent
                        getSchemaContext={getSchemaContext}
                        density={props.density}
                        selectionStorage={unifiedSelectionStorage}
                        onPerformanceMeasured={props.onPerformanceMeasured}
                        onFeatureUsed={props.onFeatureUsed}
                      />
                    ),
                  },
                ],
              }),
            ],
          },
          new PropertyGridUiItemsProvider({
            propertyGridProps: {
              autoExpandChildCategories: true,
              ancestorsNavigationControls: (props) => (
                <AncestorsNavigationControls {...props} />
              ),
              contextMenuItems: [
                (props) => <CopyPropertyTextContextMenuItem {...props} />,
              ],
              settingsMenuItems: [
                (props) => (
                  <ShowHideNullValuesSettingsMenuItem
                    {...props}
                    persist={true}
                  />
                ),
              ],
            },
          }),
          new MeasureToolsUiItemsProvider(),
        ]}
        selectionStorage={unifiedSelectionStorage}
        getSchemaContext={getSchemaContext}
      />
    </div>
  );
};
export default App;
