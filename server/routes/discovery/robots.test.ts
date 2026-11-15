import { robotsResponse } from "./robots";

const groups = () =>
  robotsResponse()
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => /^User-agent:/m.test(block));

describe("robotsResponse", () => {
  it("signals search and AI input but not AI training to all agents", () => {
    const [all] = groups();
    expect(all).toContain("User-agent: *");
    expect(all).toContain(
      "Content-Signal: search=yes, ai-input=yes, ai-train=no"
    );
  });

  it("keeps the existing rules for all agents", () => {
    const [all] = groups();
    expect(all).toContain("Allow: /api/shares.sitemap");
    expect(all).toContain("Allow: /api/attachments.redirect");
    expect(all).toContain("Disallow: /api/");
    expect(all).toContain("Disallow: /desktop-redirect");
  });

  it("blocks AI training and SEO crawlers from the whole site", () => {
    const blocked = groups()[1];
    for (const bot of ["GPTBot", "ClaudeBot", "CCBot", "AhrefsBot"]) {
      expect(blocked).toContain(`User-agent: ${bot}`);
    }
    expect(blocked).toMatch(/Disallow: \/$/m);
  });

  it("points to the terms", () => {
    expect(robotsResponse()).toContain("https://chanwe.ar/es/terminos");
  });
});
