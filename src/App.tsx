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

import { Point3d, Vector3d } from "@itwin/core-geometry";
import { Auth } from "./Auth";
import { history } from "./history";

import { BackgroundMapType } from "@itwin/core-common";

export class DisplacementSensorMarker extends Marker {
  private _position: Point3d;

  constructor(location: Point3d, size: { x: number; y: number }, label: string, onClick: () => void) {
    super(location, size);
    this._position = location;

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

  public get position(): Point3d {
    return this._position;
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
        // Set up the background map
        vp.changeBackgroundMapProvider({
          name: "MapBoxProvider",
          type: BackgroundMapType.Aerial,
        });
        
        vp.changeBackgroundMapProps({
          applyTerrain: true,
          nonLocatable: true,
        });
        
        // Create the markers
        const displacementMarkers = [
          new DisplacementSensorMarker(new Point3d(-0.5, 0.8, 0.5), { x: 40, y: 40 }, "Virtual Sensor 1", () => setShowVideo(true)),
          new DisplacementSensorMarker(new Point3d(-0.5, 1.4, 0.5), { x: 40, y: 40 }, "Virtual Sensor 2", () => setShowVideo(true)),
          new DisplacementSensorMarker(new Point3d(-0.5, 2, 0.5), { x: 40, y: 40 }, "Virtual Sensor 3", () => setShowVideo(true)),
        ];

        // Calculate center point of all markers
        const center = Point3d.create(0, 0, 0);
        displacementMarkers.forEach(marker => {
          center.addInPlace(marker.position);
        });
        center.scaleInPlace(1 / displacementMarkers.length);

        // Set up the view
        const eye = center.clone();
        eye.addInPlace(new Vector3d(5, 5, 5)); // Adjust these values to change the camera position
        const up = Vector3d.unitZ();
        
        // Set the view
        vp.lookAt({ eye, center, up });
        
        // Create and add the decorator
        class MarkerDecorator {
          private displacementMarkers: Marker[];

          constructor(displacementMarkers: Marker[]) {
            this.displacementMarkers = displacementMarkers;
          }

          public decorate(context: DecorateContext): void {
            this.displacementMarkers.forEach((marker) => marker.addDecoration(context));
          }
        }

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
