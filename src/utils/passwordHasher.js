// =====================================================
// Password Hash Generator Utility
// Modul untuk generate dan verify password hash bcrypt
// =====================================================

import bcrypt from "bcrypt";
import readline from "readline";

const SALT_ROUNDS = 10;

/**
 * Generate bcrypt hash from plain text password
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Bcrypt hash
 */
export async function hashPassword(password) {
  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    return hash;
  } catch (error) {
    throw new Error(`Error hashing password: ${error.message}`);
  }
}

/**
 * Verify password against bcrypt hash
 * @param {string} password - Plain text password
 * @param {string} hash - Bcrypt hash
 * @returns {Promise<boolean>} - True if password matches
 */
export async function verifyPassword(password, hash) {
  try {
    const isValid = await bcrypt.compare(password, hash);
    return isValid;
  } catch (error) {
    throw new Error(`Error verifying password: ${error.message}`);
  }
}

/**
 * Generate multiple password hashes
 * @param {Array<string>} passwords - Array of plain text passwords
 * @returns {Promise<Object>} - Object with password as key and hash as value
 */
export async function hashMultiplePasswords(passwords) {
  const hashes = {};

  for (const password of passwords) {
    hashes[password] = await hashPassword(password);
  }

  return hashes;
}

/**
 * Interactive password hasher - CLI tool
 */
export async function interactiveHasher() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askQuestion = (question) => {
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  };

  console.log("\n🔐 Password Hash Generator");
  console.log("==========================");

  try {
    while (true) {
      const password = await askQuestion(
        '\nEnter password to hash (or "exit" to quit): '
      );

      if (password.toLowerCase() === "exit") {
        console.log("👋 Goodbye!");
        break;
      }

      if (!password.trim()) {
        console.log("❌ Password cannot be empty!");
        continue;
      }

      const hash = await hashPassword(password);

      console.log("\n✅ Password hashed successfully!");
      console.log(`📝 Original: ${password}`);
      console.log(`🔒 Hash: ${hash}`);
      console.log(
        `📋 SQL Update: UPDATE users SET password = '${hash}' WHERE username = 'your_username';`
      );

      // Verify the hash works
      const isValid = await verifyPassword(password, hash);
      console.log(`✔️  Verification: ${isValid ? "PASSED" : "FAILED"}`);
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    rl.close();
  }
}

// CLI runner - if this file is executed directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  // Check if password provided as command line argument
  const args = process.argv.slice(2);

  if (args.length > 0) {
    // Batch mode - hash all provided passwords
    console.log("🔐 Batch Password Hashing");
    console.log("=========================");

    hashMultiplePasswords(args)
      .then((hashes) => {
        console.log("\n✅ All passwords hashed:");
        for (const [password, hash] of Object.entries(hashes)) {
          console.log(`\n📝 Password: ${password}`);
          console.log(`🔒 Hash: ${hash}`);
          console.log(
            `📋 SQL: UPDATE users SET password = '${hash}' WHERE username = 'your_username';`
          );
        }
      })
      .catch((error) => {
        console.error("❌ Error:", error.message);
      });
  } else {
    // Interactive mode
    interactiveHasher();
  }
}

// Example usage functions
export const examples = {
  // Generate common password hashes
  async generateCommonHashes() {
    const commonPasswords = [
      "admin123",
      "operator123",
      "viewer123",
      "password123",
    ];
    return await hashMultiplePasswords(commonPasswords);
  },

  // Generate SQL statements for user updates
  async generateUserUpdateSQL() {
    const users = [
      { username: "admin", password: "admin123", role: "admin" },
      { username: "operator1", password: "operator123", role: "operator" },
      { username: "viewer1", password: "viewer123", role: "viewer" },
    ];

    console.log("-- Generated SQL for user password updates");

    for (const user of users) {
      const hash = await hashPassword(user.password);
      console.log(
        `UPDATE users SET password = '${hash}' WHERE username = '${user.username}'; -- ${user.password}`
      );
    }
  },
};

// Export default for convenience
export default {
  hashPassword,
  verifyPassword,
  hashMultiplePasswords,
  interactiveHasher,
  examples,
};
