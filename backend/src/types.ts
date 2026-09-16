import { Request } from "express";

export interface AuthenticatedUser {
  userId: string;
  email: string;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export type DataProvenance =
  | "USER_PROVIDED"
  | "CALCULATED"
  | "WEARABLE"
  | "OBSERVED"
  | "ESTIMATED";

export interface Provenanced<T> {
  value: T;
  provenance: DataProvenance;
  confidence?: number;
}
