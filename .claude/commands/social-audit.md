# /social-audit

Audit a lead's social media presence across all channels and produce an actionable gap report. Used during lead research to identify exactly where WAT? Agency can add value.

## Usage

```
/social-audit <company name, website, or Facebook/Instagram URL>
```

## What Gets Audited

### Facebook
- Page claimed? Link to it.
- Follower count
- Last post date — is it active (< 2 weeks), stale (< 3 months), or dead (> 3 months)?
- Post frequency over last 90 days
- Types of content: photos, videos, text, shares
- Engagement signals: likes, comments, shares on recent posts
- Reviews/ratings on the page

### Instagram
- Account exists?
- Follower count and following ratio
- Post frequency
- Content quality: professional photos vs. phone snapshots
- Bio completeness: contact info, service description, link

### Google Business
- Profile claimed?
- Rating and total review count
- Review recency: when was the last review?
- Response rate: does the owner reply to reviews?
- Photos: count and quality
- Posts: any recent activity?

### Website
- Exists? URL working?
- Mobile-friendly?
- Has a contact form or phone number prominently displayed?
- SSL certificate (https)?
- Last visual update (estimate from design era)

## Content Mix Assessment (from social-media-manager skill)

Benchmark the lead's actual content mix against the recommended ratio:

| Type | Benchmark | Observed |
|------|-----------|----------|
| Educational | 40% | [X%] |
| Behind-the-scenes | 20% | [X%] |
| Social proof / reviews | 15% | [X%] |
| Engagement / community | 15% | [X%] |
| Promotional | 10% | [X%] |

## Warning Signs to Flag

- Posting fewer than 2x/month
- 100% promotional content with no engagement
- No outbound engagement (commenting, responding)
- Copy-pasted or stock imagery
- No Belgian/local context in content
- Profiles started but abandoned

## Output Format

```
## Social Audit — [Company Name]

### Channel Scores (0 = missing, 1 = needs work, 2 = solid)
- Facebook: [score] — [key finding]
- Instagram: [score] — [key finding]
- Google Business: [score] — [key finding]
- Website: [score] — [key finding]

Total Presence Score: [X / 8]

### Biggest Gap
[1–2 sentences on the single highest-impact improvement WAT? Agency could make]

### Content Mix
[Brief observation on what they post and what's missing]

### Quick Wins Available
1. [Specific, actionable improvement #1]
2. [Specific, actionable improvement #2]
3. [Specific, actionable improvement #3]

### Red Flags
[Any disqualifiers or concerns found]
```
