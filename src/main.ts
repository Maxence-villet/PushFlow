import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

const video = document.getElementById("webcam") as HTMLVideoElement;
const canvas = document.getElementById("output_canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const statusText = document.getElementById("status")!;
const counterDisplay = document.getElementById("counter")!;
const startBtn = document.getElementById("btn-start") as HTMLButtonElement;

let poseLandmarker: PoseLandmarker;
let lastVideoTime = -1;

const soundSuccess = new Audio("./sounds/success.mp3");
soundSuccess.volume = 0.75;
const soundWarning = new Audio("./sounds/warning.mp3");

let pushUpCount = 0;
let isDown = false;
let badPostureStartTime: number | null = null;
let warningAudioPlayed = false;

function playSuccessSound() {
  soundSuccess.currentTime = 0;
  soundSuccess.play().catch(() => {});
}

function calculatePixelAngle(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number }
): number {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180.0) angle = 360.0 - angle;
  return angle;
}

function analyzePostureAndMotion(landmarks: NormalizedLandmark[]): string {
  const now = performance.now();
  const pw = video.videoWidth;
  const ph = video.videoHeight;

  const shoulder = { x: landmarks[11].x * pw, y: landmarks[11].y * ph };
  const elbow = { x: landmarks[13].x * pw, y: landmarks[13].y * ph };
  const wrist = { x: landmarks[15].x * pw, y: landmarks[15].y * ph };
  const hip = { x: landmarks[23].x * pw, y: landmarks[23].y * ph };
  const knee = { x: landmarks[25].x * pw, y: landmarks[25].y * ph };

  const dx = Math.abs(shoulder.x - hip.x);
  const dy = Math.abs(shoulder.y - hip.y);
  const isStanding = dy > dx * 1.3;

  if (isStanding) {
    isDown = false;
    badPostureStartTime = null;
    warningAudioPlayed = false;
    statusText.innerText = "Mettez-vous en position de planche au sol de profil.";
    statusText.style.color = "#ffffff";
    return "#ffffff";
  }

  const bodyAlignment = calculatePixelAngle(shoulder, hip, knee);
  let postureColor = "#00FF00";

  if (bodyAlignment >= 152) {
    postureColor = "#00FF00";
    badPostureStartTime = null;
    warningAudioPlayed = false;
  } else {
    postureColor = bodyAlignment >= 138 ? "#FFA500" : "#FF0000";
    if (postureColor === "#FF0000") {
      if (badPostureStartTime === null) {
        badPostureStartTime = now;
      } else if (now - badPostureStartTime > 300) {
        if (!warningAudioPlayed) {
          soundWarning.play().catch(e => console.log("Audio bloqué:", e));
          warningAudioPlayed = true;
        }
      }
    }
  }

  if (postureColor === "#FF0000") {
    statusText.innerText = "⚠️ Posture incorrecte ! Alignez votre dos.";
    statusText.style.color = "#FF0000";
  } else {
    statusText.innerText = "Position validée. Enchaînez les pompes !";
    statusText.style.color = "#00FF00";
  }

  const elbowAngle = calculatePixelAngle(shoulder, elbow, wrist);
  if (elbowAngle < 105) {
    isDown = true;
  }
  if (elbowAngle > 152 && isDown) {
    pushUpCount++;
    counterDisplay.innerText = pushUpCount.toString();
    playSuccessSound();
    isDown = false;
  }

  return postureColor;
}

async function startApplication() {
  startBtn.style.display = "none";
  statusText.innerText = "Chargement des modules IA locaux...";

  try {
    soundWarning.play().then(() => { soundWarning.pause(); soundWarning.currentTime = 0; }).catch(() => {});

    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );

    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
        delegate: "CPU"
      },
      runningMode: "VIDEO",
      numPoses: 1
    });

    statusText.innerText = "Autorisation de la caméra...";
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 640 },
        height: { ideal: 480 }
      }
    });

    video.srcObject = stream;
    video.addEventListener("loadeddata", () => {
      statusText.innerText = "Placez-vous au sol de profil.";
      predictWebcam();
    });
  } catch (error) {
    console.error(error);
    statusText.innerText = "❌ Erreur : " + (error as Error).message;
    startBtn.style.display = "inline-block";
  }
}

function predictWebcam() {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  if (lastVideoTime !== video.currentTime) {
    lastVideoTime = video.currentTime;
    const results = poseLandmarker.detectForVideo(video, performance.now());

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.landmarks && results.landmarks.length > 0) {
      const landmarks = results.landmarks[0];
      const currentStatusColor = analyzePostureAndMotion(landmarks);
      drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, currentStatusColor);
      drawLandmarks(landmarks, currentStatusColor);
    }
  }
  requestAnimationFrame(predictWebcam);
}

function drawConnectors(landmarks: NormalizedLandmark[], connections: any[], color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  for (const connection of connections) {
    const start = landmarks[connection.start];
    const end = landmarks[connection.end];
    ctx.beginPath();
    ctx.moveTo(start.x * canvas.width, start.y * canvas.height);
    ctx.lineTo(end.x * canvas.width, end.y * canvas.height);
    ctx.stroke();
  }
}

function drawLandmarks(landmarks: NormalizedLandmark[], color: string) {
  ctx.fillStyle = color;
  for (const point of landmarks) {
    ctx.beginPath();
    ctx.arc(point.x * canvas.width, point.y * canvas.height, 5, 0, 2 * Math.PI);
    ctx.fill();
  }
}

startBtn.addEventListener("click", startApplication);