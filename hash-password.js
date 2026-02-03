#!/usr/bin/env node

// =====================================================
// Standalone Password Hash Generator
// Usage: node hash-password.js [password1] [password2] ...
// Or: node hash-password.js (for interactive mode)
// =====================================================

//cara menggunakan: node hash-password.js
//jangan lupa cek untuk file yang di utils, harus ada file passwordHasher.js

import {
  hashPassword,
  verifyPassword,
  interactiveHasher,
  hashMultiplePasswords,
} from "./src/utils/passwordHasher.js";

async function main() {
  const args = process.argv.slice(2);

  console.log("🔐 Truck Queue System - Password Hash Generator");
  console.log("===============================================");

  if (args.length === 0) {
    // Interactive mode
    console.log("💡 No passwords provided, starting interactive mode...");
    await interactiveHasher();
  } else if (args[0] === "--help" || args[0] === "-h") {
    // Help mode
    console.log(`
📖 Usage:
  node hash-password.js                    # Interactive mode
  node hash-password.js password1 pass2    # Batch mode
  node hash-password.js --common           # Generate common passwords
  node hash-password.js --verify pass hash # Verify password against hash

📝 Examples:
  node hash-password.js admin123 operator123 viewer123
  node hash-password.js --common
  node hash-password.js --verify admin123 '$2b$10$...'
        `);
  } else if (args[0] === "--common") {
    // Generate common password hashes
    console.log("🔄 Generating common password hashes...\n");

    const commonPasswords = [
      "admin123",
      "operator123",
      "viewer123",
      "password123",
      "test123",
    ];
    const hashes = await hashMultiplePasswords(commonPasswords);

    console.log("✅ Common password hashes generated:");
    console.log("=====================================");

    for (const [password, hash] of Object.entries(hashes)) {
      console.log(`\n📝 Password: ${password}`);
      console.log(`🔒 Hash: ${hash}`);
      console.log(
        `📋 SQL: UPDATE users SET password = '${hash}' WHERE username = 'your_username';`
      );
    }

    console.log("\n🎯 Ready-to-use SQL for truck queue system:");
    console.log("===========================================");
    console.log(
      `UPDATE users SET password = '${hashes["admin123"]}' WHERE username IN ('admin', 'supervisor');`
    );
    console.log(
      `UPDATE users SET password = '${hashes["operator123"]}' WHERE username IN ('operator1', 'operator2', 'operator3');`
    );
    console.log(
      `UPDATE users SET password = '${hashes["viewer123"]}' WHERE username IN ('viewer1', 'viewer2');`
    );
  } else if (args[0] === "--verify" && args.length === 3) {
    // Verify password against hash
    const [, password, hash] = args;
    console.log(`🔍 Verifying password: ${password}`);
    console.log(`🔒 Against hash: ${hash.substring(0, 20)}...`);

    try {
      const isValid = await verifyPassword(password, hash);
      console.log(
        `\n${isValid ? "✅" : "❌"} Verification: ${
          isValid ? "PASSED" : "FAILED"
        }`
      );
    } catch (error) {
      console.error(`❌ Error verifying password: ${error.message}`);
    }
  } else {
    // Batch mode - hash all provided passwords
    console.log(`🔄 Hashing ${args.length} password(s)...\n`);

    try {
      const hashes = await hashMultiplePasswords(args);

      console.log("✅ All passwords hashed successfully:");
      console.log("====================================");

      for (const [password, hash] of Object.entries(hashes)) {
        console.log(`\n📝 Password: ${password}`);
        console.log(`🔒 Hash: ${hash}`);
        console.log(
          `📋 SQL: UPDATE users SET password = '${hash}' WHERE username = 'your_username';`
        );

        // Verify each hash
        const isValid = await verifyPassword(password, hash);
        console.log(`✔️  Verification: ${isValid ? "PASSED" : "FAILED"}`);
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
  }
}

// Run the main function
main().catch((error) => {
  console.error("💥 Fatal error:", error.message);
  process.exit(1);
});
