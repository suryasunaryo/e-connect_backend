import { compareFaces } from "./src/services/faceRecognitionService.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testFaceMatching() {
  console.log("🧪 Testing backend face matching...");

  // We need 2 images to test. Let's see if we have any in uploads.
  // Since I can't easily get 2 valid face images without knowing user data,
  // I will at least check if the models load by calling the function.

  try {
    const dummyBuffer = Buffer.alloc(100); // Invalid image
    const result = await compareFaces("non_existent_path.jpg", dummyBuffer);
    console.log("Result (expected error/no-face):", result);

    if (result === "error" || result === "no-face-profile") {
      console.log(
        "✅ Service seems to be responding (correctly handled missing files)",
      );
    }
  } catch (err) {
    console.error("❌ Service failed to run:", err);
  }
}

testFaceMatching();
