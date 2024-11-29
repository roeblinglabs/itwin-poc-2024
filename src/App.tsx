import "./App.scss";

import type { ScreenViewport } from "@itwin/core-frontend";
import {
  IModelApp,
  Marker,
  DecorateContext,
  TileAdmin,
} from "@itwin/core-frontend";
import { FillCentered } from "@itwin/core-react";
import { ProgressLinear } from "@itwin/itwinui-react";
import {
  useAccessToken,
  Viewer,
} from "@itwin/web-viewer-react";
import React, { useCallback, useEffect, useState } from "react";
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
  const [showVideo, setShowVideo] = useState(false);

  const accessToken = useAccessToken();
  const authClient = Auth.getClient();

  // Retrieve Cesium Ion Token
  const cesiumIonToken: string = process.env.CESIUM_ION_TOKEN ?? "";

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

  // Configure Cesium Terrain
  const configureCesiumTerrain = useCallback(() => {
    if (!cesiumIonToken) {
      console.error("Cesium Ion Token is missing.");
      return;
    }

    // Set Cesium Ion Token for TileAdmin
    TileAdmin.Props.cesiumIonKey = cesiumIonToken;
    console.log("Cesium Terrain configured.");
  }, [cesiumIonToken]);

  useEffect(() => {
    configureCesiumTerrain();
  }, [configureCesiumTerrain]);

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
        enablePerformanceMonitors={true}
        onIModelAppInit={() => console.log("iModelApp initialized.")}
      />
    </div>
  );
};

export default App;
