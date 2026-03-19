import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_NAME: z.string().trim().min(1).default("defi-analytica"),
  DUNE_API_KEY: z.string().trim().min(1).optional(),
  DATABASE_URL: z.string().trim().min(1).optional(),
  REDIS_URL: z.string().trim().min(1).optional(),
  ENABLE_EXCHANGE_SIGNALS: z.enum(["true", "false"]).default("false"),
  EXCHANGE_ALLOWED_SYMBOLS: z.string().trim().default("BTCUSDT,ETHUSDT,SOLUSDT"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment configuration: ${issues}`);
}

const exchangeAllowedSymbols = parsed.data.EXCHANGE_ALLOWED_SYMBOLS.split(",")
  .map((symbol) => symbol.trim().toUpperCase())
  .filter((symbol) => /^[A-Z0-9]{5,20}$/.test(symbol));

if (parsed.data.ENABLE_EXCHANGE_SIGNALS === "true" && exchangeAllowedSymbols.length === 0) {
  throw new Error(
    "Invalid environment configuration: ENABLE_EXCHANGE_SIGNALS is true but EXCHANGE_ALLOWED_SYMBOLS is empty or contains no valid symbols."
  );
}

export const env = {
  ...parsed.data,
  ENABLE_EXCHANGE_SIGNALS: parsed.data.ENABLE_EXCHANGE_SIGNALS === "true",
  EXCHANGE_ALLOWED_SYMBOLS: exchangeAllowedSymbols,
};
