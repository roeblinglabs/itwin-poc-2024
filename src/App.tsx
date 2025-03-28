import "./App.scss";

import type { ScreenViewport } from "@itwin/core-frontend";
import { FitViewTool, IModelApp, StandardViewId, Marker, DecorateContext, MarkerSet } from "@itwin/core-frontend";
import { FillCentered } from "@itwin/core-react";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ProgressLinear } from "@itwin/itwinui-react";
import {
  MeasurementActionToolbar,
  MeasureTools,
  MeasureToolsUiItemsProvider,
} from "@itwin/measure-tools-react";
import {
  useAccessToken,
  Viewer,
} from "@itwin/web-viewer-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { Point2d, Point3d } from "@itwin/core-geometry";
import { Auth } from "./Auth";
import { history } from "./history";

import { BackgroundMapType } from "@itwin/core-common";

// Following Bentley's tutorial pattern
export class DisplacementSensorMarker extends Marker {
  private static _height = 40; // Default height for markers
  private _onMouseButtonCallback: any;

  constructor(worldLocation: Point3d, title: string, onMouseButtonCallback: any) {
    // Create a default size based on the static height
    // Using 1:1 aspect ratio for simplicity
    const size = new Point2d(DisplacementSensorMarker._height, DisplacementSensorMarker._height);
    
    super(worldLocation, size);
    
    this._onMouseButtonCallback = onMouseButtonCallback;
    this.title = title;
    
    // Set image URL (we'll use setImageUrl instead of setImage since we don't have the HTMLImageElement directly)
    this.setImageUrl("/images/icons8-sensor-96.png");
    
    // Set label properties
    this.label = title.replace("Displacement Sensor: ", "");
    this.labelOffset = { x: 0, y: 30 };
  }

  // Override the onMouseButton method to use our callback
  public override onMouseButton(ev: any): boolean {
    if (ev.button === 0) {
      this._onMouseButtonCallback();
      return true;
    }
    return false;
  }
}

const App: React.FC = () => {
  const [iModelId, setIModelId] = useState(process.env.IMJS_IMODEL_ID);
  const [iTwinId, setITwinId] = useState(process.env.IMJS_ITWIN_ID);
  const [MapboxKey] = useState(process.env.REACT_APP_IMJS_MAPBOX_MAPS_KEY ?? "");
  const [CesiumKey] = useState(process.env.REACT_APP_IMJS_CESIUM_ION_KEY ?? "");
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

  const viewCreatorOptions = useMemo(() => {
    return {
      viewportConfigurer: async (vp: ScreenViewport) => {
        // Set background map
        vp.changeBackgroundMapProvider({
          name: "MapBoxProvider",
          type: BackgroundMapType.Aerial,
        });
        
        vp.changeBackgroundMapProps({
          applyTerrain: true,
          nonLocatable: true,
        });
        
        // Enable reality models - using direct property access
        const displayStyle = vp.view.displayStyle;
        displayStyle.settings.backgroundMap.enabled = true;

        try {
          // Following Bentley tutorial approach for decorators
          class SensorDecorator {
            private _markers: DisplacementSensorMarker[] = [];
            
            public constructor(markers: DisplacementSensorMarker[]) {
              this._markers = markers;
            }
            
            public decorate(context: DecorateContext): void {
              this._markers.forEach((marker) => marker.addDecoration(context));
            }
          }
          
          // Helper function to convert lat/lon to spatial coordinates
          const createGeoMarker = async (
            latitude: number, 
            longitude: number, 
            height: number, 
            label: string
          ): Promise<DisplacementSensorMarker | undefined> => {
            try {
              // Convert geographic to spatial coordinates
              const geoCoord = { latitude, longitude, height };
              const spatialLocation = await vp.iModel.geoServices.spatialFromGeoCoordinates(geoCoord);
              
              // Create marker following the tutorial pattern
              return new DisplacementSensorMarker(
                spatialLocation,
                `Displacement Sensor: ${label}`,
                () => setShowVideo(true)
              );
            } catch (error) {
              console.error(`Error creating marker ${label}:`, error);
              return undefined;
            }
          };
          
          // Create markers at your specified coordinates
          const markers: DisplacementSensorMarker[] = [];
          
          const marker1 = await createGeoMarker(42.466527, -71.355628, 200, "Virtual Sensor 1");
          if (marker1) markers.push(marker1);
          
          const marker2 = await createGeoMarker(42.466565, -71.355720, 200, "Virtual Sensor 2");
          if (marker2) markers.push(marker2);
          
          const marker3 = await createGeoMarker(42.466597, -71.355799, 200, "Virtual Sensor 3");
          if (marker3) markers.push(marker3);
          
          // Create and add the decorator
          const decorator = new SensorDecorator(markers);
          IModelApp.viewManager.addDecorator(decorator);
          
          // Focus the view after a delay
          setTimeout(() => {
            vp.zoomToElements(markers.map(m => m.location), { animateFrustumChange: true });
          }, 1000);
          
        } catch (error) {
          console.error("Error creating geolocated markers:", error);
        }
      },
    };
  }, []);

  const onIModelAppInit = useCallback(async () => {
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
            src="https://www.youtube.com/embed/HZOfR7NVNtA?autoplay=1"
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
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
        tileAdmin={{ cesiumIonKey: CesiumKey }}
      />
    </div>
  );
};

export default App;
