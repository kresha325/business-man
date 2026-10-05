import { describe, expect, it } from "vitest";
import { createBusinessSchema, createLocationSchema } from "@edi/validation";

const validBusiness = {
  name: "Demo Pizzeria",
  slug: "demo-pizzeria",
  type: "PIZZERIA",
  country: "Kosovo",
  city: "Prizren",
  currency: "EUR",
  vatRate: 0,
  enabledModules: ["pos", "menu", "kitchen"]
};

describe("business onboarding validation", () => {
  it("accepts a valid tenant and applies default currency and VAT", () => {
    const result = createBusinessSchema.safeParse({
      ...validBusiness,
      currency: undefined,
      vatRate: undefined
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe("EUR");
      expect(result.data.vatRate).toBe(0);
    }
  });

  it("rejects caller-supplied business identifiers", () => {
    expect(createBusinessSchema.safeParse({
      ...validBusiness,
      businessId: "EDI-ELECTRO"
    }).success).toBe(false);
  });

  it("rejects unknown module flags and malformed slugs", () => {
    expect(createBusinessSchema.safeParse({
      ...validBusiness,
      enabledModules: ["super-admin"]
    }).success).toBe(false);
    expect(createBusinessSchema.safeParse({
      ...validBusiness,
      enabledModules: ["pos", "pos"]
    }).success).toBe(false);
    expect(createBusinessSchema.safeParse({
      ...validBusiness,
      slug: "../other-business"
    }).success).toBe(false);
  });

  it("validates a location payload without accepting another tenant identifier", () => {
    expect(createLocationSchema.safeParse({
      name: "Second shop",
      slug: "second-shop",
      country: "Kosovo",
      city: "Prishtina",
      businessId: "another-business"
    }).success).toBe(false);
  });
});
