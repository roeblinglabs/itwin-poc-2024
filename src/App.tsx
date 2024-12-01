import "./App.scss";

import type { ScreenViewport } from "@itwin/core-frontend";
import {
  FitViewTool,
  IModelApp,
  StandardViewId,
  Marker,
  DecorateContext,
  TileAdmin,
} from "@itwin/core-frontend";
import { FillCentered } from "@itwin/core-react";
import { ProgressLinear } from "@itwin/itwinui-react";
import {
  MeasurementActionToolbar,
  MeasureTools,
} from "@itwin/measure-tools-react";
import {
  useAccessToken,
  Viewer,
} from "@itwin/web-viewer-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { Point3d } from "@itwin/core-geometry";
import { Auth } from "./Auth";
import { history } from "./history";

export class VideoCameraMarker extends Marker {
  constructor(location: Point3d, size: { x: number; y: number }, label: string, onClick: () => void) {
    super(location, size);

    this.title = `Video Camera: ${label}`;
    this.setImageUrl("/images/icons8-video-camera-64.png");
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
  }, []);

  useEffect(() => {
    let url = `viewer?iTwinId=${iTwinId}`;
    if (iModelId) url = `${url}&iModelId=${iModelId}`;
    history.push(url);
  }, [iTwinId, iModelId]);

  const onIModelAppInit = useCallback(async () => {
    await MeasureTools.startup();
    MeasurementActionToolbar.setDefaultActionProvider();

    // Set Cesium Ion Key via TileAdmin.Props
    TileAdmin.Props.cesiumIonKey = CesiumKey;
  }, [CesiumKey]);

  const viewCreatorOptions = useMemo(() => {
    return {
      viewportConfigurer: (vp: ScreenViewport) => {
        class MarkerDecorator {
          private videoMarkers: Marker[];

          constructor(videoMarkers: Marker[]) {
            this.videoMarkers = videoMarkers;
          }

          public decorate(context: DecorateContext): void {
            this.videoMarkers.forEach((marker) => marker.addDecoration(context));
          }
        }

        const videoCameraMarkers = [
          new VideoCameraMarker(new Point3d(-10, 20, 5), { x: 40, y: 40 }, "Shore Camera 1", () => setShowVideo(true)),
        ];

        const markerDecorator = new MarkerDecorator(videoCameraMarkers);
        IModelApp.viewManager.addDecorator(markerDecorator);

        // Attach Mapbox Layer
        vp.displayStyle.attachMapLayer({
          formatId: "MapboxImagery",
          name: "Mapbox Layer",
          url: `https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token=${MapboxKey}`,
        });
      },
    };
  }, [MapboxKey]);

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
        authClient={authClient}
        viewCreatorOptions={viewCreatorOptions}
        onIModelAppInit={onIModelAppInit}
        mapLayerOptions={{ MapboxImagery: { key: "access_token", value: MapboxKey } }}
        tileAdmin={{ cesiumIonKey: CesiumKey }}
      />
    </div>
  );
};

export default App;
