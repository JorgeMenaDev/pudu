import { useEffect } from "react";

import type { CaptureTarget, RecorderSettings } from "@glimpse/contracts";

import { glimpse } from "../bridge";

// H.264 MP4 first: it plays everywhere and Chromium encodes it in hardware on
// Apple silicon. WebM is the fallback.
const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.640033,mp4a.40.2",
  "video/mp4;codecs=avc1,mp4a.40.2",
  "video/mp4;codecs=avc1,opus",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm",
];

export function pickMimeType(isSupported: (type: string) => boolean): string {
  return MIME_CANDIDATES.find(isSupported) ?? "video/webm";
}

// Chromium's desktop-capture constraints. They take a desktopCapturer source
// id directly, so no picker or user gesture is involved.
function desktopConstraints(target: CaptureTarget): MediaStreamConstraints {
  const video = {
    mandatory: {
      chromeMediaSource: "desktop",
      chromeMediaSourceId: target.sourceId,
      maxWidth: target.maxWidth,
      maxHeight: target.maxHeight,
      maxFrameRate: 30,
    },
  };
  return { audio: false, video: video as MediaTrackConstraints };
}

async function micStream(settings: RecorderSettings): Promise<MediaStream | null> {
  if (!settings.micEnabled) return null;
  return navigator.mediaDevices.getUserMedia({
    audio: {
      ...(settings.micDeviceId ? { deviceId: { exact: settings.micDeviceId } } : {}),
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
}

async function grabThumbnail(stream: MediaStream): Promise<ArrayBuffer | null> {
  const video = document.createElement("video");
  video.muted = true;
  video.srcObject = stream;
  await video.play();
  const width = 640;
  const height = Math.round((video.videoHeight / Math.max(video.videoWidth, 1)) * width);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(video, 0, 0, width, height);
  video.srcObject = null;
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  return blob ? blob.arrayBuffer() : null;
}

// One take, end to end. Lives in a hidden window that main destroys afterwards.
async function runTake(): Promise<void> {
  const state = await glimpse.getState();
  if (!state.target) throw new Error("Nothing selected to record.");
  const display = await navigator.mediaDevices.getUserMedia(desktopConstraints(state.target));
  const mic = await micStream(state.settings).catch((error: unknown) => {
    display.getTracks().forEach((track) => track.stop());
    throw new Error(`Microphone unavailable: ${error instanceof Error ? error.message : String(error)}`);
  });
  const stream = new MediaStream([...display.getVideoTracks(), ...(mic?.getAudioTracks() ?? [])]);
  const stopTracks = () => [display, mic].forEach((s) => s?.getTracks().forEach((track) => track.stop()));

  const mimeType = pickMimeType((type) => MediaRecorder.isTypeSupported(type));
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 10_000_000,
    audioBitsPerSecond: 128_000,
  });

  // Chunks go to main in order; arrayBuffer() is async, so chain them.
  let pending = Promise.resolve();
  let discarded = false;
  recorder.ondataavailable = (event) => {
    if (discarded || event.data.size === 0) return;
    pending = pending.then(async () => glimpse.recorder.chunk(await event.data.arrayBuffer()));
  };

  let thumbnail: Promise<ArrayBuffer | null> = Promise.resolve(null);
  recorder.onstop = async () => {
    await pending;
    const settings = display.getVideoTracks()[0]?.getSettings();
    if (!discarded) {
      glimpse.recorder.finished({
        width: settings?.width ?? 0,
        height: settings?.height ?? 0,
        mimeType: recorder.mimeType || mimeType,
        thumbnailJpeg: await thumbnail.catch(() => null),
      });
    }
    stopTracks();
  };

  // Closing the recorded window ends the capture; treat it as "stop".
  display.getVideoTracks()[0]?.addEventListener("ended", () => void glimpse.stop());

  glimpse.recorder.onCommand((command) => {
    if (command === "begin" && recorder.state === "inactive") {
      recorder.start(1000);
      thumbnail = grabThumbnail(new MediaStream(display.getVideoTracks()));
    } else if (command === "pause" && recorder.state === "recording") recorder.pause();
    else if (command === "resume" && recorder.state === "paused") recorder.resume();
    else if (command === "stop" && recorder.state !== "inactive") recorder.stop();
    else if (command === "discard") {
      discarded = true;
      if (recorder.state !== "inactive") recorder.stop();
      else stopTracks();
    }
  });

  glimpse.recorder.ready();
}

// Module-level guard: StrictMode runs effects twice, a take must start once.
// Main destroys this window when the take ends, which releases everything.
let started = false;

export function Recorder() {
  useEffect(() => {
    if (started) return;
    started = true;
    runTake().catch((error: unknown) =>
      glimpse.recorder.failed(error instanceof Error ? error.message : String(error)),
    );
  }, []);
  return null;
}
