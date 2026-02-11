import { dbHelpers } from "./src/config/database.js";

async function fixWelcomeBanner() {
  try {
    console.log("🛠️ Fixing welcome_banner category...");

    // 1. Change welcome_banner to optional so it appears in selection lists
    await dbHelpers.execute(
      "UPDATE dashboard_cards SET card_category = 'optional' WHERE card_key = 'welcome_banner'",
    );

    // 2. Ensure all users have it in their preferences
    const welcomeCard = await dbHelpers.queryOne(
      "SELECT id, default_visible, display_order, default_x, default_y, default_w, default_h FROM dashboard_cards WHERE card_key = 'welcome_banner'",
    );

    if (welcomeCard) {
      console.log("📦 Syncing welcome_banner for all existing users...");
      const users = await dbHelpers.query("SELECT id FROM users");

      for (const user of users) {
        const existing = await dbHelpers.queryOne(
          "SELECT id FROM user_dashboard_preferences WHERE user_id = ? AND card_id = ?",
          [user.id, welcomeCard.id],
        );

        if (!existing) {
          await dbHelpers.execute(
            `INSERT INTO user_dashboard_preferences (user_id, card_id, is_visible, display_order, x, y, w, h)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              user.id,
              welcomeCard.id,
              welcomeCard.default_visible,
              welcomeCard.display_order,
              welcomeCard.default_x || 0,
              welcomeCard.default_y || 0,
              welcomeCard.default_w || 6,
              welcomeCard.default_h || 4,
            ],
          );
        }
      }
    }

    console.log("✅ Welcome banner fixed and synced!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to fix welcome banner:", error);
    process.exit(1);
  }
}

fixWelcomeBanner();
