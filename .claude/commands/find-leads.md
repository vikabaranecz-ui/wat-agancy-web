# /find-leads

Find new potential clients matching the WAT? Agency ideal client profile in a given area.

## Usage

```
/find-leads <location> [service type]
```

**Examples:**
```
/find-leads Antwerpen isolatie
/find-leads Mechelen renovatie
/find-leads Gent dakwerken
```

## What This Command Does

Search for renovation and insulation companies in the specified location that match the ICP and show buying signals.

### Search Strategy

Use these search patterns:
- Google Maps: `[service] [location]` → filter by rating < 4.5 or < 15 reviews
- Facebook Groups: local trade and home improvement groups in the area
- Werkspot.be: contractors in the region with few or no reviews
- Google: `[service] [location] site:facebook.com`

### Screening Criteria

Include a company if it meets **at least 2** of these:
- [ ] No website or website is outdated
- [ ] Google Business profile has fewer than 15 reviews OR rating below 4.2
- [ ] Social media absent or inactive (no post in 3+ months)
- [ ] Business is < 5 years old
- [ ] No online booking or contact form visible

Exclude if:
- Already has a strong, modern marketing presence
- National chain or franchise
- > 50 employees
- Outside the target geography

### Output Format

Return a list of leads with basic info and why each was flagged:

```
## Lead List — [Location] [Service Type] — [Date]

### 1. [Company Name]
- Website: [URL or none]
- Google: [rating] / 5 — [N] reviews — [Google Maps URL]
- Facebook: [URL or none]
- Why flagged: [1–2 sentences on the gap]
- Suggested action: /research-lead [company name]

### 2. ...
```

Return at minimum 5 leads, up to 15. Prioritize companies with the clearest opportunity gap.
