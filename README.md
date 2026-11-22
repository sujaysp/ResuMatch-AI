# ResuMatch AI

An AI-powered resume analysis and job matching platform that helps candidates understand how well their resumes align with job descriptions.  ResuMatch AI identifies matching skills, highlights skill gaps, generates actionable recommendations, and saves analysis reports so users can track their progress.

## Features

- **Resume Analysis:** Upload a PDF resume and extract its content for analysis.
- **Job Description Matching:** Compare resume content against a target job description.
- **Skill Match Analysis:** Identify recognized matching skills and missing skills.
- **AI-Powered Recommendations:** Get suggestions to improve resume alignment using Google Gemini.
- **Analysis History:** Save and revisit previous analysis reports.
- **Report Details:** View individual analysis reports and their results.
- **User Authentication:** Register and sign in using email and password.
- **Google Sign-In:** Authenticate using Google Identity Services.
- **Account Linking:** Link Google authentication to an existing account.
- **Phone Authentication Demo:** Test phone OTP verification in local development. This is a development simulator, not a live SMS service.

## Technology Stack

### Frontend
- React 19
- Vite 8
- JavaScript
- CSS
- Lucide React

### Backend
- Node.js
- Express 5
- MongoDB and Mongoose
- JSON Web Tokens (JWT)
- bcryptjs
- Zod validation
- Multer
- PDF.js

### AI and Authentication
- Google Gemini API
- Google Identity Services
- Google Auth Library
- JWT-based authentication

## Project Structure

```text
ResuMatch-AI/
│
├── client/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── services/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── index.css
│   ├── .env.example
│   ├── package.json
│   └── vite.config.js
│
├── server/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── data/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── validators/
│   │   └── server.js
│   ├── tests/
│   ├── .env.example
│   └── package.json
│
├── docs/
│   └── architecture.md
│
├── .gitignore
└── README.md
```

## Run Locally

### Prerequisites

- Node.js 20.19+ or 22.12+
- npm
- MongoDB connection string
- Google OAuth Web Client ID
- Gemini API key for AI recommendation features

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd ResuMatch-AI
```

### 2. Configure the backend

From the project root:

```powershell
cd server
npm install
```

Create your local environment file by copying the example:

```powershell
Copy-Item .env.example .env
```

Open `server/.env` and configure your MongoDB connection string, JWT secret, Google OAuth Client ID, and Gemini API key.

Start the backend:

```powershell
npm run dev
```

The backend normally runs at:

`http://localhost:5000`

### 3. Configure the frontend

Open a second terminal from the project root:

```powershell
cd client
npm install
```

Create your local environment file:

```powershell
Copy-Item .env.example .env
```

Open `client/.env` and configure your Google OAuth Client ID and backend API URL.

For local development, the API URL is:

`http://localhost:5000/api`

Start the frontend:

```powershell
npm run dev
```

Vite normally serves the application at:

`http://localhost:5173`

## Testing

Run the backend test suite:

```powershell
cd server
npm test
```

Run frontend lint checks:

```powershell
cd client
npm run lint
```

Create a production frontend build:

```powershell
npm run build
```

## Phone OTP Development Note

The phone OTP flow is a local development demonstration. It generates and verifies OTP codes within the development environment. It does not send SMS messages.

Production phone verification requires integration with a genuine SMS delivery provider. Phone OTP endpoints are not a production SMS service.

## Security

- Never commit `.env` files or private API credentials.
- Keep MongoDB connection strings and JWT secrets private.
- Use strong, unique secrets in production.
- Configure Google OAuth authorized origins for deployed domains.
- Configure backend CORS for the deployed frontend domain.
- Validate uploaded files and protect authenticated API routes.

## Important Note

The skill match score represents recognized skill coverage between the resume and job description. It should not be interpreted as a universal ATS score or a guarantee of recruitment success.