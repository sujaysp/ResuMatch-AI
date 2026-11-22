const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const apiRequest = async (
  endpoint,
  {
    method = "GET",
    token,
    body,
    headers = {},
  } = {}
) => {
  const requestHeaders = new Headers(headers);

  if (token) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;

  if (body !== undefined && !isFormData) {
    requestHeaders.set("Content-Type", "application/json");
  }

  let response;

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: requestHeaders,
      body:
        body === undefined
          ? undefined
          : isFormData
            ? body
            : JSON.stringify(body),
    });
  } catch {
    throw new Error(
      "Could not reach the ResuMatch server. Check that the backend is running and the API URL is correct."
    );
  }

  const responseData = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      responseData.message ||
        `Request failed with status ${response.status}.`
    );

    error.status = response.status;
    error.details = responseData.errors;
    error.retryAfterSeconds = responseData.retryAfterSeconds;

    throw error;
  }

  return responseData;
};

export const authApi = {
  login: (credentials) =>
    apiRequest("/auth/login", {
      method: "POST",
      body: credentials,
    }),

  register: (details) =>
    apiRequest("/auth/register", {
      method: "POST",
      body: details,
    }),

  me: (token) =>
    apiRequest("/auth/me", { token }),

  google: (idToken) =>
    apiRequest("/auth/google", {
      method: "POST",
      body: { idToken },
    }),

  linkGoogle: (token, password, idToken) =>
    apiRequest("/auth/link-google", {
      method: "POST",
      token,
      body: {
        password,
        idToken,
      },
    }),

  requestPhoneLoginOtp: (phoneNumber) =>
    apiRequest("/auth/phone/request", {
      method: "POST",
      body: { phoneNumber },
    }),

  verifyPhoneLoginOtp: (phoneNumber, code) =>
    apiRequest("/auth/phone/verify", {
      method: "POST",
      body: {
        phoneNumber,
        code,
      },
    }),

  requestPhoneLinkOtp: (token, phoneNumber, password) =>
    apiRequest("/auth/phone/link/request", {
      method: "POST",
      token,
      body: {
        phoneNumber,
        password,
      },
    }),

  verifyPhoneLinkOtp: (token, phoneNumber, code) =>
    apiRequest("/auth/phone/link/verify", {
      method: "POST",
      token,
      body: {
        phoneNumber,
        code,
      },
    }),
};

export const resumeApi = {
  upload: (formData, token) =>
    apiRequest("/resumes/upload", {
      method: "POST",
      token,
      body: formData,
    }),
};

export const analysisApi = {
  compare: (data, token) =>
    apiRequest("/analysis/compare", {
      method: "POST",
      token,
      body: data,
    }),

  history: (token, page = 1, limit = 10) =>
    apiRequest(`/analysis/history?page=${page}&limit=${limit}`, {
      token,
    }),

  getById: (analysisId, token) =>
    apiRequest(`/analysis/${encodeURIComponent(analysisId)}`, {
      token,
    }),

  recommendations: (analysisId, token) =>
    apiRequest(
      `/analysis/${encodeURIComponent(analysisId)}/recommendations`,
      {
        method: "POST",
        token,
      }
    ),
};