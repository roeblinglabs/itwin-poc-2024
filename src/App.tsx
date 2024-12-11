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
  useAccessToken,
  Viewer,
} from "@itwin/web-viewer-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { Point3d, Cartographic, Transform } from "@itwin/core-geometry";
import { Auth } from "./Auth";
import { history } from "./history";

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
        onClick();
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
  const [CesiumKey] = useState(process.env.REACT_APP_IMJS_CESIUM_ION_KEY ?? "");
  const [changesetId, setChangesetId] = useState(process.env.IMJS_AUTH_CLIENT_CHANGESET_ID);
  const [showVideo, setShowVideo] = useState(false);
  const [realityModelId] = useState(process.env.REACT_APP_REALITY_MODEL_ID ?? "");

  const accessToken = useAccessToken();
  const authClient = Auth.getClient();

  // Lowell Road Bridge coordinates
  const BRIDGE_LOCATION = {
    latitude: 42.466602,
    longitude: -71.355709,
    elevation: 0,  // Adjust if needed based on actual bridge elevation
    rotation: Math.PI * -0.1  // Slight rotation to align with bridge orientation
  };

  const attachRealityModel = async (vp: ScreenViewport) => {
    try {
      if (!realityModelId) {
        console.error("Reality Model ID not found in environment variables");
        return;
      }

      // Create cartographic position for the bridge
      const position = Cartographic.fromDegrees({
        longitude: BRIDGE_LOCATION.longitude,
        latitude: BRIDGE_LOCATION.latitude,
        height: BRIDGE_LOCATION.elevation,
      });

      // Create transform for the model
      const transform = Transform.createOriginAndRotation(
        position,
        BRIDGE_LOCATION.rotation,
        { x: 0, y: 0, z: 1 }
      );

      // Attach the reality model
      const attachment = await IModelApp.realityDataAccess.attachRealityModel(
        vp.iModel,
        realityModelId,
        transform
      );

      console.log("Reality model attached successfully:", attachment);

      // Optionally zoom to the area
      const range = attachment.range;
      if (range) {
        vp.zoomToVolume(range);
      }
    } catch (error) {
      console.error("Error attaching reality model:", error);
    }
  };

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
        // Set up background map
        vp.changeBackgroundMapProvider({
          name: "MapBoxProvider",
          type: BackgroundMapType.Aerial,
        });
        
        vp.changeBackgroundMapProps({
          applyTerrain: true,
          nonLocatable: true,
        });
        
        // Attach reality model
        await attachRealityModel(vp);

        // Set up markers
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
          new DisplacementSensorMarker(new Point3d(903135.21, 15801167.09, 593.59), { x: 40, y: 40 }, "Virtual Sensor 2", () => setShowVideo(true)),
          new DisplacementSensorMarker(new Point3d(903136.05, 15801149.75, 593.79), { x: 40, y: 40 }, "Virtual Sensor 1", () => setShowVideo(true)),
          new DisplacementSensorMarker(new Point3d(903134.63, 15801133.66, 593.89), { x: 40, y: 40 }, "Virtual Sensor 3", () => setShowVideo(true)),
        ];

        const markerDecorator = new MarkerDecorator(displacementMarkers);
        IModelApp.viewManager.addDecorator(markerDecorator);
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
