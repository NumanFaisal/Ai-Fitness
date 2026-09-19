import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthRequest, AuthenticatedUser } from "../types";

const JWT_SECRET = process.env.JWT_SECRET || "fitness-app-default-dev-secret";

export const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";
export const DEV_USER_EMAIL = "dev@fitness.local";

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
      req.user = decoded;
      return next();
    } catch {
      if (process.env.NODE_ENV !== "production") {
        req.user = {
          userId: DEV_USER_ID,
          email: DEV_USER_EMAIL,
        };
        return next();
      }
      return res.status(401).json({ message: "Invalid or expired session token." });
    }
  }

  // During local development, allow requests without token to map to the local dev user
  if (process.env.NODE_ENV !== "production") {
    req.user = {
      userId: DEV_USER_ID,
      email: DEV_USER_EMAIL,
    };
    return next();
  }

  return res.status(401).json({ message: "Authentication required." });
}

export function signToken(user: AuthenticatedUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "30d" });
}
