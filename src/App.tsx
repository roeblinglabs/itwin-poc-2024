import "./App.scss";

import type { ScreenViewport } from "@itwin/core-frontend";
import {
  IModelApp,
  StandardViewId,
  Marker,
  DecorateContext,
  MapLayerSettings,
} from "@itwin/core-frontend";
import { FillCentered } from "@itwin/core-react";
import { ProgressLinear } from "@itwin/itwinui-react";
import { Viewer } from "@itwin/web-viewer-react";
import React, { useCallback, useEffect, useState } from "react";

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
  const [changesetId, setChangesetId] = useState(
    process.env.IMJS_AUTH_CLIENT_CHANGESET_ID
  );
  const [showVideo, setShowVideo] = useState(false); // New state to control video display

  const accessToken = Auth.getClient().getAccessToken();

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

  const onIModelAppInit = useCallback(async () => {
    const mapboxLayerProps = {
      url: "mapbox://styles/roeblinglabs/cm42013md00lm01s303u90r3o",
      name: "Mapbox Layer",
      formatId: "MapboxImagery",
      accessKey: process.env.REACT_APP_MAPBOX_ACCESS_TOKEN,
    };

    const mapLayerSettings = MapLayerSettings.fromJSON({
      formatId: mapboxLayerProps.formatId,
      url: mapboxLayerProps.url,
      name: mapboxLayerProps.name,
    });

    if (mapLayerSettings) {
      IModelApp.viewManager.forEachViewport((vp) => {
        vp.displayStyle.attachMapLayerSettings(mapLayerSettings);
      });
    }
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
        authClient={Auth.getClient()}
        onIModelAppInit={onIModelAppInit}
      />
    </div>
  );
};

export default App;
