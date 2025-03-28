import "./App.scss";

import type { ScreenViewport } from "@itwin/core-frontend";
import { 
  IModelApp, 
  NoRenderApp,
  StandardViewId, 
  Marker, 
  DecorateContext,
  Decorator
} from "@itwin/core-frontend";
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

import { Point2d, Point3d, XYAndZ } from "@itwin/core-geometry";
import { Auth } from "./Auth";
import { history } from "./history";

import { BackgroundMapType } from "@itwin/core-common";

class SensorMarker extends Marker {
  private static _height = 40;
  private _onClickCallback: () => void;

  constructor(worldLocation: Point3d, label: string, onClick: () => void) {
    // Create a default size based on the static height
    super(worldLocation, new Point2d(SensorMarker._height, SensorMarker._height));
    
    this._onClickCallback = onClick;
    this.title = `Displacement Sensor: ${label}`;
    this.setImageUrl("/images/icons8-sensor-96.png");
    this.label = label;
    this.labelOffset = { x: 0, y: 30 };
  }

  public override onMouseButton(ev: any): boolean {
    if (ev.button === 0) {
      this._onClickCallback();
      return true;
    }
    return false;
  }
}

// Following the Bentley tutorial exactly
class SensorDecorator implements Decorator {
  private _markers: SensorMarker[] = [];

  public constructor() {
    this._markers = [];
  }

  public addMarker(marker: SensorMarker): void {
    this._markers.push(marker);
  }

  public decorate(context: DecorateContext): void {
    this._markers.forEach((marker) => marker.addDecoration(context));
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
        
        // Create the sensor decorator
        const sensorDecorator = new SensorDecorator();
        
        // Add it to the viewport
        IModelApp.viewManager.addDecorator(sensorDecorator);

        // Function to create a marker at specific world coordinates
        const createMarkerAtXYZ = (x: number, y: number, z: number, label: string): SensorMarker => {
          const worldLocation = new Point3d(x, y, z);
          const marker = new SensorMarker(worldLocation, label, () => setShowVideo(true));
          sensorDecorator.addMarker(marker);
          return marker;
        };

        // The tutorial doesn't use geolocations directly, so let's use world coordinates initially
        // We'll create markers at specific locations
        createMarkerAtXYZ(0, 0, 10, "Virtual Sensor 1");
        createMarkerAtXYZ(5, 0, 10, "Virtual Sensor 2");
        createMarkerAtXYZ(10, 0, 10, "Virtual Sensor 3");

        // Try to set the view to show the markers
        const viewFlags = vp.view.viewFlags.clone();
        viewFlags.renderMode = 1; // Use realistic rendering
        vp.view.setViewFlags(viewFlags);

        // Set a good starting view
        vp.view.lookAt({ eye: [5, -20, 20], target: [5, 0, 0] });
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
