import { getIo } from "../config/socket.js";

/**
 * Emits a global data change event to all connected clients.
 * This allows the frontend to auto-refresh data without manual reload.
 *
 * @param {string} resource - The resource name (e.g., 'users', 'work_calendar', 'departments')
 * @param {string} action - The action performed ('create', 'update', 'delete')
 * @param {object} data - The data related to the change (optional)
 */
export const emitDataChange = (resource, action, data = {}) => {
  const io = getIo();
  if (io) {
    const payload = {
      resource,
      action,
      data,
      timestamp: new Date().toISOString(),
    };

    // Emit global event for generic listeners
    io.emit("data:change", payload);

    // Emit resource-specific event for targeted listeners (optional but useful)
    io.emit(`data:change:${resource}`, payload);

    console.log(`📡 Emitted data:change for ${resource}:${action}`);
  } else {
    // console.warn("⚠️ Socket.io not initialized, cannot emit data change");
  }
};
