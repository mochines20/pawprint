type ValidationFixture = Record<string, unknown>;

const productionProjectRef = "xfmackyuxabagrstrpku";

/**
 * Returns a deterministic validator response only for an explicitly marked
 * staging runtime. Production is denied by project ref as a second guard.
 */
export function stagingValidationFixture(): ValidationFixture | null {
  const runtime = String(Deno.env.get("PAWPRINT_RUNTIME") || "").trim().toLowerCase();
  const fixture = String(Deno.env.get("PAWPRINT_QA_VALIDATION_FIXTURE") || "").trim().toLowerCase();
  const supabaseUrl = String(Deno.env.get("SUPABASE_URL") || "").toLowerCase();
  if (runtime !== "staging" || !fixture || supabaseUrl.includes(productionProjectRef)) return null;

  if (fixture === "accepted-cat") {
    return {
      catDetected: true,
      personDetected: false,
      screenshotDetected: false,
      unsafe: false,
      aiGenerated: false,
      catConfidence: 0.99,
      breedConfidence: 0.8,
      aiGeneratedConfidence: 0,
      suggestedBreed: "Domestic shorthair",
      suggestedCoatType: "Tabby",
      reason: "STAGING_QA_ACCEPTED_CAT",
    };
  }

  if (fixture === "needs-review-cat") {
    return {
      catDetected: true,
      personDetected: false,
      screenshotDetected: false,
      unsafe: false,
      aiGenerated: false,
      catConfidence: 0.8,
      breedConfidence: 0.4,
      aiGeneratedConfidence: 0,
      suggestedBreed: "Domestic shorthair",
      suggestedCoatType: "Unknown",
      reason: "STAGING_QA_NEEDS_REVIEW_CAT",
    };
  }

  return null;
}
