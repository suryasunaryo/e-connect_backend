import { dbHelpers, initDatabase } from "./src/config/database.js";

const setRefinedDefaults = async () => {
  try {
    console.log("🚀 Setting refined default layouts in dashboard_cards...");
    await initDatabase();

    const refinedLayouts = [
      { key: "welcome_banner", x: 0, y: 0, w: 8, h: 6 },
      { key: "calendar_widget", x: 8, y: 0, w: 4, h: 10 },
      { key: "stats_row", x: 0, y: 6, w: 8, h: 2 },
      { key: "task_statistics", x: 0, y: 8, w: 4, h: 6 },
      { key: "star_employee", x: 4, y: 8, w: 4, h: 6 },
      { key: "whos_online", x: 0, y: 14, w: 8, h: 10 },
      { key: "latest_news", x: 8, y: 10, w: 4, h: 6 },
      { key: "tracked_hours", x: 8, y: 16, w: 4, h: 8 },
    ];

    for (const layout of refinedLayouts) {
      await dbHelpers.execute(
        `UPDATE dashboard_cards 
         SET default_x = ?, default_y = ?, default_w = ?, default_h = ? 
         WHERE card_key = ?`,
        [layout.x, layout.y, layout.w, layout.h, layout.key],
      );
      console.log(`✅ Updated ${layout.key}`);
    }

    console.log("🎉 Refined defaults set successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to set refined defaults:", error);
    process.exit(1);
  }
};

setRefinedDefaults();
