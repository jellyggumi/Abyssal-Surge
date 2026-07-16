import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const FPS = 30;
export const TITLE_S = 3;
export const OUTRO_S = 4;

const abyss = "#0a0d18";
const aqua = "#70e5d0";
const violet = "#ab68ff";

const TitleCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 14 } });
  const glow = interpolate(frame, [0, TITLE_S * FPS], [0.2, 0.85]);
  return (
    <AbsoluteFill
      style={{
        backgroundColor: abyss,
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Avenir Next, Pretendard, sans-serif",
      }}
    >
      <div
        style={{
          transform: `scale(${0.8 + enter * 0.2})`,
          opacity: enter,
          textAlign: "center",
        }}
      >
        <div style={{ color: violet, fontSize: 26, letterSpacing: 12, marginBottom: 18 }}>
          ORIGINAL SHADOW RTS-RPG
        </div>
        <div
          style={{
            color: "#f4f7ff",
            fontSize: 92,
            fontWeight: 800,
            textShadow: `0 0 ${40 * glow}px ${aqua}`,
          }}
        >
          ABYSSAL SURGE
        </div>
        <div style={{ color: aqua, fontSize: 30, marginTop: 16 }}>
          심연의 문이 열렸다 — 그림자 군주여, 일어나라
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 16 } });
  return (
    <AbsoluteFill
      style={{
        backgroundColor: abyss,
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Avenir Next, Pretendard, sans-serif",
      }}
    >
      <img
        src={staticFile("emblem.jpg")}
        style={{
          width: 300,
          borderRadius: 24,
          opacity: enter,
          boxShadow: `0 0 60px rgba(112, 229, 208, 0.4)`,
        }}
      />
      <div style={{ color: "#f4f7ff", fontSize: 40, fontWeight: 700, marginTop: 28, opacity: enter }}>
        3-Stage Shadow Lord Campaign
      </div>
      <div style={{ color: aqua, fontSize: 26, marginTop: 12, opacity: enter }}>
        jellyggumi.github.io/Abyssal-Surge
      </div>
    </AbsoluteFill>
  );
};

export const PlayVideo: React.FC<{ gameplaySrc: string; gameplaySeconds: number }> = ({
  gameplaySrc,
  gameplaySeconds,
}) => {
  const gameplayFrames = Math.round(gameplaySeconds * FPS);
  return (
    <AbsoluteFill style={{ backgroundColor: abyss }}>
      <Sequence durationInFrames={TITLE_S * FPS}>
        <TitleCard />
      </Sequence>
      <Sequence from={TITLE_S * FPS} durationInFrames={gameplayFrames}>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <OffthreadVideo
            src={gameplaySrc}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
            muted
          />
        </AbsoluteFill>
      </Sequence>
      <Sequence from={TITLE_S * FPS + gameplayFrames} durationInFrames={OUTRO_S * FPS}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
