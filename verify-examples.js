// =====================================================
// Contoh Praktis Verify Password dalam Auth Route
// =====================================================

import { verifyPassword } from "./src/utils/passwordHasher.js";

// Contoh 1: Verify dalam login route
export async function loginUser(username, password) {
  try {
    // Ambil user dari database (simulasi)
    const user = await getUserFromDatabase(username);

    if (!user) {
      return { success: false, message: "User not found" };
    }

    // Verify password dengan hash dari database
    const isPasswordValid = await verifyPassword(password, user.password);

    if (isPasswordValid) {
      return {
        success: true,
        message: "Login successful",
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
      };
    } else {
      return { success: false, message: "Invalid credentials" };
    }
  } catch (error) {
    console.error("Login error:", error);
    return { success: false, message: "Login failed" };
  }
}

// Contoh 2: Verify dalam change password
export async function changePassword(userId, oldPassword, newPassword) {
  try {
    // Ambil user dari database
    const user = await getUserFromDatabase(userId);

    // Verify old password
    const isOldPasswordValid = await verifyPassword(oldPassword, user.password);

    if (!isOldPasswordValid) {
      return { success: false, message: "Current password is incorrect" };
    }

    // Generate hash untuk password baru
    const newPasswordHash = await hashPassword(newPassword);

    // Update password di database
    await updateUserPassword(userId, newPasswordHash);

    return { success: true, message: "Password changed successfully" };
  } catch (error) {
    console.error("Change password error:", error);
    return { success: false, message: "Failed to change password" };
  }
}

// Simulasi database functions
async function getUserFromDatabase(usernameOrId) {
  // Simulasi data dari database
  const users = {
    admin: {
      id: 1,
      username: "admin",
      password: "$2b$10$AkEWED6FSVgJ57xjLLBEN.eRFdV0wgXG5cufDzYfrkos4xd7NAVX.",
      role: "admin",
    },
    operator1: {
      id: 2,
      username: "operator1",
      password: "$2b$10$kemzEtQISvY/Hy1UWXE.iuV7JBuOxxTZa02N2t7X6IumxY2a21ONO",
      role: "operator",
    },
  };

  return users[usernameOrId] || null;
}

async function updateUserPassword(userId, newPasswordHash) {
  console.log(
    `Updating password for user ${userId} with hash: ${newPasswordHash}`
  );
  // Simulasi update ke database
  return true;
}

// Test functions
async function testLogin() {
  console.log("🔐 Testing Login Function");
  console.log("=========================");

  // Test login yang benar
  console.log("\n✅ Test login BENAR:");
  const result1 = await loginUser("admin", "admin123");
  console.log(JSON.stringify(result1, null, 2));

  // Test login yang salah
  console.log("\n❌ Test login SALAH:");
  const result2 = await loginUser("admin", "wrongpassword");
  console.log(JSON.stringify(result2, null, 2));

  // Test user tidak ada
  console.log("\n❓ Test user TIDAK ADA:");
  const result3 = await loginUser("nonexistent", "anypassword");
  console.log(JSON.stringify(result3, null, 2));
}

// Jalankan test jika file dijalankan langsung
if (import.meta.url === `file://${process.argv[1]}`) {
  testLogin();
}
