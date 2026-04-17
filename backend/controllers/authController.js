import {
    signupService,
    loginService,
    verifyGoogleToken
} from '../services/authService.js';

import {
    sendSuccess,
    sendCreated,
    sendBadRequest,
    sendError,
    sendConflict
} from '../utils/response.js';


// =========================
// SIGNUP CONTROLLER
// =========================
export const signup = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // 🔥 Basic validation
        if (!name || !email || !password) {
            return sendBadRequest(res, "All fields are required");
        }

        const data = await signupService({ name, email, password });

        return sendCreated(res, data, "Signup successful");

    } catch (error) {
        if (error.message === "USER_ALREADY_EXISTS") {
            return sendConflict(res, "User already exists");
        }

        return sendError(res, error.message);
    }
};


// =========================
// LOGIN CONTROLLER
// =========================
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return sendBadRequest(res, "Email and password are required");
        }

        const data = await loginService({ email, password });

        return sendSuccess(res, data, "Login successful");

    } catch (error) {
        if (error.message === "INVALID_CREDENTIALS") {
            return sendBadRequest(res, "Invalid credentials");
        }

        if (error.message === "USE_GOOGLE_LOGIN") {
            return sendBadRequest(res, "Please login with Google");
        }

        return sendError(res, error.message);
    }
};


export const googleLogin = async (req, res) => {
    try {
        const { token } = req.body;

        const googleUser = await verifyGoogleToken(token);

        const data = await googleLoginService(googleUser);

        return sendSuccess(res, data, "Google login successful");

    } catch (error) {
        return sendError(res, error.message);
    }
};