import { Request, Response, NextFunction } from "express";
import { UserRole } from "../types";

// Usage: requireRole("admin") or requireRole("admin", "manager")
export const requireRole =
  (...roles: UserRole[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthenticated" });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: `Access denied. Required role(s): ${roles.join(", ")}`,
      });
      return;
    }

    next();
  };
