import User from '../models/user.model.js';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// 🔥 Generate JWT
const generateToken = (user) => {
    return jwt.sign(
        { id: user._id },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
};

export const signupService = async ({ name, email, password }) => {
    const existingUser = await User.findOne({ email });

    if (existingUser) {
        throw new Error("USER_ALREADY_EXISTS");
    }

    const user = await User.create({
        name,
        email,
        password,
        authProvider: 'local'
    });

    const token = generateToken(user);

    return { user, token };
};


// =========================
// LOGIN SERVICE
// =========================
export const loginService = async ({ email, password }) => {
    const user = await User.findOne({ email });

    if (!user) {
        throw new Error("INVALID_CREDENTIALS");
    }

    if (user.authProvider === 'google') {
        throw new Error("USE_GOOGLE_LOGIN");
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
        throw new Error("INVALID_CREDENTIALS");
    }

    const token = generateToken(user);

    return { user, token };
};



export const verifyGoogleToken = async (token) => {
    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();

    return {
        email: payload.email,
        name: payload.name,
        googleId: payload.sub
    };
};