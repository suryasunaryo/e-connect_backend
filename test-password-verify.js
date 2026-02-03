// =====================================================
// Test Password Verification - Contoh Penggunaan
// Cara menggunakan verify password hash dengan bcrypt
// =====================================================

import { hashPassword, verifyPassword } from "./src/utils/passwordHasher.js";

async function testPasswordVerification() {
  console.log("🔐 Testing Password Verification");
  console.log("================================");

  try {
    // 1. Generate hash dari password baru
    console.log("\n1️⃣ Generate hash dari password:");
    const plainPassword = "admin123";
    const hash = await hashPassword(plainPassword);
    console.log(`Password: ${plainPassword}`);
    console.log(`Hash: ${hash}`);

    // 2. Verify password yang benar
    console.log("\n2️⃣ Verify password yang BENAR:");
    const isValidCorrect = await verifyPassword("admin123", hash);
    console.log(`verifyPassword('admin123', hash) = ${isValidCorrect}`);

    // 3. Verify password yang salah
    console.log("\n3️⃣ Verify password yang SALAH:");
    const isValidWrong = await verifyPassword("wrongpassword", hash);
    console.log(`verifyPassword('wrongpassword', hash) = ${isValidWrong}`);

    // 4. Test dengan hash yang ada di database
    console.log("\n4️⃣ Test dengan hash dari database:");
    const dbHash =
      "$2b$10$AkEWED6FSVgJ57xjLLBEN.eRFdV0wgXG5cufDzYfrkos4xd7NAVX."; // admin123
    const isDbValid = await verifyPassword("admin123", dbHash);
    console.log(`Database hash verification: ${isDbValid}`);

    // 5. Contoh penggunaan dalam login function
    console.log("\n5️⃣ Contoh dalam function login:");
    const loginResult = await simulateLogin("admin", "admin123");
    console.log(`Login result: ${JSON.stringify(loginResult, null, 2)}`);
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

// Simulasi function login
async function simulateLogin(username, password) {
  // Hash yang disimpan di database untuk user 'admin'
  const storedHashes = {
    admin: "$2b$10$AkEWED6FSVgJ57xjLLBEN.eRFdV0wgXG5cufDzYfrkos4xd7NAVX.", // admin123
    operator1: "$2b$10$kemzEtQISvY/Hy1UWXE.iuV7JBuOxxTZa02N2t7X6IumxY2a21ONO", // operator123
    viewer1: "$2b$10$lILJyzsVxJA0HQ.QKpSkPuYcXMzAkD9fm5yFjH719ychPvLsG5WNW", // viewer123
  };

  const storedHash = storedHashes[username];

  if (!storedHash) {
    return { success: false, message: "User not found" };
  }

  const isPasswordValid = await verifyPassword(password, storedHash);

  if (isPasswordValid) {
    return {
      success: true,
      message: "Login successful",
      user: { username, role: "admin" },
    };
  } else {
    return { success: false, message: "Invalid password" };
  }
}

// Jalankan test
testPasswordVerification();
