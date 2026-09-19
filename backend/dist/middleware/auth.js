"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEV_USER_EMAIL = exports.DEV_USER_ID = void 0;
exports.authMiddleware = authMiddleware;
exports.signToken = signToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || "fitness-app-default-dev-secret";
exports.DEV_USER_ID = "00000000-0000-0000-0000-000000000001";
exports.DEV_USER_EMAIL = "dev@fitness.local";
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        try {
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            req.user = decoded;
            return next();
        }
        catch {
            if (process.env.NODE_ENV !== "production") {
                req.user = {
                    userId: exports.DEV_USER_ID,
                    email: exports.DEV_USER_EMAIL,
                };
                return next();
            }
            return res.status(401).json({ message: "Invalid or expired session token." });
        }
    }
    // During local development, allow requests without token to map to the local dev user
    if (process.env.NODE_ENV !== "production") {
        req.user = {
            userId: exports.DEV_USER_ID,
            email: exports.DEV_USER_EMAIL,
        };
        return next();
    }
    return res.status(401).json({ message: "Authentication required." });
}
function signToken(user) {
    return jsonwebtoken_1.default.sign(user, JWT_SECRET, { expiresIn: "30d" });
}
