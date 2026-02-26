import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
// 🧩 Use the node-wasm bundle which is optimized for Node.js
const faceapi = require("@vladmandic/face-api/dist/face-api.node-wasm.js");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let modelsLoaded = false;

/**
 * 🛠️ Helper to load face-api models from Disk
 */
const loadModels = async () => {
  if (modelsLoaded) return;

  try {
    console.log("🤖 [FaceService] Initializing face-api and models...");

    // 🧩 Use the internal TFJS from faceapi to avoid version conflicts
    const tf = faceapi.tf;

    // Ensure WASM backend is ready
    if (tf.getBackend() !== "wasm") {
      console.log("🤖 [FaceService] Setting TFJS backend to WASM...");
      await tf.setBackend("wasm");
      await tf.ready();
    }

    console.log(`✅ [FaceService] TFJS Backend: ${tf.getBackend()}`);

    const modelPath = path.join(__dirname, "../assets/models");
    console.log(`🤖 [FaceService] Loading models from: ${modelPath}`);

    // Check if models exist
    if (
      !fs.existsSync(
        path.join(modelPath, "tiny_face_detector_model-weights_manifest.json"),
      )
    ) {
      throw new Error(`Model files not found in ${modelPath}`);
    }

    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromDisk(modelPath),
      faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath),
      faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath),
    ]);

    modelsLoaded = true;
    console.log("✅ [FaceService] Face models loaded successfully");
  } catch (error) {
    console.error("❌ [FaceService] Error loading face models:", error.message);
    throw error;
  }
};

import { createCanvas, loadImage } from "canvas";

/**
 * 🖼️ Helper to convert image (Buffer or Path) to Tensor3D
 */
const getTensorFromImage = async (imageSource) => {
  let img;
  try {
    if (Buffer.isBuffer(imageSource)) {
      console.log("🤖 [FaceService] Loading image from Buffer...");
      img = await loadImage(imageSource);
    } else if (typeof imageSource === "string") {
      console.log(`🤖 [FaceService] Loading image from path: ${imageSource}`);
      if (!fs.existsSync(imageSource)) {
        console.warn(`⚠️ [FaceService] File not found: ${imageSource}`);
        return null;
      }
      img = await loadImage(imageSource);
    } else {
      throw new Error("Unsupported image source type");
    }

    console.log(`🖼️ [FaceService] Image loaded: ${img.width}x${img.height}`);

    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    // 🧩 Create tensor using the faceapi internal instance
    return faceapi.tf.browser.fromPixels(canvas);
  } catch (err) {
    console.error(`❌ [FaceService] getTensorFromImage error: ${err.message}`);
    return null;
  }
};

/**
 * 🎯 Core Comparison Function
 * Returns: 'match' | 'no-match' | 'no-face-profile' | 'no-face-capture' | 'no-face-both' | 'error'
 */
export const compareFaces = async (profileImagePath, capturedImageBuffer) => {
  try {
    console.log("🤖 [FaceService] Starting face comparison...");
    await loadModels();

    const tf = faceapi.tf;

    // 1. Convert to Tensors
    const tensorProfile = await getTensorFromImage(profileImagePath);
    const tensorCaptured = await getTensorFromImage(capturedImageBuffer);

    if (!tensorProfile || !tensorCaptured) {
      console.warn("⚠️ [FaceService] Failed to create tensors for comparison");
      if (tensorProfile) tensorProfile.dispose();
      if (tensorCaptured) tensorCaptured.dispose();
      return "error";
    }

    console.log(
      `📊 [FaceService] Shapes: Profile=${tensorProfile.shape}, Captured=${tensorCaptured.shape}`,
    );

    // 2. Detect & Compute Descriptors
    const detectorOptions = new faceapi.TinyFaceDetectorOptions({
      inputSize: 512,
      scoreThreshold: 0.1,
    });

    console.log("🤖 [FaceService] Detecting faces and landmarks...");

    // Wrapped in try/catch to ensure tensors are disposed
    let desc1, desc2;
    try {
      [desc1, desc2] = await Promise.all([
        faceapi
          .detectSingleFace(tensorProfile, detectorOptions)
          .withFaceLandmarks()
          .withFaceDescriptor(),
        faceapi
          .detectSingleFace(tensorCaptured, detectorOptions)
          .withFaceLandmarks()
          .withFaceDescriptor(),
      ]);
    } finally {
      // 3. Clean up Tensors immediately
      tensorProfile.dispose();
      tensorCaptured.dispose();
      console.log("🤖 [FaceService] Tensors disposed");
    }

    console.log(
      `🕵️ [FaceService] Detection 1: ${desc1 ? "FOUND" : "NOT FOUND"}`,
    );
    console.log(
      `🕵️ [FaceService] Detection 2: ${desc2 ? "FOUND" : "NOT FOUND"}`,
    );

    if (!desc1 && !desc2) return "no-face-both";
    if (!desc1) return "no-face-profile";
    if (!desc2) return "no-face-capture";

    // 4. Calculate Distance
    const distance = faceapi.euclideanDistance(
      desc1.descriptor,
      desc2.descriptor,
    );
    const threshold = 0.6; // Consistent with previous implementation
    const isMatched = distance < threshold;

    console.log(
      `🎯 [FaceService] Distance=${distance.toFixed(4)}, Threshold=${threshold}, Result=${isMatched ? "MATCH" : "NO-MATCH"}`,
    );

    return isMatched ? "match" : "no-match";
  } catch (error) {
    console.error("❌ [FaceService] CRITICAL Error during comparison:", error);
    return "error";
  }
};
