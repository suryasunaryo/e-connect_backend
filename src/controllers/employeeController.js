// controllers/employeeController.js
import { dbHelpers } from "../config/database.js";
import { emitDataChange } from "../utils/socketHelpers.js";
import bcrypt from "bcryptjs";

/**
 * GET ALL EMPLOYEES
 */
export const getAllEmployees = async (req, res) => {
  try {
    const employees = await dbHelpers.query(`
      SELECT 
        e.*, 
        d.dept_name as department_name,
        p.position_name as position_name,
        t.title_name as title_name,
        b.branch_name as branch_name,
        l.office_name as location_name,
        s.shift_name as shift_name
      FROM employees e 
      LEFT JOIN departments d ON e.department_id = d.id 
      LEFT JOIN positions p ON e.position_id = p.id
      LEFT JOIN titles t ON e.title_id = t.id
      LEFT JOIN branches b ON e.branch_id = b.id
      LEFT JOIN location l ON e.location_id = l.id
      LEFT JOIN attendance_shifts s ON e.employee_shift_id = s.shift_id
      WHERE e.deleted_at IS NULL 
      ORDER BY e.full_name ASC
    `);
    res.json(employees);
  } catch (error) {
    console.error("❌ Error fetching employees:", error);
    res.status(500).json({ error: "Failed to fetch employees" });
  }
};

/**
 * GET EMPLOYEE BY ID
 */
export const getEmployeeById = async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await dbHelpers.queryOne(
      `
      SELECT 
        e.*, 
        d.dept_name as department_name,
        p.position_name,
        t.title_name,
        b.branch_name,
        l.office_name as location_name,
        s.shift_name as shift_name
      FROM employees e 
      LEFT JOIN departments d ON e.department_id = d.id 
      LEFT JOIN positions p ON e.position_id = p.id
      LEFT JOIN titles t ON e.title_id = t.id
      LEFT JOIN branches b ON e.branch_id = b.id
      LEFT JOIN location l ON e.location_id = l.id
      LEFT JOIN attendance_shifts s ON e.employee_shift_id = s.shift_id
      WHERE e.id = ? AND e.deleted_at IS NULL
    `,
      [id],
    );

    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    res.json(employee);
  } catch (error) {
    console.error("❌ Error fetching employee:", error);
    res.status(500).json({ error: "Failed to fetch employee" });
  }
};

/**
 * GET EMPLOYEE BY RFID
 */
export const getEmployeeByRfid = async (req, res) => {
  try {
    const { rfid_number } = req.body;

    if (!rfid_number) {
      return res.status(400).json({ error: "RFID number is required" });
    }

    const employee = await dbHelpers.queryOne(
      `
      SELECT 
        e.full_name, 
        e.nik, 
        e.picture, 
        e.employee_status,
        d.dept_name as department_name,
        p.position_name,
        t.title_name,
        b.branch_name
      FROM employees e 
      LEFT JOIN departments d ON e.department_id = d.id 
      LEFT JOIN positions p ON e.position_id = p.id
      LEFT JOIN titles t ON e.title_id = t.id
      LEFT JOIN branches b ON e.branch_id = b.id
      WHERE e.rfid_number = ? AND e.deleted_at IS NULL
    `,
      [rfid_number],
    );

    if (!employee) {
      return res.status(404).json({ error: "Card not recognized" });
    }

    res.json(employee);
  } catch (error) {
    console.error("❌ Error scanning RFID:", error);
    res.status(500).json({ error: "Failed to scan RFID" });
  }
};

/**
 * CREATE EMPLOYEE
 */
export const createEmployee = async (req, res) => {
  try {
    const {
      user_id,
      full_name,
      nik,
      barcode,
      branch_id,
      department_id,
      position_id,
      title_id,
      employee_status,
      contract_count = 0,
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
    } = req.body;

    // Handle file upload
    let picture = null;
    if (req.file) {
      picture = `/uploads/employees/${req.file.filename}`;
    } else if (req.body.picture) {
      // Fallback if picture is sent as string (e.g. URL)
      picture = req.body.picture;
    }

    // Validasi input berdasarkan struktur database
    if (
      !full_name ||
      !nik ||
      !barcode ||
      !branch_id ||
      !position_id ||
      !title_id ||
      !gender ||
      !marital_status
    ) {
      return res.status(400).json({
        error:
          "full_name, nik, barcode, branch_id, position_id, title_id, gender, and marital_status are required",
      });
    }

    // Check if NIK already exists
    const existingNIK = await dbHelpers.queryOne(
      "SELECT id FROM employees WHERE nik = ? AND deleted_at IS NULL",
      [nik],
    );

    if (existingNIK) {
      return res.status(400).json({
        error: "NIK already exists",
      });
    }

    // Check if barcode already exists
    const existingBarcode = await dbHelpers.queryOne(
      "SELECT id FROM employees WHERE barcode = ? AND deleted_at IS NULL",
      [barcode],
    );

    if (existingBarcode) {
      return res.status(400).json({
        error: "Barcode already exists",
      });
    }

    const result = await dbHelpers.execute(
      `INSERT INTO employees (
        user_id, full_name, picture, nik, barcode, branch_id, department_id, position_id, title_id,
        employee_status, contract_count, join_date, effective_date, end_effective_date, resign_date_rehire,
        religion, gender, marital_status, place_of_birth, date_of_birth, address, phone, office_email,
        personal_email, npwp, bpjs_tk, bpjs_health, ktp_number, rfid_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id || null,
        full_name,
        picture || null,
        nik,
        barcode,
        branch_id,
        department_id || null,
        position_id,
        title_id,
        employee_status || null,
        contract_count,
        join_date || null,
        effective_date || null,
        end_effective_date || null,
        resign_date_rehire || null,
        religion || null,
        gender,
        marital_status,
        place_of_birth || null,
        date_of_birth || null,
        address || null,
        phone || null,
        office_email || null,
        personal_email || null,
        npwp || null,
        bpjs_tk || null,
        bpjs_health || null,
        ktp_number || null,
        rfid_number || null,
      ],
    );

    const newEmployee = await dbHelpers.queryOne(
      `
      SELECT 
        e.*, 
        d.dept_name as department_name
      FROM employees e 
      LEFT JOIN departments d ON e.department_id = d.id 
      WHERE e.id = ?
    `,
      [result.insertId],
    );

    // Emit socket
    emitDataChange("employees", "create", newEmployee);

    res.status(201).json({
      success: true,
      message: "Employee created successfully",
      data: newEmployee,
    });
  } catch (error) {
    console.error("❌ Error creating employee:", error);
    res.status(500).json({ error: "Failed to create employee" });
  }
};

/**
 * UPDATE EMPLOYEE
 */
export const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      user_id,
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
    } = req.body;

    // Check if employee exists
    const existing = await dbHelpers.queryOne(
      "SELECT * FROM employees WHERE id = ? AND deleted_at IS NULL",
      [id],
    );

    if (!existing) {
      return res.status(404).json({ error: "Employee not found" });
    }

    // Handle file upload
    let picture = existing.picture;
    if (req.file) {
      picture = `/uploads/employees/${req.file.filename}`;
    } else if (req.body.picture !== undefined) {
      // If picture is explicitly sent (e.g. empty string to remove, or new URL)
      picture = req.body.picture;
    }

    // Check if NIK already exists (excluding current employee)
    if (nik && nik !== existing.nik) {
      const nikExists = await dbHelpers.queryOne(
        "SELECT id FROM employees WHERE nik = ? AND id != ? AND deleted_at IS NULL",
        [nik, id],
      );

      if (nikExists) {
        return res.status(400).json({
          error: "NIK already exists",
        });
      }
    }

    // Check if barcode already exists (excluding current employee)
    if (barcode && barcode !== existing.barcode) {
      const barcodeExists = await dbHelpers.queryOne(
        "SELECT id FROM employees WHERE barcode = ? AND id != ? AND deleted_at IS NULL",
        [barcode, id],
      );

      if (barcodeExists) {
        return res.status(400).json({
          error: "Barcode already exists",
        });
      }
    }

    // Check if NIK changed and employee has user_id
    const nikChanged = nik && nik !== existing.nik;
    const hasUserAccount = existing.user_id;

    // Start transaction if NIK changed and has user account
    if (nikChanged && hasUserAccount) {
      const pool = await dbHelpers.getPool();
      const connection = await pool.getConnection();

      try {
        await connection.beginTransaction();

        // Update employee
        await connection.query(
          `UPDATE employees 
           SET 
             user_id = ?, full_name = ?, picture = ?, nik = ?, barcode = ?, branch_id = ?,
             department_id = ?, position_id = ?, title_id = ?, employee_status = ?, contract_count = ?,
             join_date = ?, effective_date = ?, end_effective_date = ?, resign_date_rehire = ?,
             religion = ?, gender = ?, marital_status = ?, place_of_birth = ?, date_of_birth = ?,
             address = ?, phone = ?, office_email = ?, personal_email = ?, npwp = ?,
             bpjs_tk = ?, bpjs_health = ?, ktp_number = ?, rfid_number = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE id = ?`,
          [
            user_id !== undefined ? user_id : existing.user_id,
            full_name || existing.full_name,
            picture,
            nik || existing.nik,
            barcode || existing.barcode,
            branch_id || existing.branch_id,
            department_id !== undefined
              ? department_id
              : existing.department_id,
            position_id || existing.position_id,
            title_id || existing.title_id,
            employee_status !== undefined
              ? employee_status
              : existing.employee_status,
            contract_count !== undefined
              ? contract_count
              : existing.contract_count,
            join_date !== undefined ? join_date : existing.join_date,
            effective_date !== undefined
              ? effective_date
              : existing.effective_date,
            end_effective_date !== undefined
              ? end_effective_date
              : existing.end_effective_date,
            resign_date_rehire !== undefined
              ? resign_date_rehire
              : existing.resign_date_rehire,
            religion !== undefined ? religion : existing.religion,
            gender || existing.gender,
            marital_status || existing.marital_status,
            place_of_birth !== undefined
              ? place_of_birth
              : existing.place_of_birth,
            date_of_birth !== undefined
              ? date_of_birth
              : existing.date_of_birth,
            address !== undefined ? address : existing.address,
            phone !== undefined ? phone : existing.phone,
            office_email !== undefined ? office_email : existing.office_email,
            personal_email !== undefined
              ? personal_email
              : existing.personal_email,
            npwp !== undefined ? npwp : existing.npwp,
            bpjs_tk !== undefined ? bpjs_tk : existing.bpjs_tk,
            bpjs_health !== undefined ? bpjs_health : existing.bpjs_health,
            ktp_number !== undefined ? ktp_number : existing.ktp_number,
            rfid_number !== undefined ? rfid_number : existing.rfid_number,
            id,
          ],
        );

        // Update username in users table
        await connection.query("UPDATE users SET username = ? WHERE id = ?", [
          nik,
          existing.user_id,
        ]);

        await connection.commit();
        connection.release();

        console.log(
          `✅ Updated employee NIK and username: ${existing.nik} → ${nik}`,
        );
      } catch (error) {
        await connection.rollback();
        connection.release();
        throw error;
      }
    } else {
      // Normal update without transaction
      await dbHelpers.execute(
        `UPDATE employees 
         SET 
           user_id = ?, full_name = ?, picture = ?, nik = ?, barcode = ?, branch_id = ?,
           department_id = ?, position_id = ?, title_id = ?, employee_status = ?, contract_count = ?,
           join_date = ?, effective_date = ?, end_effective_date = ?, resign_date_rehire = ?,
           religion = ?, gender = ?, marital_status = ?, place_of_birth = ?, date_of_birth = ?,
           address = ?, phone = ?, office_email = ?, personal_email = ?, npwp = ?,
           bpjs_tk = ?, bpjs_health = ?, ktp_number = ?, rfid_number = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [
          user_id !== undefined ? user_id : existing.user_id,
          full_name || existing.full_name,
          picture, // Use the resolved picture variable
          nik || existing.nik,
          barcode || existing.barcode,
          branch_id || existing.branch_id,
          department_id !== undefined ? department_id : existing.department_id,
          position_id || existing.position_id,
          title_id || existing.title_id,
          employee_status !== undefined
            ? employee_status
            : existing.employee_status,
          contract_count !== undefined
            ? contract_count
            : existing.contract_count,
          join_date !== undefined ? join_date : existing.join_date,
          effective_date !== undefined
            ? effective_date
            : existing.effective_date,
          end_effective_date !== undefined
            ? end_effective_date
            : existing.end_effective_date,
          resign_date_rehire !== undefined
            ? resign_date_rehire
            : existing.resign_date_rehire,
          religion !== undefined ? religion : existing.religion,
          gender || existing.gender,
          marital_status || existing.marital_status,
          place_of_birth !== undefined
            ? place_of_birth
            : existing.place_of_birth,
          date_of_birth !== undefined ? date_of_birth : existing.date_of_birth,
          address !== undefined ? address : existing.address,
          phone !== undefined ? phone : existing.phone,
          office_email !== undefined ? office_email : existing.office_email,
          personal_email !== undefined
            ? personal_email
            : existing.personal_email,
          npwp !== undefined ? npwp : existing.npwp,
          bpjs_tk !== undefined ? bpjs_tk : existing.bpjs_tk,
          bpjs_health !== undefined ? bpjs_health : existing.bpjs_health,
          ktp_number !== undefined ? ktp_number : existing.ktp_number,
          rfid_number !== undefined ? rfid_number : existing.rfid_number,
          id,
        ],
      );
    }

    const updatedEmployee = await dbHelpers.queryOne(
      `
      SELECT 
        e.*, 
        d.dept_name as department_name,
        l.office_name as location_name,
        s.shift_name as shift_name
      FROM employees e 
      LEFT JOIN departments d ON e.department_id = d.id 
      LEFT JOIN location l ON e.location_id = l.id
      LEFT JOIN attendance_shifts s ON e.employee_shift_id = s.shift_id
      WHERE e.id = ?
    `,
      [id],
    );

    // Emit socket
    emitDataChange("employees", "update", updatedEmployee);

    res.json({
      success: true,
      message: "Employee updated successfully",
      data: updatedEmployee,
    });
  } catch (error) {
    console.error("❌ Error updating employee:", error);
    res.status(500).json({ error: "Failed to update employee" });
  }
};

/**
 * DELETE EMPLOYEE (SOFT DELETE)
 */
export const deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if employee exists
    const existing = await dbHelpers.queryOne(
      "SELECT * FROM employees WHERE id = ? AND deleted_at IS NULL",
      [id],
    );

    if (!existing) {
      return res.status(404).json({ error: "Employee not found" });
    }

    // Start transaction for cascade delete
    const pool = await dbHelpers.getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Soft delete employee
      await connection.query(
        "UPDATE employees SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?",
        [id],
      );

      // If employee has associated user, soft delete the user as well
      if (existing.user_id) {
        await connection.query(
          "UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?",
          [existing.user_id],
        );
      }

      await connection.commit();
      connection.release();

      // Emit socket
      emitDataChange("employees", "delete", { id });
      if (existing.user_id) {
        emitDataChange("users", "delete", { id: existing.user_id });
      }

      res.json({
        success: true,
        message: "Employee deleted successfully",
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error("❌ Error deleting employee:", error);
    res.status(500).json({ error: "Failed to delete employee" });
  }
};

/**
 * CREATE USER FROM EMPLOYEE
 */
export const createUserFromEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, password } = req.body;

    // Validate input
    if (!role || !password) {
      return res.status(400).json({
        error: "Role and password are required",
      });
    }

    // Check if employee exists
    const employee = await dbHelpers.queryOne(
      "SELECT * FROM employees WHERE id = ? AND deleted_at IS NULL",
      [id],
    );

    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    // Check if employee already has a user account
    if (employee.user_id) {
      return res.status(400).json({
        error: "Employee already has a user account",
      });
    }

    // Check if username (NIK) already exists
    const existingUser = await dbHelpers.queryOne(
      "SELECT id FROM users WHERE username = ?",
      [employee.nik],
    );

    if (existingUser) {
      return res.status(400).json({
        error: `Username ${employee.nik} already exists`,
      });
    }

    // Start transaction
    const pool = await dbHelpers.getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Fetch permissions from users_role based on role ID
      const [roleData] = await connection.query(
        "SELECT menu_groups, menu_access FROM users_role WHERE role_id = ? AND deleted_at IS NULL",
        [role],
      );

      const menu_groups = roleData?.[0]?.menu_groups || null;
      const menu_access = roleData?.[0]?.menu_access || null;

      // Hash password
      const hashedPassword = bcrypt.hashSync(password, 10);

      // Create user
      const [userResult] = await connection.query(
        `INSERT INTO users (username, password, role, menu_groups, menu_access, full_name, email, phone, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          employee.nik,
          hashedPassword,
          role,
          menu_groups,
          menu_access,
          employee.full_name || "",
          employee.office_email || employee.personal_email || "",
          employee.phone || "",
          true,
        ],
      );

      const newUserId = userResult.insertId;

      // Update employee with user_id
      await connection.query("UPDATE employees SET user_id = ? WHERE id = ?", [
        newUserId,
        id,
      ]);

      await connection.commit();
      connection.release();

      // Fetch the created user
      const newUser = await dbHelpers.queryOne(
        "SELECT id, username, role, full_name, email, phone, is_active FROM users WHERE id = ?",
        [newUserId],
      );

      // Emit socket
      emitDataChange("users", "create", newUser);
      emitDataChange("employees", "update", { id, user_id: newUserId });

      res.status(201).json({
        success: true,
        message: "User created successfully",
        data: {
          user: newUser,
          employee_id: id,
        },
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error("❌ Error creating user from employee:", error);
    res.status(500).json({ error: "Failed to create user" });
  }
};
/**
 * AUTO CREATE USERS FOR ALL EMPLOYEES WITHOUT USER ACCOUNT
 */
export const autoCreateUsers = async (req, res) => {
  try {
    const { role, password } = req.body;

    if (!role || !password) {
      return res.status(400).json({
        error: "Role and default password are required",
      });
    }

    // 1. Get role permissions details
    // Frontend sends role ID (primary key), so we query by id
    const roleData = await dbHelpers.queryOne(
      "SELECT role_id, menu_groups, menu_access, menu_permissions FROM users_role WHERE id = ? AND deleted_at IS NULL",
      [role],
    );

    if (!roleData) {
      return res.status(400).json({ error: "Selected role not found" });
    }

    // 2. Get target employees (no user_id)
    const employees = await dbHelpers.query(
      "SELECT * FROM employees WHERE user_id IS NULL AND deleted_at IS NULL",
    );

    if (employees.length === 0) {
      return res.json({
        success: true,
        message: "No employees found without user account",
        createdCount: 0,
      });
    }

    // 3. Prepare common data
    const hashedPassword = bcrypt.hashSync(password, 10);
    const pool = await dbHelpers.getPool();
    const connection = await pool.getConnection();

    let createdCount = 0;
    let skippedCount = 0;
    let errors = [];

    try {
      await connection.beginTransaction();

      for (const emp of employees) {
        if (!emp.nik) {
          skippedCount++;
          errors.push(`Employee ${emp.full_name} skipped: Missing NIK`);
          continue;
        }

        // Check if username (NIK) already exists in users table
        // (This handles case where employee doesn't have user_id link but user exists)
        const [existingUser] = await connection.query(
          "SELECT id FROM users WHERE username = ?",
          [emp.nik],
        );

        if (existingUser.length > 0) {
          skippedCount++;
          // Optional: Link existing user? For now just skip to avoid overwriting/guessing
          errors.push(
            `Employee ${emp.full_name} skipped: Username ${emp.nik} already exists`,
          );
          continue;
        }

        // Create user
        const [userResult] = await connection.query(
          `INSERT INTO users (username, password, role, menu_groups, menu_access, menu_permissions, full_name, email, phone, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            emp.nik, // Username is NIK
            hashedPassword,
            roleData.role_id, // Use the string identifier from role table
            roleData.menu_groups,
            roleData.menu_access,
            roleData.menu_permissions
              ? typeof roleData.menu_permissions === "object"
                ? JSON.stringify(roleData.menu_permissions)
                : roleData.menu_permissions
              : null,
            emp.full_name || "",
            emp.office_email || emp.personal_email || "",
            emp.phone || "",
            true,
          ],
        );

        const newUserId = userResult.insertId;

        // Update employee
        await connection.query(
          "UPDATE employees SET user_id = ? WHERE id = ?",
          [newUserId, emp.id],
        );

        createdCount++;
      }

      await connection.commit();

      // Emit socket event to refresh client lists
      if (createdCount > 0) {
        emitDataChange("users", "bulk-create", { count: createdCount });
        emitDataChange("employees", "bulk-update", { count: createdCount });
      }

      res.json({
        success: true,
        message: `Successfully created ${createdCount} users. Skipped ${skippedCount}.`,
        createdCount,
        skippedCount,
        details: errors,
      });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("❌ Error auto creating users:", error);
    res.status(500).json({ error: "Failed to auto create users" });
  }
};
