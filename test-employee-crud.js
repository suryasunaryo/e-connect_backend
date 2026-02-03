// Test Employee CRUD Operations
// Run this with: node test-employee-crud.js

const API_BASE = "http://localhost:4000/api";

// You need to replace this with a valid JWT token from your login
const AUTH_TOKEN = "YOUR_JWT_TOKEN_HERE";

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${AUTH_TOKEN}`,
};

async function testEmployeeCRUD() {
  console.log("🧪 Testing Employee CRUD Operations\n");

  try {
    // TEST 1: GET ALL EMPLOYEES
    console.log("1️⃣ Testing GET /api/employees");
    const getResponse = await fetch(`${API_BASE}/employees`, { headers });
    const employees = await getResponse.json();
    console.log(`✅ Status: ${getResponse.status}`);
    console.log(`📊 Found ${Array.isArray(employees) ? employees.length : 0} employees\n`);

    // TEST 2: CREATE NEW EMPLOYEE
    console.log("2️⃣ Testing POST /api/employees");
    const newEmployee = {
      full_name: "Test Employee",
      nik: `TEST${Date.now()}`,
      barcode: `BC${Date.now()}`,
      branch_id: 1,
      position_id: 1,
      title_id: 1,
      gender: "M",
      marital_status: "Single",
      phone: "08123456789",
      office_email: "test@company.com",
    };

    const createResponse = await fetch(`${API_BASE}/employees`, {
      method: "POST",
      headers,
      body: JSON.stringify(newEmployee),
    });
    const createResult = await createResponse.json();
    console.log(`✅ Status: ${createResponse.status}`);
    console.log(`📝 Response:`, createResult);

    if (createResponse.status === 201 && createResult.data) {
      const employeeId = createResult.data.id;
      console.log(`✅ Created employee ID: ${employeeId}\n`);

      // TEST 3: GET SINGLE EMPLOYEE
      console.log(`3️⃣ Testing GET /api/employees/${employeeId}`);
      const getSingleResponse = await fetch(`${API_BASE}/employees/${employeeId}`, { headers });
      const singleEmployee = await getSingleResponse.json();
      console.log(`✅ Status: ${getSingleResponse.status}`);
      console.log(`📄 Employee:`, singleEmployee.full_name, "\n");

      // TEST 4: UPDATE EMPLOYEE
      console.log(`4️⃣ Testing PUT /api/employees/${employeeId}`);
      const updateData = {
        full_name: "Test Employee Updated",
        phone: "08199999999",
      };
      const updateResponse = await fetch(`${API_BASE}/employees/${employeeId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(updateData),
      });
      const updateResult = await updateResponse.json();
      console.log(`✅ Status: ${updateResponse.status}`);
      console.log(`📝 Updated:`, updateResult.data?.full_name, "\n");

      // TEST 5: DELETE EMPLOYEE
      console.log(`5️⃣ Testing DELETE /api/employees/${employeeId}`);
      const deleteResponse = await fetch(`${API_BASE}/employees/${employeeId}`, {
        method: "DELETE",
        headers,
      });
      const deleteResult = await deleteResponse.json();
      console.log(`✅ Status: ${deleteResponse.status}`);
      console.log(`🗑️ Result:`, deleteResult.message, "\n");

      // TEST 6: VERIFY DELETE (should return 404)
      console.log(`6️⃣ Verifying deletion...`);
      const verifyResponse = await fetch(`${API_BASE}/employees/${employeeId}`, { headers });
      console.log(`✅ Status: ${verifyResponse.status} (should be 404)\n`);
    } else {
      console.error("❌ Failed to create employee:", createResult);
    }

    console.log("✅ All tests completed!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

// Run tests
testEmployeeCRUD();
