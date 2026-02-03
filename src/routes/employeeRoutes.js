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
// Configure Multer for Employee Pictures
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

const upload = multer({
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

// GET employee by ID
router.get(
  "/:id",
  activityLogger.logModuleActivity("employees", "READ"),
  getEmployeeById,
);

// CREATE new employee
router.post(
  "/",
  upload.single("picture"),
  activityLogger.logModuleActivity("employees", "CREATE"),
  createEmployee,
);

// UPDATE employee
router.put(
  "/:id",
  upload.single("picture"),
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

// POST import employees
router.post("/import", upload.single("file"), async (req, res) => {
  try {
    const pool = getPool(); // Get pool instance
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const sheet = workbook.worksheets[0];
    const rows = [];

    sheet.eachRow((row, rowIndex) => {
      if (rowIndex === 1) return;
      rows.push(row.values.slice(1));
    });

    console.log(`📊 Parsed ${rows.length} rows from Excel`);

    let success = 0;
    let failed = 0;
    const errors = [];

    for (const r of rows) {
      const [
        full_name,
        nik,
        barcode,
        branch_id,
        department_id,
        position_id,
        title_id,
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
      ] = r;

      // Normalize data
      const parseDate = (val) => {
        console.log(`[DEBUG] Parsing date value: "${val}" (${typeof val})`);

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
        const dmyMatch = strVal.match(
          /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/,
        );
        if (dmyMatch) {
          let [_, day, month, year] = dmyMatch;
          // Handle 2 digit year
          if (year.length === 2) {
            year = "20" + year;
          }
          return new Date(`${year}-${month}-${day}`);
        }

        // Try YYYY-MM-DD
        const ymdMatch = strVal.match(
          /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/,
        );
        if (ymdMatch) {
          return new Date(strVal);
        }

        // Fallback to standard date parsing
        const date = new Date(val);
        if (isNaN(date.getTime())) {
          console.warn(`[WARN] Failed to parse date: "${val}"`);
          return null;
        }
        return date;
      };

      const normalizeReligion = (val) => {
        if (!val) return null;
        const map = {
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
        };
        return map[String(val).toLowerCase()] || val;
      };

      const normalizeGender = (val) => {
        if (!val) return null;
        const map = {
          "laki-laki": "Male",
          pria: "Male",
          male: "Male",
          l: "Male",
          perempuan: "Female",
          wanita: "Female",
          female: "Female",
          p: "Female",
        };
        return map[String(val).toLowerCase()] || val;
      };

      const normalizeMaritalStatus = (val) => {
        if (!val) return null;
        const map = {
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
        return map[String(val).toLowerCase()] || val;
      };

      const normalizedReligion = normalizeReligion(religion);
      const normalizedGender = normalizeGender(gender);
      const normalizedMaritalStatus = normalizeMaritalStatus(marital_status);

      // Parse dates
      const parsedJoinDate = parseDate(join_date);
      const parsedEffectiveDate = parseDate(effective_date);
      const parsedEndEffectiveDate = parseDate(end_effective_date);
      const parsedResignDate = parseDate(resign_date_rehire);
      const parsedDOB = parseDate(date_of_birth);

      try {
        await pool.query(
          `INSERT INTO employees (
            full_name,
            nik,
            barcode,
            branch_id,
            department_id,
            position_id,
            title_id,
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
            rfid_number
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            full_name,
            nik,
            barcode,
            branch_id,
            department_id,
            position_id,
            title_id,
            employee_status,
            contract_count,
            parsedJoinDate,
            parsedEffectiveDate,
            parsedEndEffectiveDate,
            parsedResignDate,
            normalizedReligion,
            normalizedGender,
            normalizedMaritalStatus,
            place_of_birth,
            parsedDOB,
            address,
            phone,
            office_email,
            personal_email,
            npwp,
            bpjs_tk,
            bpjs_health,
            ktp_number,
            rfid_number,
          ],
        );

        success++;
      } catch (err) {
        console.error("❌ Error inserting row:", r, err.message);
        errors.push({ row: r, error: err.message });
        failed++;
      }
    }

    res.json({ success, failed, errors });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed import", error: err.message });
  }
});

export default router;
