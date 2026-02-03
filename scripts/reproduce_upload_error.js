import axios from "axios";
import ExcelJS from "exceljs";
import FormData from "form-data";
import fs from "fs";

const createDummyExcel = async () => {
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

  // Add a dummy row
  sheet.addRow({
    full_name: "Test Employee",
    nik: "9999999999",
    barcode: "BARCODE999",
    branch_id: 1,
    department_id: 1,
    position_id: 1,
    title_id: 1,
    employee_status: "Permanent",
    contract_count: 0,
    join_date: "2023-01-01",
    effective_date: "2023-01-01",
    end_effective_date: null,
    resign_date_rehire: null,
    religion: "Islam",
    gender: "Male",
    marital_status: "Single",
    place_of_birth: "Jakarta",
    date_of_birth: "1990-01-01",
    address: "Jl. Test No. 1",
    phone: "08123456789",
    office_email: "test@example.com",
    personal_email: "test.personal@example.com",
    npwp: "12.345.678.9-012.000",
    bpjs_tk: "12345678901",
    bpjs_health: "0001234567890",
    ktp_number: "3171234567890001",
    rfid_number: "RFID123456",
  });

  await workbook.xlsx.writeFile("test_upload.xlsx");
  console.log("Created test_upload.xlsx");
};

const login = async () => {
  try {
    const response = await axios.post("http://localhost:4002/api/auth/login", {
      username: "admin",
      password: "admin123",
    });
    console.log("Login successful");
    return response.data.token;
  } catch (error) {
    console.error(
      "Login failed:",
      error.response ? error.response.data : error.message
    );
    process.exit(1);
  }
};

const uploadFile = async (token) => {
  try {
    const form = new FormData();
    form.append("file", fs.createReadStream("test_upload.xlsx"));

    const response = await axios.post(
      "http://localhost:4002/api/employees/import",
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${token}`,
        },
      }
    );

    console.log("Upload response:", JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error(
      "Upload failed:",
      error.response ? error.response.data : error.message
    );
  }
};

const run = async () => {
  await createDummyExcel();
  const token = await login();
  await uploadFile(token);
};

run();
