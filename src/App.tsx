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

import { Point3d, Cartographic } from "@itwin/core-geometry";
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
        
        // Enable reality models
        const displayStyle = vp.view.displayStyle;
        displayStyle.settings.backgroundMap.setEnabled(true);
        displayStyle.settings.setRealityModelsDisplay({
          backgroundRealityModels: "on",
        });
        
        // Helper function to convert geographic coordinates to spatial coordinates
        const geoToSpatial = async (latitude: number, longitude: number, height: number): Promise<Point3d> => {
          // Create a cartographic point (longitude, latitude, height)
          const cartographic = Cartographic.fromDegrees({
            longitude,
            latitude,
            height,
          });
          
          // Convert to spatial coordinates
          const spatialLocation = await vp.iModel.geoServices.cartographicToSpatial(cartographic);
          return spatialLocation;
        };
        
        try {
          // Create a marker set for better management
          const markerSet = new MarkerSet();
          
          // Create markers at the specified geographic coordinates
          // Sensor 1: 42.466527, -71.355628, 200
          const location1 = await geoToSpatial(42.466527, -71.355628, 200);
          const sensor1 = new DisplacementSensorMarker(
            location1,
            { x: 40, y: 40 },
            "Virtual Sensor 1",
            () => setShowVideo(true)
          );
          markerSet.markers.push(sensor1);
          
          // Sensor 2: 42.466565, -71.355720, 200
          const location2 = await geoToSpatial(42.466565, -71.355720, 200);
          const sensor2 = new DisplacementSensorMarker(
            location2,
            { x: 40, y: 40 },
            "Virtual Sensor 2",
            () => setShowVideo(true)
          );
          markerSet.markers.push(sensor2);
          
          // Sensor 3: 42.466597, -71.355799, 200
          const location3 = await geoToSpatial(42.466597, -71.355799, 200);
          const sensor3 = new DisplacementSensorMarker(
            location3,
            { x: 40, y: 40 },
            "Virtual Sensor 3",
            () => setShowVideo(true)
          );
          markerSet.markers.push(sensor3);
          
          // Add the marker set to the viewport
          IModelApp.viewManager.addMarkerSet(markerSet);
          
          // Fit view to show all markers (with a short delay to ensure rendering)
          setTimeout(() => {
            const tool = new FitViewTool();
            tool.run();
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
