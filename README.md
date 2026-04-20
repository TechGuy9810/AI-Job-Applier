# AI-Job-Applier

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

AI-Job-Applier is a comprehensive full-stack solution designed to streamline the job application process. It equips users with powerful AI features to intuitively and efficiently apply for jobs across different platforms, automating repetitive form-filling tasks and providing resume generation capabilities.

## 🚀 Features

### AI Form Filler (Chrome Extension)
- **Automatic Context Filling**: Instantly fills out complex job application forms using your structured personal profile data.
- **Backend Sync**: Securely syncs your updated profile details from the backend.
- **AI-Powered**: Uses intelligent content matching to map your profile details to varying form fields across different career sites.

### Backend Application System
- **Profile Management**: Manage your comprehensive user profile, work experience, and educational background.
- **Resume Generator**: Generates formatted, personalized PDF resumes dynamically.
- **Behavioral Q&A**: Uses AI to suggest and frame answers for common behavioral questions based on your profile context.
- **Secure Authentication**: Robust user authentication and secure profile data storage using JWT and MongoDB.

## 🏗️ Architecture Stack

### Backend
- **Node.js** & **Express.js**: Core API framework.
- **MongoDB** & **Mongoose**: Database and ODM.
- **PDFKit**: For dynamic PDF resume generation.
- **Zod**: Input validation.
- **JSON Web Tokens (JWT)**: Secure user authentication.

### Frontend / Extension
- **Manifest V3 Chrome Extension**: Modern browser extension API.
- **Vanilla JS, HTML, CSS**: Lightweight and fast frontend for the extension popup and content scripts.

## 🗺️ System Architecture

```mermaid
graph LR
    User([User]) -->|Interacts with| Extension
    subgraph Frontend
        Extension[Chrome Extension (Form Filler)]
    end
    subgraph Backend Services
        API[Node.js / Express API]
        DB[(MongoDB Database)]
        PDF[PDF Generator (PDFKit)]
    end
    Extension -->|JWT / HTTPS| API
    API <-->|Mongoose| DB
    API -->|Generates| PDF
```

## 🔌 Core API Endpoints

- `POST /api/auth/*` - User registration, authentication, login.
- `GET /api/profile/*` - Fetch, update, and manage structured user profile context.
- `GET/POST /api/resumes/*` - Manage and preview resume records.
- `GET /api/generated-resumes/*` - Fetch and download compiled PDFs dynamically.
- `GET/POST /api/applications/*` - Manage individual job applications status and tracking.

## ⚙️ Setup & Installation

### 1. Backend Setup

1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your environment variables:
   Create a `.env` file in the `backend` directory with the following variables:
   ```env
   PORT=5000
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   # Add other required API keys (e.g., Google Auth, AI services)
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

### 2. Browser Extension Setup (Chrome)

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** in the top right corner.
3. Click on **Load unpacked**.
4. Select the `formfiller` directory located at the root of this project.
5. The extension should now be installed and visible in your browser toolbar.
6. Open the extension popup to log in and sync your profile.

## 📖 Usage

1. Start your backend server to ensure the extension can authenticate and fetch your profile.
2. Navigate to any job application page (e.g., Workday, Greenhouse, Lever).
3. Click on the **AI Form Filler** extension icon.
4. Let the AI analyze the form and inject your work history, education, and standard answers efficiently.

## 🛡️ License

This project is licensed under the MIT License.
