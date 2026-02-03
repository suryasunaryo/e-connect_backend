import { dbHelpers } from "../config/database.js";
import { emitDataChange } from "../utils/socketHelpers.js";

/* GET semua branches */
export const getAllBranches = async (req, res) => {
  try {
    const rows = await dbHelpers.query(`
      SELECT id, branch_name, branch_desc
      FROM branches
      WHERE deleted_at IS NULL
      ORDER BY id ASC
    `);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Error getAllBranches:", err);
    res.status(500).json({ error: "Gagal mengambil data branches" });
  }
};

/* GET 1 branch */
export const getBranchById = async (req, res) => {
  try {
    const { id } = req.params;

    const rows = await dbHelpers.query(
      `SELECT id, branch_name, branch_desc 
       FROM branches 
       WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Branch tidak ditemukan" });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("Error getBranchById:", err);
    res.status(500).json({ error: "Gagal mengambil branch" });
  }
};

/* CREATE branch */
export const createBranch = async (req, res) => {
  try {
    const { branch_name, branch_desc } = req.body;

    await dbHelpers.execute(
      `INSERT INTO branches (branch_name, branch_desc)
       VALUES (?, ?)`,
      [branch_name, branch_desc],
    );

    emitDataChange("branches", "create", { branch_name, branch_desc });

    res.json({ success: true, message: "Branch berhasil ditambahkan" });
  } catch (err) {
    console.error("Error createBranch:", err);
    res.status(500).json({ error: "Gagal menambahkan branch" });
  }
};

/* UPDATE branch */
export const updateBranch = async (req, res) => {
  try {
    const { id } = req.params;
    const { branch_name, branch_desc } = req.body;

    await dbHelpers.execute(
      `UPDATE branches
       SET branch_name=?, branch_desc=?, updated_at=NOW()
       WHERE id=?`,
      [branch_name, branch_desc, id],
    );

    emitDataChange("branches", "update", { id, branch_name, branch_desc });

    res.json({ success: true, message: "Branch berhasil diperbarui" });
  } catch (err) {
    console.error("Error updateBranch:", err);
    res.status(500).json({ error: "Gagal memperbarui branch" });
  }
};

/* DELETE branch */
export const deleteBranch = async (req, res) => {
  try {
    const { id } = req.params;

    await dbHelpers.execute(
      `UPDATE branches SET deleted_at = NOW() WHERE id=?`,
      [id],
    );

    emitDataChange("branches", "delete", { id });

    res.json({ success: true, message: "Branch berhasil dihapus" });
  } catch (err) {
    console.error("Error deleteBranch:", err);
    res.status(500).json({ error: "Gagal menghapus branch" });
  }
};
