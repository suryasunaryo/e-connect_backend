# Truck Queue Management System - Backend

E-Connect Backend is a robust Node.js server built with **Express** and **MySQL**, providing the REST API and real-time capabilities for the Truck Queue Management System.

## 🚀 Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MySQL
- **Real-time:** Socket.io
- **Authentication:** JWT (JSON Web Tokens)
- **Encryption:** Bcrypt
- **File Handling:** Multer, ExcelJS
- **Logging:** Winston
- **Date/Time:** Luxon, Moment.js

## 🛠️ Features

- **RESTful API:** Complete CRUD operations for all modules.
- **WebSocket Integration:** Real-time data synchronization for dashboards.
- **RBAC (Role-Based Access Control):** Secure access management for different user roles.
- **Database Migrations:** Automated schema setup and updates.
- **File Management:** Upload and download handling for documents and images.
- **Structured Logging:** Daily rotated log files for debugging and monitoring.

## 📦 Installation

1. Navigate to the backend directory:

   ```bash
   cd Development/backend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure environment variables:
   - Edit the `.env` file with your database credentials and secret keys.

4. Setup Database:
   ```bash
   npm run setup
   ```

## ⚒️ Available Scripts

- `npm start`: Starts the server in production mode.
- `npm run dev`: Starts the server with `nodemon` for development.
- `npm run migrate`: Runs database migrations.
- `npm run verify-db`: Checks database schema integrity.
- `npm run setup`: Full database initialization (migrate + verify).

## 📂 Folder Structure

- `src/controllers`: Request handlers and business logic.
- `src/routes`: API endpoint definitions.
- `src/migrations`: Database schema and migration scripts.
- `src/middleware`: Custom Express middlewares (Auth, Logging, etc.).
- `src/services`: Core logic and integration services.
- `src/utils`: Common utility functions.
- `uploads/`: Storage for uploaded files.

---

© 2026 E-Connect Project
