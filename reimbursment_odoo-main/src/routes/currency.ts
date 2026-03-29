import { Router, Request, Response } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import {
  fetchCountriesWithCurrencies,
  convertCurrency,
} from "../utils/currency";

const router = Router();

router.use(authenticate);

// ─── GET /currency/countries ──────────────────────────────────────────────────
// Returns list of countries with their currency codes and names

router.get(
  "/countries",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const countries = await fetchCountriesWithCurrencies();

      // Flatten into a clean list of { country, currencyCode, currencyName }
      const result: {
        country: string;
        currencyCode: string;
        currencyName: string;
        symbol: string;
      }[] = [];

      for (const c of countries) {
        for (const [code, info] of Object.entries(c.currencies)) {
          result.push({
            country: c.name,
            currencyCode: code,
            currencyName: info.name,
            symbol: info.symbol,
          });
        }
      }

      result.sort((a, b) => a.country.localeCompare(b.country));

      res.json({ countries: result });
    } catch (err) {
      console.error("Countries fetch error:", err);
      res
        .status(502)
        .json({ error: "Failed to fetch countries from external API" });
    }
  }
);

// ─── GET /currency/convert ────────────────────────────────────────────────────
// Converts an amount between two currencies
// Query params: amount, from, to

const ConvertQuerySchema = z.object({
  amount: z.coerce.number().positive("Amount must be positive"),
  from: z.string().length(3, "Currency code must be 3 characters").toUpperCase(),
  to: z.string().length(3, "Currency code must be 3 characters").toUpperCase(),
});

router.get("/convert", async (req: Request, res: Response): Promise<void> => {
  const parsed = ConvertQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { amount, from, to } = parsed.data;

  if (from === to) {
    res.json({ from, to, amount, convertedAmount: amount, rate: 1 });
    return;
  }

  try {
    const { convertedAmount, rate } = await convertCurrency(amount, from, to);

    res.json({
      from,
      to,
      originalAmount: amount,
      convertedAmount,
      rate,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Currency conversion failed";
    console.error("Currency conversion error:", err);
    res.status(502).json({ error: message });
  }
});

// ─── GET /currency/rates/:base ────────────────────────────────────────────────
// Returns all exchange rates for a base currency

import axios from "axios";

router.get(
  "/rates/:base",
  async (req: Request, res: Response): Promise<void> => {
    const base = String(req.params.base).toUpperCase();

    if (base.length !== 3) {
      res.status(400).json({ error: "Base currency must be a 3-letter code" });
      return;
    }

    try {
      const { data } = await axios.get(
        `https://api.exchangerate-api.com/v4/latest/${base}`
      );

      res.json({
        base: data.base,
        date: data.date,
        rates: data.rates,
      });
    } catch (err) {
      console.error("Rates fetch error:", err);
      res.status(502).json({ error: "Failed to fetch exchange rates" });
    }
  }
);

export default router;
