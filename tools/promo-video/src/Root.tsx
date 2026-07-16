import React from "react";
import { Composition, staticFile } from "remotion";
import { PlayVideo, FPS, TITLE_S, OUTRO_S } from "./PlayVideo";

// Gameplay clip duration is provided at render time via --props
// (defaults keep studio preview working before the capture exists).
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="PlayVideo"
      component={PlayVideo}
      durationInFrames={Math.round((TITLE_S + 42 + OUTRO_S) * FPS)}
      fps={FPS}
      width={1280}
      height={720}
      defaultProps={{
        gameplaySrc: "gameplay.mp4",
        gameplaySeconds: 42,
      }}
      calculateMetadata={({ props }) => ({
        durationInFrames: Math.round((TITLE_S + props.gameplaySeconds + OUTRO_S) * FPS),
        props,
      })}
    />
  );
};
