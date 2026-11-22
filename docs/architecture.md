\# ResuMatch AI — Architecture



\## 1. Application Overview



ResuMatch AI is a full-stack application with three main parts:



\- React frontend for the user interface.

\- Express backend for authentication, resume processing and analysis.

\- MongoDB for storing users, resumes and analysis reports.



Google Gemini provides AI-powered recommendations.



\## 2. Frontend Architecture



Technology: React 19, Vite 8 and JavaScript.



The frontend is responsible for:

\- User registration and login.

\- Google sign-in through Google Identity Services.

\- Account linking.

\- Resume upload and job description submission.

\- Displaying skill matching results.

\- Viewing saved reports and analysis history.



The API service communicates with the backend using HTTP requests.



\## 3. Backend Architecture



Technology: Node.js and Express 5.



The backend uses a layered structure:



\- Routes define API endpoints.

\- Middleware handles authentication, validation and file uploads.

\- Controllers handle incoming requests and responses.

\- Services contain resume parsing, skill extraction, comparison and AI recommendation logic.

\- Models define MongoDB collections using Mongoose.

\- Validators check incoming request data.



\## 4. Authentication



Supported authentication methods:



\- Email and password using bcryptjs.

\- Google sign-in using Google Identity Services and backend token verification.

\- Development-only phone OTP demonstration.



JWT tokens are used to authenticate protected API requests.



Google account linking connects a Google identity to an existing account.



\## 5. Resume Analysis Workflow



1\. The user uploads a PDF resume.

2\. The backend validates and processes the uploaded document.

3\. PDF.js extracts readable text.

4\. The skill extraction engine identifies recognized technical skills.

5\. The job description analyzer identifies required skills.

6\. The comparison engine calculates skill coverage and identifies gaps.

7\. Gemini can generate additional improvement recommendations.

8\. Analysis results are stored and can be viewed later.



\## 6. Database Models



The application uses MongoDB and Mongoose.



Main models:



\- User: account and authentication information.

\- Resume: uploaded resume metadata and extracted text.

\- Analysis: resume comparison results and recommendations.

\- OtpChallenge: temporary development OTP verification challenges.



\## 7. Phone OTP Limitation



The phone OTP feature currently works as a local development simulator.



It does not deliver SMS messages. Production phone verification requires a genuine SMS provider.



\## 8. Environment Configuration



The frontend uses:



\- VITE\_API\_BASE\_URL

\- VITE\_GOOGLE\_CLIENT\_ID



The backend uses:



\- NODE\_ENV

\- PORT

\- CLIENT\_URL

\- MONGODB\_URI

\- JWT\_SECRET

\- JWT\_EXPIRES\_IN

\- GOOGLE\_CLIENT\_ID

\- GEMINI\_API\_KEY

\- GEMINI\_MODEL



Actual environment files must never be committed to version control.
