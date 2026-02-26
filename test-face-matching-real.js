import { compareFaces } from "./src/services/faceRecognitionService.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log("🚀 Starting Backend Face Matching Real-Image Tests...");

  const profileImage = path.join(
    __dirname,
    "uploads/employees/emp-1764576642457-746590313.jpg",
  );
  const captureImageMatch = path.join(
    __dirname,
    "uploads/employees/emp-1764576642457-746590313.jpg",
  ); // Same image for match
  const captureImageNoMatch = path.join(
    __dirname,
    "uploads/employees/profile-1771911912339-601783069.jpg",
  ); // Different image
  const nonFaceImage = path.join(__dirname, "uploads/isi truk.jpg"); // Not an image/no face

  // Helper to read file to buffer
  const getBuffer = (filePath) => {
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      return null;
    }
    return fs.readFileSync(filePath);
  };

  // 1. MATCH TEST
  console.log("\n--- TEST 1: MATCHING FACES ---");
  const bufferMatch = getBuffer(captureImageMatch);
  if (bufferMatch) {
    const result = await compareFaces(profileImage, bufferMatch);
    console.log(`Result: ${result}`);
    if (result === "match") console.log("✅ Match test PASSED");
    else console.log("❌ Match test FAILED");
  }

  // 2. NO-MATCH TEST
  console.log("\n--- TEST 2: NON-MATCHING FACES ---");
  const bufferNoMatch = getBuffer(captureImageNoMatch);
  if (bufferNoMatch) {
    const result = await compareFaces(profileImage, bufferNoMatch);
    console.log(`Result: ${result}`);
    if (result === "no-match") console.log("✅ No-match test PASSED");
    else console.log("❌ No-match test FAILED");
  }

  // 3. DETECTION FAILURE TEST
  console.log("\n--- TEST 3: NO FACE DETECTED ---");
  try {
    // Using a buffer that isn't a face but is a valid image might be better
    // but let's see how it handles a non-image buffer first as a stress test
    const dummyBuffer = Buffer.alloc(100);
    const result = await compareFaces(profileImage, dummyBuffer);
    console.log(`Result: ${result}`);
  } catch (err) {
    console.log(`Caught error as expected for invalid buffer: ${err.message}`);
  }

  console.log("\n🏁 Tests completed.");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("💥 Test runner crashed:", err);
  process.exit(1);
});
