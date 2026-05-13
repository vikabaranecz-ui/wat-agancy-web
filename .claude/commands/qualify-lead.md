# /qualify-lead

Score and qualify a lead against WAT? Agency's ICP criteria to decide whether to pursue outreach.

## Usage

```
/qualify-lead <company name or paste lead data>
```

## Qualification Framework

### BANT-lite Scoring

Score each dimension 1–3:

| Dimension | 1 — Poor fit | 2 — Possible | 3 — Strong fit |
|-----------|-------------|-------------|----------------|
| **Budget** | Sole trader, no staff, discounted pricing visible | Small team (2–5), mid-range pricing | 5–25 employees, premium pricing, recent investments |
| **Authority** | Can't identify decision-maker | Decision-maker identified but unclear | Owner/founder directly reachable |
| **Need** | Already has good marketing presence | Some gaps but partial coverage | Clear, significant marketing gap |
| **Timing** | Business stagnant or shrinking | Stable, no obvious growth intent | Growing, hiring, recently active |

**Total BANT score: 4–12**

### Presence Gap Score

Audit their online presence and score the gap (how much WAT? Agency can improve it):

| Channel | 0 — Already good | 1 — Needs work | 2 — Missing/broken |
|---------|-------------------|---------------|-------------------|
| Website | Modern, fast, mobile | Outdated or basic | None |
| Google Business | 4.5+, 20+ reviews, active | Low reviews or rating | Not claimed |
| Facebook | Active, engaged | Inactive | None |
| Instagram | Active, visually strong | Irregular | None |
| Reviews/testimonials | Many, recent, varied | Few or old | None |

**Presence gap score: 0–10**

### Final Lead Score

```
Lead Score = (BANT score / 12 × 5) + (Presence gap score / 10 × 5)
```

Rounded to one decimal, out of 10.

### Qualification Tiers

| Score | Tier | Action |
|-------|------|--------|
| 8–10 | 🔥 Hot | Prioritize — reach out this week |
| 6–7.9 | ✅ Warm | Add to outreach queue |
| 4–5.9 | 🟡 Lukewarm | Monitor — follow up in 30 days |
| < 4 | ❌ Cold | Skip — not a fit now |

## Output Format

```
## Lead Qualification — [Company Name]

### BANT Scores
- Budget: [1/2/3] — [reason]
- Authority: [1/2/3] — [reason]
- Need: [1/2/3] — [reason]
- Timing: [1/2/3] — [reason]
BANT Total: [X/12]

### Presence Gap Scores
- Website: [0/1/2] — [reason]
- Google Business: [0/1/2] — [reason]
- Facebook: [0/1/2] — [reason]
- Instagram: [0/1/2] — [reason]
- Reviews: [0/1/2] — [reason]
Presence Gap Total: [X/10]

### Final Lead Score: [X.X / 10] — [Tier + emoji]

### Recommended Action
[1–2 sentences on what to do next and why]
```
