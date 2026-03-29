import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { supabase } from "../config/supabase";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/roleGuard";

const router = Router();

router.use(authenticate);

// ─── Validation Schemas ───────────────────────────────────────────────────────

const CreateRuleSchema = z.object({
  name: z.string().min(2, "Rule name is required"),
  ruleType: z.enum(["sequential", "percentage", "specific_approver", "hybrid"]),
  percentageThreshold: z.number().int().min(1).max(100).optional().nullable(),
});

const UpdateRuleSchema = z.object({
  name: z.string().min(2).optional(),
  ruleType: z
    .enum(["sequential", "percentage", "specific_approver", "hybrid"])
    .optional(),
  percentageThreshold: z.number().int().min(1).max(100).optional().nullable(),
});

const AddApproverSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  sequence: z.number().int().min(1, "Sequence must be >= 1"),
  isKeyApprover: z.boolean().optional().default(false),
});

const UpdateApproverSchema = z.object({
  sequence: z.number().int().min(1).optional(),
  isKeyApprover: z.boolean().optional(),
});

// ─── GET /rules ───────────────────────────────────────────────────────────────
// All roles can view rules in their company

router.get("/", async (req: Request, res: Response): Promise<void> => {
  const { companyId } = req.user!;

  try {
    const { data, error } = await supabase
      .from("rules")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    res.json({ rules: data });
  } catch (err) {
    console.error("Get rules error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /rules/:id ───────────────────────────────────────────────────────────
// Get a single rule with its approvers

router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const { companyId } = req.user!;

  try {
    const { data: rule, error: ruleError } = await supabase
      .from("rules")
      .select("*")
      .eq("id", req.params.id)
      .eq("company_id", companyId)
      .single();

    if (ruleError || !rule) {
      res.status(404).json({ error: "Rule not found" });
      return;
    }

    // Fetch rule approvers with user details
    const { data: approvers, error: approversError } = await supabase
      .from("rule_approvers")
      .select(
        `
        id,
        sequence,
        is_key_approver,
        users (id, name, email, role)
      `
      )
      .eq("rule_id", req.params.id)
      .order("sequence", { ascending: true });

    if (approversError) throw approversError;

    res.json({ rule: { ...rule, approvers: approvers ?? [] } });
  } catch (err) {
    console.error("Get rule error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /rules ──────────────────────────────────────────────────────────────
// Admin only — create a new approval rule

router.post(
  "/",
  requireRole("admin"),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = CreateRuleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }

    const { name, ruleType, percentageThreshold } = parsed.data;
    const { companyId } = req.user!;

    // Validate: percentage/hybrid rules need a threshold
    if (
      (ruleType === "percentage" || ruleType === "hybrid") &&
      !percentageThreshold
    ) {
      res.status(400).json({
        error:
          "percentageThreshold is required for percentage and hybrid rule types",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("rules")
        .insert({
          id: uuidv4(),
          company_id: companyId,
          name,
          rule_type: ruleType,
          percentage_threshold: percentageThreshold ?? null,
        })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json({ message: "Rule created successfully", rule: data });
    } catch (err) {
      console.error("Create rule error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─── PUT /rules/:id ───────────────────────────────────────────────────────────
// Admin only — update an existing rule

router.put(
  "/:id",
  requireRole("admin"),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = UpdateRuleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }

    const { companyId } = req.user!;

    try {
      const updatePayload: Record<string, unknown> = {};
      if (parsed.data.name !== undefined) updatePayload.name = parsed.data.name;
      if (parsed.data.ruleType !== undefined)
        updatePayload.rule_type = parsed.data.ruleType;
      if (parsed.data.percentageThreshold !== undefined)
        updatePayload.percentage_threshold = parsed.data.percentageThreshold;

      const { data, error } = await supabase
        .from("rules")
        .update(updatePayload)
        .eq("id", req.params.id)
        .eq("company_id", companyId)
        .select()
        .single();

      if (error) throw error;

      res.json({ message: "Rule updated successfully", rule: data });
    } catch (err) {
      console.error("Update rule error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─── DELETE /rules/:id ────────────────────────────────────────────────────────
// Admin only

router.delete(
  "/:id",
  requireRole("admin"),
  async (req: Request, res: Response): Promise<void> => {
    const { companyId } = req.user!;

    try {
      const { error } = await supabase
        .from("rules")
        .delete()
        .eq("id", req.params.id)
        .eq("company_id", companyId);

      if (error) throw error;

      res.json({ message: "Rule deleted successfully" });
    } catch (err) {
      console.error("Delete rule error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// RULE APPROVERS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /rules/:id/approvers ─────────────────────────────────────────────────

router.get(
  "/:id/approvers",
  async (req: Request, res: Response): Promise<void> => {
    const { companyId } = req.user!;

    try {
      // Verify rule belongs to company first
      const { data: rule } = await supabase
        .from("rules")
        .select("id")
        .eq("id", req.params.id)
        .eq("company_id", companyId)
        .maybeSingle();

      if (!rule) {
        res.status(404).json({ error: "Rule not found" });
        return;
      }

      const { data, error } = await supabase
        .from("rule_approvers")
        .select(
          `
          id,
          sequence,
          is_key_approver,
          users (id, name, email, role)
        `
        )
        .eq("rule_id", req.params.id)
        .order("sequence", { ascending: true });

      if (error) throw error;

      res.json({ approvers: data ?? [] });
    } catch (err) {
      console.error("Get rule approvers error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─── POST /rules/:id/approvers ────────────────────────────────────────────────
// Admin only — add a user as an approver to a rule

router.post(
  "/:id/approvers",
  requireRole("admin"),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = AddApproverSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }

    const { userId, sequence, isKeyApprover } = parsed.data;
    const { companyId } = req.user!;

    try {
      // Verify rule exists in this company
      const { data: rule } = await supabase
        .from("rules")
        .select("id")
        .eq("id", req.params.id)
        .eq("company_id", companyId)
        .maybeSingle();

      if (!rule) {
        res.status(404).json({ error: "Rule not found" });
        return;
      }

      // Verify user exists in this company
      const { data: user } = await supabase
        .from("users")
        .select("id")
        .eq("id", userId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (!user) {
        res.status(400).json({ error: "User not found in this company" });
        return;
      }

      // Check for duplicate user in the same rule
      const { data: existing } = await supabase
        .from("rule_approvers")
        .select("id")
        .eq("rule_id", req.params.id)
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        res
          .status(409)
          .json({ error: "User is already an approver for this rule" });
        return;
      }

      // Check sequence is not duplicated
      const { data: seqConflict } = await supabase
        .from("rule_approvers")
        .select("id")
        .eq("rule_id", req.params.id)
        .eq("sequence", sequence)
        .maybeSingle();

      if (seqConflict) {
        res.status(409).json({
          error: `Sequence ${sequence} is already taken for this rule`,
        });
        return;
      }

      const { data, error } = await supabase
        .from("rule_approvers")
        .insert({
          id: uuidv4(),
          rule_id: req.params.id,
          user_id: userId,
          sequence,
          is_key_approver: isKeyApprover,
        })
        .select(
          `
          id,
          sequence,
          is_key_approver,
          users (id, name, email, role)
        `
        )
        .single();

      if (error) throw error;

      res.status(201).json({ message: "Approver added successfully", approver: data });
    } catch (err) {
      console.error("Add approver error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─── PUT /rules/:id/approvers/:approverId ─────────────────────────────────────
// Admin only — update sequence or isKeyApprover for an approver

router.put(
  "/:id/approvers/:approverId",
  requireRole("admin"),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = UpdateApproverSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }

    const { companyId } = req.user!;

    try {
      // Verify rule ownership
      const { data: rule } = await supabase
        .from("rules")
        .select("id")
        .eq("id", req.params.id)
        .eq("company_id", companyId)
        .maybeSingle();

      if (!rule) {
        res.status(404).json({ error: "Rule not found" });
        return;
      }

      const updatePayload: Record<string, unknown> = {};
      if (parsed.data.sequence !== undefined)
        updatePayload.sequence = parsed.data.sequence;
      if (parsed.data.isKeyApprover !== undefined)
        updatePayload.is_key_approver = parsed.data.isKeyApprover;

      const { data, error } = await supabase
        .from("rule_approvers")
        .update(updatePayload)
        .eq("id", req.params.approverId)
        .eq("rule_id", req.params.id)
        .select()
        .single();

      if (error) throw error;

      res.json({ message: "Approver updated successfully", approver: data });
    } catch (err) {
      console.error("Update approver error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─── DELETE /rules/:id/approvers/:approverId ──────────────────────────────────
// Admin only — remove an approver from a rule

router.delete(
  "/:id/approvers/:approverId",
  requireRole("admin"),
  async (req: Request, res: Response): Promise<void> => {
    const { companyId } = req.user!;

    try {
      // Verify rule ownership
      const { data: rule } = await supabase
        .from("rules")
        .select("id")
        .eq("id", req.params.id)
        .eq("company_id", companyId)
        .maybeSingle();

      if (!rule) {
        res.status(404).json({ error: "Rule not found" });
        return;
      }

      const { error } = await supabase
        .from("rule_approvers")
        .delete()
        .eq("id", req.params.approverId)
        .eq("rule_id", req.params.id);

      if (error) throw error;

      res.json({ message: "Approver removed successfully" });
    } catch (err) {
      console.error("Delete approver error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
