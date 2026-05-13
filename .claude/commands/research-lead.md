# /research-lead

Deep-dive research on a specific company to evaluate them as a potential WAT? Agency client.

## Usage

```
/research-lead <company name or URL>
```

## What This Command Does

Given a company name or website URL, research the following and compile a complete lead profile:

### 1. Online Presence Audit
- **Website:** Does one exist? Is it modern, mobile-friendly, has a contact form?
- **Google Business Profile:** Claimed? Rating and number of reviews? Photos? Posts?
- **Facebook:** Active page? Last post date? Follower count? Reviews?
- **Instagram:** Active? Post frequency? Engagement?

### 2. Company Background
- Full legal company name and KBO number if findable
- Location and service area
- Years in business
- Services offered
- Team size estimate

### 3. Pain Point Identification
Look for these signals:
- Website missing or outdated (no SSL, not mobile, built before 2020)
- Google rating below 4.2 or fewer than 10 reviews
- Social media inactive (last post > 3 months ago) or absent
- No online booking / contact form
- Poor quality photos on Google or Facebook

### 4. Opportunity Assessment
Rate the opportunity on these dimensions (1–5 each):
- **Visibility gap** — how much room to improve their online presence
- **Reachability** — how easy to contact them
- **Budget fit** — signals they can afford a marketing system (premium pricing, active business)
- **Growth intent** — signals they want to grow (hiring, new equipment, positive energy)

### 5. Lead Score (1–10)
Sum the four dimension scores, divide by 2.

### 6. Recommended First Message
Draft a short, personalized outreach message in Dutch (max 3 sentences) referencing something specific you found during research.

## Output Format

Return the completed lead data structure from CLAUDE.md plus the opportunity assessment scores and the drafted outreach message.
