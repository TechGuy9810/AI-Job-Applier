import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },

    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },

    password: {
        type: String
    },

    googleId: {
        type: String
    },

    authProvider: {
        type: String,
        enum: ['local', 'google'],
        default: 'local'
    }

}, { timestamps: true });


// 🔥 Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.password || !this.isModified('password')) return next();

    this.password = await bcrypt.hash(this.password, 10);
    next();
});


// 🔥 Compare password
userSchema.methods.comparePassword = async function (password) {
    if (!this.password) return false;
    return await bcrypt.compare(password, this.password);
};


// 🔥 Remove sensitive fields
userSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    return obj;
};

export default mongoose.model('User', userSchema);