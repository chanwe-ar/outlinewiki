# ELEPHANT — what every session in outlinewiki must remember

One dated line per decision, trap or new way of working. `[!!]` = everyone must know it.

[!!] 2026-11-15 19:03 : This repo is public: no chanwe-brand format files (Typst, Lua, report assets) ever come here. The Wiki's PDF export lives in chanwe-publish/render; this repo only carries the menu script docker/chanwe/static/chanwe-export.js — @alejandro.abraham
[!!] 2026-11-15 19:03 : Never patch Outline's plan/licence checks (PlanHelper, teamHasEntitlement, Team.plan, "community edition" guards): bypassing them ends the licence. Build features beside Outline instead — @alejandro.abraham
2026-11-15 19:03 : chanwe-export.js reads Outline 1.12 menu items by their MenuLabel (the item text carries a ".md"/".html" hint) and ignores menus opened from #sidebar; its DOM test needs jsdom on NODE_PATH — @alejandro.abraham
2026-11-15 19:03 : Deploying the Wiki is `ssh apps chanwe-update --infra outline --rebuild`; plain `--infra outline` only refreshes base images and leaves /srv/src/outline where it was — @alejandro.abraham
2026-11-15 19:03 : gh in this fork defaults to upstream outline/outline: pass --repo chanwe-ar/outlinewiki (or keep `gh repo set-default`) for every PR — @alejandro.abraham
2026-11-23 10:25 : [!!] No auto deployment (S24): merging deploys nothing; deploy by hand once per round with ssh apps chanwe-update --deploy (the Wiki still needs chanwe-update --infra outline --rebuild) — @alejandro.abraham
