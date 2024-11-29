import "./App.scss";

import type { ScreenViewport } from "@itwin/core-frontend";
import { FitViewTool, IModelApp, TileAdmin, StandardViewId, Marker, DecorateContext } from "@itwin/core-frontend";
import { FillCentered } from "@itwin/core-react";
import { ProgressLinear } from "@itwin/itwinui-react";
import {
  MeasurementActionToolbar,
  MeasureTools,
} from "@itwin/measure-tools-react";
import { PropertyGridManager } from "@itwin/property-grid-react";
import { TreeWidget } from "@itwin/tree-widget-react";
import { Viewer } from "@itwin/web-viewer-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { Point3d } from "@itwin/core-geometry";
import { Auth } from "./Auth";

export class VideoCameraMarker extends Marker {
  constructor(location: Point3d, size: { x: number; y: number }, label: string, onClick: () => void) {
    super(location, size);

    this.title = `Video Camera: ${label}`;
    this.setImageUrl("/images/icons8-video-camera-64.png");
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
  const [changesetId, setChangesetId] = useState(process.env.IMJS_AUTH_CLIENT_CHANGESET_ID);
  const [showVideo, setShowVideo] = useState(false); // New state to control video display

  const accessToken = Auth.getClient();

  const login = useCallback(async () => {
    try {
      await accessToken.signInSilent();
    } catch {
      await accessToken.signIn();
    }
  }, [accessToken]);

  useEffect(() => {
    void login();
  }, [login]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("iTwinId")) setITwinId(urlParams.get("iTwinId") as string);
    if (urlParams.has("iModelId")) setIModelId(urlParams.get("iModelId") as string);
    if (urlParams.has("changesetId")) setChangesetId(urlParams.get("changesetId") as string);
  }, []);

  const cesiumIonToken: string = process.env.CESIUM_ION_TOKEN ?? "";

  const onIModelAppInit = useCallback(async () => {
    IModelApp.startup({
      tileAdmin: TileAdmin.create({ cesiumIonKey: cesiumIonToken }),
    });

    await TreeWidget.initialize();
    await PropertyGridManager.initialize();
    await MeasureTools.startup();
    MeasurementActionToolbar.setDefaultActionProvider();
  }, [cesiumIonToken]);

  const viewCreatorOptions = useMemo(() => ({
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
    },
  }), []);

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
        authClient={accessToken}
        viewCreatorOptions={viewCreatorOptions}
        enablePerformanceMonitors={true}
        onIModelAppInit={onIModelAppInit}
      />
    </div>
  );
};

export default App;
