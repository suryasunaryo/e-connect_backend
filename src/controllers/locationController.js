import { dbHelpers } from "../config/database.js";

/* GET semua lokasi */
export const getAllLocations = async (req, res) => {
  try {
    const rows = await dbHelpers.query(`
      SELECT id, office_name, office_address
      FROM location
      WHERE deleted_at IS NULL
      ORDER BY id ASC
    `);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Error getAllLocations:", err);
    res.status(500).json({ error: "Gagal mengambil data lokasi" });
  }
};

/* GET 1 lokasi */
export const getLocationById = async (req, res) => {
  try {
    const { id } = req.params;

    const rows = await dbHelpers.query(
      `SELECT id, office_name, office_address 
       FROM location 
       WHERE id=? AND deleted_at IS NULL`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Lokasi tidak ditemukan" });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("Error getLocationById:", err);
    res.status(500).json({ error: "Gagal mengambil lokasi" });
  }
};

/* CREATE location */
export const createLocation = async (req, res) => {
  try {
    const { office_name, office_address } = req.body;

    await dbHelpers.execute(
      `INSERT INTO location (office_name, office_address)
       VALUES (?, ?)`,
      [office_name, office_address]
    );

    res.json({ success: true, message: "Lokasi berhasil ditambahkan" });
  } catch (err) {
    console.error("Error createLocation:", err);
    res.status(500).json({ error: "Gagal menambahkan lokasi" });
  }
};

/* UPDATE location */
export const updateLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { office_name, office_address } = req.body;

    await dbHelpers.execute(
      `UPDATE location
       SET office_name=?, office_address=?, updated_at=NOW()
       WHERE id=?`,
      [office_name, office_address, id]
    );

    res.json({ success: true, message: "Lokasi berhasil diperbarui" });
  } catch (err) {
    console.error("Error updateLocation:", err);
    res.status(500).json({ error: "Gagal memperbarui lokasi" });
  }
};

/* DELETE location */
export const deleteLocation = async (req, res) => {
  try {
    const { id } = req.params;

    await dbHelpers.execute(
      `UPDATE location SET deleted_at = NOW() WHERE id=?`,
      [id]
    );

    res.json({ success: true, message: "Lokasi berhasil dihapus" });
  } catch (err) {
    console.error("Error deleteLocation:", err);
    res.status(500).json({ error: "Gagal menghapus lokasi" });
  }
};
