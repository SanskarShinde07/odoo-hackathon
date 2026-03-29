import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { supabase } from "../config/supabase";
import { signToken } from "../utils/jwt";
import { fetchCountriesWithCurrencies } from "../utils/currency";

const router = Router();

// ─── Validation Schemas ───────────────────────────────────────────────────────

const SignupSchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  country: z.string().min(2, "Country is required"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// ─── POST /auth/signup ────────────────────────────────────────────────────────
// Creates a new Company + Admin user in one atomic flow

router.post("/signup", async (req: Request, res: Response): Promise<void> => {
  const parsed = SignupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { companyName, country, name, email, password } = parsed.data;

  try {
    // 1. Resolve currency code from country name using restcountries API
    let currencyCode = "USD"; // fallback
    try {
      const countries = await fetchCountriesWithCurrencies();
      const match = countries.find(
        (c) => c.name.toLowerCase() === country.toLowerCase()
      );
      if (match) {
        const currencies = Object.keys(match.currencies);
        if (currencies.length > 0) currencyCode = currencies[0];
      }
    } catch {
      // Non-fatal: fallback to USD if external API is down
      console.warn("Could not resolve currency from restcountries API, falling back to USD");
    }

    // 2. Check if email already exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingUser) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    // 3. Create company
    const companyId = uuidv4();
    const { error: companyError } = await supabase.from("companies").insert({
      id: companyId,
      name: companyName,
      country,
      currency_code: currencyCode,
    });

    if (companyError) throw companyError;

    // 4. Hash password & create admin user
    const passwordHash = await bcrypt.hash(password, 12);
    const userId = uuidv4();

    const { error: userError } = await supabase.from("users").insert({
      id: userId,
      company_id: companyId,
      name,
      email,
      password_hash: passwordHash,
      role: "admin",
      manager_id: null,
      is_manager_approver: false,
    });

    if (userError) {
      // Rollback company on user creation failure
      await supabase.from("companies").delete().eq("id", companyId);
      throw userError;
    }

    // 5. Issue JWT
    const token = signToken({
      userId,
      companyId,
      role: "admin",
      email,
    });

    res.status(201).json({
      message: "Company and admin account created successfully",
      token,
      user: {
        id: userId,
        name,
        email,
        role: "admin",
        companyId,
      },
      company: {
        id: companyId,
        name: companyName,
        country,
        currencyCode,
      },
    });
  } catch (err: unknown) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Internal server error during signup" });
  }
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────

router.post("/login", async (req: Request, res: Response): Promise<void> => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { email, password } = parsed.data;

  try {
    const { data: user, error } = await supabase
      .from("users")
      .select(
        "id, company_id, name, email, password_hash, role, is_manager_approver"
      )
      .eq("email", email)
      .maybeSingle();

    if (error) throw error;

    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    // Fetch company info
    const { data: company } = await supabase
      .from("companies")
      .select("id, name, country, currency_code")
      .eq("id", user.company_id)
      .single();

    const token = signToken({
      userId: user.id,
      companyId: user.company_id,
      role: user.role,
      email: user.email,
    });

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isManagerApprover: user.is_manager_approver,
        companyId: user.company_id,
      },
      company,
    });
  } catch (err: unknown) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error during login" });
  }
});

// ─── GET /auth/me ─────────────────────────────────────────────────────────────
// Returns the currently authenticated user's profile

import { authenticate } from "../middleware/auth";

router.get(
  "/me",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { data: user, error } = await supabase
        .from("users")
        .select(
          "id, company_id, name, email, role, manager_id, is_manager_approver, created_at"
        )
        .eq("id", req.user!.userId)
        .single();

      if (error || !user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json({ user });
    } catch (err) {
      console.error("Me error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
