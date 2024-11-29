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

import { Point3d } from "@itwin/core-frontend";
import { Auth } from "./Auth";
import { history } from "./history";
import { getSchemaContext, unifiedSelectionStorage } from "./selectionStorage";

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

export class MicroscopeMarker extends Marker {
  constructor(location: Point3d, size: { x: number; y: number }, label: string, onClick: () => void) {
    super(location, size);

    this.title = `Microscope: ${label}`;
    this.setImageUrl("/images/icons8-microscope-64.png");
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
  const [changesetId, setChangesetId] = useState(
    process.env.IMJS_AUTH_CLIENT_CHANGESET_ID
  );
  const [showVideo, setShowVideo] = useState(false);

  const accessToken = useAccessToken();
  const authClient = Auth.getClient();

  // Mapbox Layer Options
  const mapLayerOptions = useMemo(() => ({
    MapboxImagery: {
      key: "access_token", 
      value: process.env.REACT_APP_MAPBOX_ACCESS_TOKEN!
    }
  }), []);

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
      viewportConfigurer: (vp: ScreenViewport) => {
        // Add Mapbox Layer
        vp.addMapLayer({
          type: "MapboxImageryProvider",
          url: "mapbox://styles/roeblinglabs/cm42013md00lm01s303u90r3o",
          transparentBackground: false
        }, mapLayerOptions);

        class MarkerDecorator {
          private videoMarkers: Marker[];
          private displacementMarkers: Marker[];
          private microscopeMarkers: Marker[];

          constructor(videoMarkers: Marker[], displacementMarkers: Marker[], microscopeMarkers: Marker[]) {
            this.videoMarkers = videoMarkers;
            this.displacementMarkers = displacementMarkers;
            this.microscopeMarkers = microscopeMarkers;
          }

          public decorate(context: DecorateContext): void {
            this.videoMarkers.forEach((marker) => marker.addDecoration(context));
            this.displacementMarkers.forEach((marker) => marker.addDecoration(context));
            this.microscopeMarkers.forEach((marker) => marker.addDecoration(context));
          }
        }

        const videoCameraMarkers = [
          new VideoCameraMarker(new Point3d(-10, 20, 5), { x: 40, y: 40 }, "Shore Camera 1", () => setShowVideo(true)),
          new VideoCameraMarker(new Point3d(-15, 25, 5), { x: 40, y: 40 }, "Shore Camera 2", () => setShowVideo(true)),
        ];

        const displacementMarkers = [
          new DisplacementSensorMarker(new Point3d(0, 0, 10), { x: 40, y: 40 }, "Bridge Girder 1", () => setShowVideo(true)),
          new DisplacementSensorMarker(new Point3d(5, 0, 10), { x: 40, y: 40 }, "Bridge Girder 2", () => setShowVideo(true)),
          new DisplacementSensorMarker(new Point3d(10, 0, 10), { x: 40, y: 40 }, "Bridge Girder 3", () => setShowVideo(true)),
        ];

        const microscopeMarkers = [
          new MicroscopeMarker(new Point3d(20, 10, 15), { x: 40, y: 40 }, "Microscope 1", () => setShowVideo(true)),
        ];

        const markerDecorator = new MarkerDecorator(videoCameraMarkers, displacementMarkers, microscopeMarkers);
        IModelApp.viewManager.addDecorator(markerDecorator);
      },
    };
  }, [mapLayerOptions]);

  const onIModelAppInit = useCallback(async () => {
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
      />
    </div>
  );
};

export default App;
