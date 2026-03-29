import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { supabase } from "../config/supabase";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/roleGuard";

const router = Router();

// All user routes require authentication
router.use(authenticate);

// ─── Validation Schemas ───────────────────────────────────────────────────────

const CreateUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["manager", "employee"]),
  managerId: z.string().uuid().optional().nullable(),
  isManagerApprover: z.boolean().optional().default(false),
});

const UpdateUserSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(["manager", "employee"]).optional(),
  managerId: z.string().uuid().optional().nullable(),
  isManagerApprover: z.boolean().optional(),
});

// ─── GET /users ───────────────────────────────────────────────────────────────
// Admin: all users in company | Manager: their team | Employee: just themselves

router.get("/", async (req: Request, res: Response): Promise<void> => {
  const { companyId, role, userId } = req.user!;

  try {
    let query = supabase
      .from("users")
      .select(
        "id, name, email, role, manager_id, is_manager_approver, created_at"
      )
      .eq("company_id", companyId);

    if (role === "employee") {
      query = query.eq("id", userId);
    } else if (role === "manager") {
      // Manager sees themselves + their direct reports
      query = query.or(`id.eq.${userId},manager_id.eq.${userId}`);
    }
    // admin sees everyone

    const { data, error } = await query.order("created_at", {
      ascending: true,
    });
    if (error) throw error;

    res.json({ users: data });
  } catch (err) {
    console.error("Get users error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /users/:id ───────────────────────────────────────────────────────────

router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const { companyId, role, userId } = req.user!;
  const targetId = req.params.id;

  // Employees can only view themselves
  if (role === "employee" && targetId !== userId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  try {
    const { data, error } = await supabase
      .from("users")
      .select(
        "id, name, email, role, manager_id, is_manager_approver, created_at"
      )
      .eq("id", targetId)
      .eq("company_id", companyId)
      .single();

    if (error || !data) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ user: data });
  } catch (err) {
    console.error("Get user error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /users ──────────────────────────────────────────────────────────────
// Admin only — create a new employee or manager

router.post(
  "/",
  requireRole("admin"),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = CreateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }

    const { name, email, password, role, managerId, isManagerApprover } =
      parsed.data;
    const { companyId } = req.user!;

    try {
      // Check email uniqueness
      const { data: existing } = await supabase
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existing) {
        res.status(409).json({ error: "Email already in use" });
        return;
      }

      // If managerId given, validate it belongs to the same company and is manager/admin
      if (managerId) {
        const { data: mgr } = await supabase
          .from("users")
          .select("id, role")
          .eq("id", managerId)
          .eq("company_id", companyId)
          .maybeSingle();

        if (!mgr) {
          res.status(400).json({ error: "Manager not found in this company" });
          return;
        }

        if (!["admin", "manager"].includes(mgr.role)) {
          res
            .status(400)
            .json({ error: "Assigned manager must have role admin or manager" });
          return;
        }
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const newId = uuidv4();

      const { data, error } = await supabase
        .from("users")
        .insert({
          id: newId,
          company_id: companyId,
          name,
          email,
          password_hash: passwordHash,
          role,
          manager_id: managerId ?? null,
          is_manager_approver: isManagerApprover,
        })
        .select("id, name, email, role, manager_id, is_manager_approver, created_at")
        .single();

      if (error) throw error;

      res.status(201).json({ message: "User created successfully", user: data });
    } catch (err) {
      console.error("Create user error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─── PUT /users/:id ───────────────────────────────────────────────────────────
// Admin only — update role, manager assignment, name, isManagerApprover

router.put(
  "/:id",
  requireRole("admin"),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = UpdateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }

    const { companyId, userId: requestingUserId } = req.user!;
    const targetId = req.params.id;

    try {
      // Confirm target user exists in same company
      const { data: target } = await supabase
        .from("users")
        .select("id, role")
        .eq("id", targetId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (!target) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      // Prevent admin from demoting themselves accidentally
      if (targetId === requestingUserId && parsed.data.role && parsed.data.role !== "admin" as string) {
        res.status(400).json({ error: "You cannot change your own role" });
        return;
      }

      const updatePayload: Record<string, unknown> = {};
      if (parsed.data.name !== undefined) updatePayload.name = parsed.data.name;
      if (parsed.data.role !== undefined) updatePayload.role = parsed.data.role;
      if (parsed.data.managerId !== undefined)
        updatePayload.manager_id = parsed.data.managerId;
      if (parsed.data.isManagerApprover !== undefined)
        updatePayload.is_manager_approver = parsed.data.isManagerApprover;

      const { data, error } = await supabase
        .from("users")
        .update(updatePayload)
        .eq("id", targetId)
        .eq("company_id", companyId)
        .select("id, name, email, role, manager_id, is_manager_approver")
        .single();

      if (error) throw error;

      res.json({ message: "User updated successfully", user: data });
    } catch (err) {
      console.error("Update user error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─── DELETE /users/:id ────────────────────────────────────────────────────────
// Admin only — remove a user from the company

router.delete(
  "/:id",
  requireRole("admin"),
  async (req: Request, res: Response): Promise<void> => {
    const { companyId, userId: requestingUserId } = req.user!;
    const targetId = req.params.id;

    if (targetId === requestingUserId) {
      res.status(400).json({ error: "You cannot delete your own account" });
      return;
    }

    try {
      const { error } = await supabase
        .from("users")
        .delete()
        .eq("id", targetId)
        .eq("company_id", companyId);

      if (error) throw error;

      res.json({ message: "User deleted successfully" });
    } catch (err) {
      console.error("Delete user error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
