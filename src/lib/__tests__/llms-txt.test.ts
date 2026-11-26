import { describe, expect, it } from "vitest";
import { llmsTxt } from "../llms-txt";

describe("llms.txt", () => {
  const text = llmsTxt("https://getitbook.com");
  it("starts with the name and a summary, as the format asks", () => {
    expect(text.startsWith("# Get It Book\n\n> ")).toBe(true);
  });
  it("takes the prices from the price formula", () => {
    expect(text).toContain("£15.00 a month");
    expect(text).toContain("£2.00 a month for each extra person");
    expect(text).toContain("35% off");
    expect(text).toContain("60 days");
  });
  it("links every business page and says SMS is not offered yet", () => {
    expect(text).toContain("https://getitbook.com/for/massage-spas");
    expect(text).toContain("https://getitbook.com/faq");
    expect(text).toContain("SMS) reminders are not offered yet");
  });
});
