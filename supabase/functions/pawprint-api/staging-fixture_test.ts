import { stagingValidationFixture } from "./staging-fixture.ts";

Deno.test("staging fixture is disabled without the staging runtime", () => {
  Deno.env.delete("PAWPRINT_RUNTIME");
  Deno.env.set("PAWPRINT_QA_VALIDATION_FIXTURE", "accepted-cat");
  if (stagingValidationFixture() !== null) throw new Error("fixture must be disabled outside staging");
  Deno.env.delete("PAWPRINT_QA_VALIDATION_FIXTURE");
});

Deno.test("accepted-cat fixture returns deterministic QA input", () => {
  Deno.env.set("PAWPRINT_RUNTIME", "staging");
  Deno.env.set("PAWPRINT_QA_VALIDATION_FIXTURE", "accepted-cat");
  Deno.env.set("SUPABASE_URL", "https://qa-staging.supabase.co");
  const result = stagingValidationFixture();
  if (!result || result.catDetected !== true || result.catConfidence !== 0.99 || result.aiGenerated !== false) throw new Error("accepted fixture is not deterministic");
  Deno.env.delete("PAWPRINT_RUNTIME");
  Deno.env.delete("PAWPRINT_QA_VALIDATION_FIXTURE");
  Deno.env.delete("SUPABASE_URL");
});

Deno.test("production project is always denied the fixture", () => {
  Deno.env.set("PAWPRINT_RUNTIME", "staging");
  Deno.env.set("PAWPRINT_QA_VALIDATION_FIXTURE", "accepted-cat");
  Deno.env.set("SUPABASE_URL", "https://xfmackyuxabagrstrpku.supabase.co");
  if (stagingValidationFixture() !== null) throw new Error("production project must never use QA fixture");
  Deno.env.delete("PAWPRINT_RUNTIME");
  Deno.env.delete("PAWPRINT_QA_VALIDATION_FIXTURE");
  Deno.env.delete("SUPABASE_URL");
});
