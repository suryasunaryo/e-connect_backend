import express from "express";
import ExcelJS from "exceljs";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { getPool } from "../config/database.js";
import {
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  createUserFromEmployee,
  autoCreateUsers,
  getEmployeeByRfid,
  syncUserAccounts,
} from "../controllers/employeeController.js";
import { activityLogger } from "../middleware/activityLogger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// ... existing code ...

// CREATE USER from employee
router.post(
  "/:id/create-user",
  activityLogger.logModuleActivity("employees", "CREATE_USER"),
  createUserFromEmployee,
);

// AUTO CREATE USERS for all employees without user account
router.post(
  "/auto-create-users",
  activityLogger.logModuleActivity("employees", "AUTO_CREATE_USERS"),
  autoCreateUsers,
);
router.post(
  "/sync-user-accounts",
  activityLogger.logModuleActivity("employees", "SYNC_USER_ACCOUNTS"),
  syncUserAccounts,
);
// Configure Multer for Employee Pictures (Disk Storage)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../../uploads/employees");
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `emp-${uniqueSuffix}${ext}`);
  },
});

const uploadImage = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images are allowed"));
    }
  },
});

// Configure Multer for Excel Import (Memory Storage)
const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only Excel files are allowed"));
    }
  },
});

// GET template employee - MUST be before /:id route
router.get("/template", async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Template Employee");

    sheet.columns = [
      { header: "full_name", key: "full_name", width: 30 },
      { header: "nik", key: "nik", width: 20 },
      { header: "barcode", key: "barcode", width: 20 },
      { header: "branch_id", key: "branch_id", width: 10 },
      { header: "department_id", key: "department_id", width: 10 },
      { header: "position_id", key: "position_id", width: 10 },
      { header: "location_id", key: "location_id", width: 10 },
      { header: "title_id", key: "title_id", width: 10 },
      { header: "employee_status", key: "employee_status", width: 15 },
      { header: "contract_count", key: "contract_count", width: 15 },
      { header: "join_date", key: "join_date", width: 15 },
      { header: "effective_date", key: "effective_date", width: 15 },
      { header: "end_effective_date", key: "end_effective_date", width: 15 },
      { header: "resign_date_rehire", key: "resign_date_rehire", width: 15 },
      { header: "religion", key: "religion", width: 10 },
      { header: "gender", key: "gender", width: 10 },
      { header: "marital_status", key: "marital_status", width: 15 },
      { header: "place_of_birth", key: "place_of_birth", width: 15 },
      { header: "date_of_birth", key: "date_of_birth", width: 15 },
      { header: "address", key: "address", width: 25 },
      { header: "phone", key: "phone", width: 25 },
      { header: "office_email", key: "office_email", width: 25 },
      { header: "personal_email", key: "personal_email", width: 25 },
      { header: "npwp", key: "npwp", width: 20 },
      { header: "bpjs_tk", key: "bpjs_tk", width: 20 },
      { header: "bpjs_health", key: "bpjs_health", width: 20 },
      { header: "ktp_number", key: "ktp_number", width: 20 },
      { header: "rfid_number", key: "rfid_number", width: 20 },
    ];

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=employee_template.xlsx",
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed generating template" });
  }
});

// GET all employees
router.get("/", getAllEmployees);

// SCAN RFID
router.post("/scan-rfid", getEmployeeByRfid);

// GET employee by ID
router.get(
  "/:id",
  activityLogger.logModuleActivity("employees", "READ"),
  getEmployeeById,
);

// CREATE new employee
router.post(
  "/",
  uploadImage.single("picture"),
  activityLogger.logModuleActivity("employees", "CREATE"),
  createEmployee,
);

// UPDATE employee
router.put(
  "/:id",
  uploadImage.single("picture"),
  activityLogger.logModuleActivity("employees", "UPDATE"),
  updateEmployee,
);

// DELETE employee (soft delete)
router.delete(
  "/:id",
  activityLogger.logModuleActivity("employees", "DELETE"),
  deleteEmployee,
);

// CREATE USER from employee
router.post(
  "/:id/create-user",
  activityLogger.logModuleActivity("employees", "CREATE_USER"),
  createUserFromEmployee,
);

// Helper for Date Parsing
const parseDate = (val) => {
  if (!val) return null;
  if (val instanceof Date) return val;

  // Handle Excel serial numbers (e.g. 45285)
  if (typeof val === "number") {
    // Excel base date is 1899-12-30
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    return isNaN(date.getTime()) ? null : date;
  }

  const strVal = String(val).trim();
  if (strVal === "") return null;

  // Try DD/MM/YYYY or DD-MM-YYYY or DD/MM/YY
  const dmyMatch = strVal.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmyMatch) {
    let [_, day, month, year] = dmyMatch;
    if (year.length === 2) year = "20" + year;
    return new Date(`${year}-${month}-${day}`);
  }

  // Try YYYY-MM-DD
  const ymdMatch = strVal.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymdMatch) {
    return new Date(strVal);
  }

  // Fallback
  const date = new Date(val);
  return isNaN(date.getTime()) ? null : date;
};

// Helper for Normalization
const normalizeValue = (val, map) => {
  if (!val) return null;
  return map[String(val).toLowerCase()] || val;
};

const RELIGION_MAP = {
  islam: "Moslem",
  muslim: "Moslem",
  moslem: "Moslem",
  kristen: "Christian",
  christian: "Christian",
  katolik: "Catholic",
  catholic: "Catholic",
  hindu: "Hindu",
  budha: "Buddhist",
  buddha: "Buddhist",
  buddhist: "Buddhist",
  khonghucu: "Konghucu",
};

const GENDER_MAP = {
  "laki-laki": "Male",
  pria: "Male",
  male: "Male",
  l: "Male",
  perempuan: "Female",
  wanita: "Female",
  female: "Female",
  p: "Female",
};

const MARITAL_MAP = {
  menikah: "Married",
  married: "Married",
  "belum menikah": "Single",
  single: "Single",
  lajang: "Single",
  cerai: "Divorced",
  divorced: "Divorced",
  janda: "Widow",
  widow: "Widow",
  duda: "Widower",
  widower: "Widower",
};

// Helper to resolve Master Data (ID or Name)
const resolveMasterData = (value, nameMap, idSet) => {
  if (!value) return { value: null, isValid: true };

  const strVal = String(value).trim();
  if (strVal === "" || strVal === "0" || strVal.toLowerCase() === "null") {
    return { value: null, isValid: true };
  }

  // Handle multiple values (comma separated)
  const parts = strVal.split(",").map((p) => p.trim());
  const resolvedIds = [];

  for (const part of parts) {
    if (part === "") continue;

    // Check ID
    if (idSet.has(part) || idSet.has(parseInt(part))) {
      resolvedIds.push(part);
      continue;
    }

    // Check Name
    const lowerName = part.toLowerCase();
    if (nameMap.has(lowerName)) {
      resolvedIds.push(nameMap.get(lowerName));
      continue;
    }

    // If one part is invalid, the whole field is invalid
    return { value: value, isValid: false, failedPart: part };
  }

  if (resolvedIds.length === 0) return { value: null, isValid: true };

  return { value: resolvedIds.join(","), isValid: true };
};

// POST import employees
router.post("/import", uploadExcel.single("file"), async (req, res) => {
  try {
    const pool = getPool();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const sheet = workbook.worksheets[0];
    const rows = [];

    sheet.eachRow((row, rowIndex) => {
      if (rowIndex === 1) return;
      rows.push({ index: rowIndex, values: row.values.slice(1) });
    });

    console.log(`📊 Parsed ${rows.length} rows from Excel`);

    // 1. Fetch Master Data
    // 1. Fetch Master Data
    const [branches, departments, positions, titles, locations] =
      await Promise.all([
        pool.query("SELECT id, branch_name FROM branches"),
        pool.query("SELECT id, dept_code FROM departments"),
        pool.query("SELECT id, position_name FROM positions"),
        pool.query("SELECT id, title_name FROM titles"),
        pool.query("SELECT id, office_name FROM location"),
      ]);

    // Build Lookup Maps (Name -> ID and ID Set)
    const createMaps = (data, nameField) => {
      const nameMap = new Map();
      const idSet = new Set();
      data[0].forEach((item) => {
        if (item[nameField]) {
          nameMap.set(String(item[nameField]).toLowerCase(), item.id);
        }
        idSet.add(item.id);
      });
      return { nameMap, idSet };
    };

    const branchMaps = createMaps(branches, "branch_name");
    const deptMaps = createMaps(departments, "dept_code");
    const posMaps = createMaps(positions, "position_name");
    const titleMaps = createMaps(titles, "title_name");
    const locMaps = createMaps(locations, "office_name");

    const validRows = [];
    const errors = [];

    // 2. Validate & Normalize Rows
    for (const { index, values } of rows) {
      const [
        full_name,
        nik,
        barcode,
        branch_val,
        dept_val,
        pos_val,
        location_val,
        title_val,
        employee_status,
        contract_count,
        join_date,
        effective_date,
        end_effective_date,
        resign_date_rehire,
        religion,
        gender,
        marital_status,
        place_of_birth,
        date_of_birth,
        address,
        phone,
        office_email,
        personal_email,
        npwp,
        bpjs_tk,
        bpjs_health,
        ktp_number,
        rfid_number,
      ] = values;

      // Basic required check
      if (!nik || !full_name) {
        errors.push({
          row: index,
          field: "nik/full_name",
          message: "NIK and Full Name are required",
          data: values,
        });
        continue;
      }

      // Resolve Master Data
      const branchRes = resolveMasterData(
        branch_val,
        branchMaps.nameMap,
        branchMaps.idSet,
      );
      // Branch usually single, but our resolver now handles comma-separated.
      // If schema is INT, we hope it's single. If multi, it will return "3,4" which might fail INSERT if INT.
      // But user requested multi-value logic for dept/pos/loc.
      if (!branchRes.isValid) {
        errors.push({
          row: index,
          field: "branch_id",
          message: `Branch '${branchRes.failedPart || branch_val}' not found`,
          data: values,
        });
        continue;
      }

      const deptRes = resolveMasterData(
        dept_val,
        deptMaps.nameMap,
        deptMaps.idSet,
      );
      if (!deptRes.isValid) {
        errors.push({
          row: index,
          field: "department_id",
          message: `Department '${deptRes.failedPart || dept_val}' not found`,
          data: values,
        });
        continue;
      }

      const posRes = resolveMasterData(pos_val, posMaps.nameMap, posMaps.idSet);
      if (!posRes.isValid) {
        errors.push({
          row: index,
          field: "position_id",
          message: `Position '${posRes.failedPart || pos_val}' not found`,
          data: values,
        });
        continue;
      }

      const locRes = resolveMasterData(
        location_val,
        locMaps.nameMap,
        locMaps.idSet,
      );
      if (!locRes.isValid) {
        errors.push({
          row: index,
          field: "location_id",
          message: `Location '${locRes.failedPart || location_val}' not found`,
          data: values,
        });
        continue;
      }

      const titleRes = resolveMasterData(
        title_val,
        titleMaps.nameMap,
        titleMaps.idSet,
      );
      if (!titleRes.isValid) {
        errors.push({
          row: index,
          field: "title_id",
          message: `Title '${titleRes.failedPart || title_val}' not found`,
          data: values,
        });
        continue;
      }

      // If all valid, prepare object
      validRows.push({
        originalValues: values,
        normalized: {
          full_name,
          nik: String(nik).trim(),
          barcode,
          branch_id: branchRes.value,
          department_id: deptRes.value,
          position_id: posRes.value,
          location_id: locRes.value,
          title_id: titleRes.value,
          employee_status,
          contract_count: contract_count || 0,
          join_date: parseDate(join_date),
          effective_date: parseDate(effective_date),
          end_effective_date: parseDate(end_effective_date),
          resign_date_rehire: parseDate(resign_date_rehire),
          religion: normalizeValue(religion, RELIGION_MAP),
          gender: normalizeValue(gender, GENDER_MAP),
          marital_status: normalizeValue(marital_status, MARITAL_MAP),
          place_of_birth,
          date_of_birth: parseDate(date_of_birth),
          address,
          phone,
          office_email,
          personal_email,
          npwp,
          bpjs_tk,
          bpjs_health,
          ktp_number,
          rfid_number,
        },
      });
    }

    // 3. Duplicate Check
    const niks = validRows.map((r) => r.normalized.nik);
    let existingNiks = new Set();

    if (niks.length > 0) {
      const [rows] = await pool.query(
        "SELECT nik FROM employees WHERE nik IN (?)",
        [niks],
      );
      rows.forEach((r) => existingNiks.add(r.nik));
    }

    const toInsert = [];
    const duplicates = [];
    const success_data = [];

    for (const r of validRows) {
      if (existingNiks.has(r.normalized.nik)) {
        duplicates.push({
          row_data: r.normalized,
          reason: "NIK already exists",
        });
      } else {
        toInsert.push(r.normalized);
      }
    }

    // 4. Batch Insert Valid Rows
    let success = 0;
    if (toInsert.length > 0) {
      // We process one by one to ensure robust error handling per row even in validation pass
      // Or we can simple loop insert
      for (const emp of toInsert) {
        try {
          await pool.query(
            `INSERT INTO employees (
              full_name, nik, barcode, branch_id, department_id, position_id, location_id, title_id,
              employee_status, contract_count, join_date, effective_date, end_effective_date,
              resign_date_rehire, religion, gender, marital_status, place_of_birth,
              date_of_birth, address, phone, office_email, personal_email, npwp,
              bpjs_tk, bpjs_health, ktp_number, rfid_number
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              emp.full_name,
              emp.nik,
              emp.barcode,
              emp.branch_id,
              emp.department_id,
              emp.position_id,
              emp.location_id,
              emp.title_id,
              emp.employee_status,
              emp.contract_count,
              emp.join_date,
              emp.effective_date,
              emp.end_effective_date,
              emp.resign_date_rehire,
              emp.religion,
              emp.gender,
              emp.marital_status,
              emp.place_of_birth,
              emp.date_of_birth,
              emp.address,
              emp.phone,
              emp.office_email,
              emp.personal_email,
              emp.npwp,
              emp.bpjs_tk,
              emp.bpjs_health,
              emp.ktp_number,
              emp.rfid_number,
            ],
          );
          success++;
          success_data.push(emp);
        } catch (err) {
          console.error("❌ DB Insert Error:", err.message);
          // Could be barcode duplicate or other unique constraints
          errors.push({
            row: -1,
            field: "database",
            message: err.message,
            data: emp,
          });
        }
      }
    }

    res.json({
      success_count: success,
      failed_count: errors.length,
      duplicate_count: duplicates.length,
      success_data: success_data,
      errors: errors,
      duplicates: duplicates,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed import", error: err.message });
  }
});

// POST Bulk Update Employees (for duplicate handling)
router.post("/bulk-update", async (req, res) => {
  try {
    const { employees } = req.body;
    if (!employees || !Array.isArray(employees) || employees.length === 0) {
      return res
        .status(400)
        .json({ message: "No employees provided for update" });
    }

    const pool = getPool();
    let updated = 0;
    const errors = [];

    for (const emp of employees) {
      try {
        // Prepare update query dynamically or hardcoded for all fields
        await pool.query(
          `UPDATE employees SET
            full_name = ?, barcode = ?, branch_id = ?, department_id = ?, position_id = ?, location_id = ?, title_id = ?,
            employee_status = ?, contract_count = ?, join_date = ?, effective_date = ?, end_effective_date = ?,
            resign_date_rehire = ?, religion = ?, gender = ?, marital_status = ?, place_of_birth = ?,
            date_of_birth = ?, address = ?, phone = ?, office_email = ?, personal_email = ?, npwp = ?,
            bpjs_tk = ?, bpjs_health = ?, ktp_number = ?, rfid_number = ?
           WHERE nik = ?`,
          [
            emp.full_name,
            emp.barcode,
            emp.branch_id,
            emp.department_id,
            emp.position_id,
            emp.location_id,
            emp.title_id,
            emp.employee_status,
            emp.contract_count,
            emp.join_date ? new Date(emp.join_date) : null,
            emp.effective_date ? new Date(emp.effective_date) : null,
            emp.end_effective_date ? new Date(emp.end_effective_date) : null,
            emp.resign_date_rehire ? new Date(emp.resign_date_rehire) : null,
            emp.religion,
            emp.gender,
            emp.marital_status,
            emp.place_of_birth,
            emp.date_of_birth ? new Date(emp.date_of_birth) : null,
            emp.address,
            emp.phone,
            emp.office_email,
            emp.personal_email,
            emp.npwp,
            emp.bpjs_tk,
            emp.bpjs_health,
            emp.ktp_number,
            emp.rfid_number,
            emp.nik, // Where cluse
          ],
        );
        updated++;
      } catch (err) {
        console.error("❌ Update Error:", emp.nik, err.message);
        errors.push({ nik: emp.nik, error: err.message });
      }
    }

    res.json({ success: true, updated_count: updated, errors });
  } catch (err) {
    console.error("Bulk update failed:", err);
    res.status(500).json({ message: "Bulk update failed", error: err.message });
  }
});

export default router;
