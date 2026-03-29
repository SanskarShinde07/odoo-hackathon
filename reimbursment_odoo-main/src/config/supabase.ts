import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
	 "❌ FATAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
  );
  process.exit(1);
}

// Service role client — bypasses RLS, only used server-side
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
	 autoRefreshToken: false,
	 persistSession: false,
  },
});
