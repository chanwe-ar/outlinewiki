/**
 * Returns the robots.txt content. Crawlers may fetch share pages, the share
 * sitemap, and attachment redirects; per-page indexing is controlled by the
 * robots meta tag. Follows Chanwe's robots policy: search and assistants
 * welcome, AI training and SEO/intel scrapers blocked.
 *
 * @returns the robots.txt content.
 */
export const robotsResponse = (): string => `
# Chanwe robots policy (2026-11-15)
# Open to people and to search, closed to bulk harvesting: AI training, dataset building,
# SEO and competitive-intelligence scraping. See https://chanwe.ar/es/terminos (section 4).

# Content Signals (contentsignals.org): search=index and link; ai-input=answer a person's question
# with a citation; ai-train=train or fine-tune models.
User-agent: *
Content-Signal: search=yes, ai-input=yes, ai-train=no
Allow: /api/shares.sitemap
Allow: /api/attachments.redirect
Disallow: /api/
Disallow: /auth/
Disallow: /oauth/
Disallow: /mcp
Disallow: /sse
Disallow: /realtime
Disallow: /embeds/
Disallow: /settings
Disallow: /search
Disallow: /home
Disallow: /drafts
Disallow: /trash
Disallow: /archive
Disallow: /starred
Disallow: /templates
Disallow: /dashboard
Disallow: /create
Disallow: /logout
Disallow: /desktop-redirect

# AI training and dataset crawlers.
User-agent: GPTBot
User-agent: ClaudeBot
User-agent: anthropic-ai
User-agent: CCBot
User-agent: Google-Extended
User-agent: Applebot-Extended
User-agent: Bytespider
User-agent: meta-externalagent
User-agent: FacebookBot
User-agent: Amazonbot
User-agent: cohere-ai
User-agent: cohere-training-data-crawler
User-agent: Diffbot
User-agent: AI2Bot
User-agent: Ai2Bot-Dolma
User-agent: img2dataset
User-agent: Omgilibot
User-agent: Timpibot
User-agent: ImagesiftBot
User-agent: PetalBot
User-agent: webzio-extended
# SEO and competitive-intelligence scrapers.
User-agent: AhrefsBot
User-agent: SemrushBot
User-agent: MJ12bot
User-agent: DotBot
User-agent: DataForSeoBot
User-agent: BLEXBot
User-agent: serpstatbot
Disallow: /
`;
