"""Offline tests for WAT weekly Keyword Planner and indexing evidence contracts."""
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import wat_ads_collect as ads
import wat_seo_weekly_collect as weekly


class KeywordResearchTests(unittest.TestCase):
    def test_numeric_volume_and_monthly_history_missing_are_distinct(self):
        item = {"text":"marketingbureau Antwerpen",
                "keywordIdeaMetrics":{"avgMonthlySearches":"1300","competition":"HIGH"}}
        row = ads.parse_idea(item, "service_ready", ["marketingbureau"])
        self.assertEqual(row["avg_monthly_searches"],1300)
        self.assertEqual(row["trend"]["status"],"INSUFFICIENT_HISTORY")
        self.assertIsNone(row["trend"]["three_month_growth_pct"])
        self.assertIsNone(row["validated_organic_difficulty"])

    @patch("wat_ads_collect.requests.post")
    @patch("wat_ads_collect.google.auth.default")
    def test_each_wat_cluster_is_queried_without_gsc_rankings(self, default, post):
        creds = MagicMock()
        creds.token = "synthetic-unit-test-token"
        default.return_value = (creds,None)
        response = MagicMock()
        response.status_code = 200
        response.json.return_value = {
            "results":[{"text":"marketing bureau Antwerpen",
                        "keywordIdeaMetrics":{"avgMonthlySearches":"1300"}}]
        }
        post.return_value=response
        with patch.dict(os.environ,{"WAT_GOOGLE_ADS_CUSTOMER_ID":"1234567890"},clear=False):
            outcome=ads.collect_keyword_planner([])
        expected=len(__import__("json").loads(
            Path("seo/keyword_targets.json").read_text(encoding="utf-8"))["clusters"])
        self.assertEqual(post.call_count,expected)
        self.assertEqual(outcome["attempted_clusters"],expected)
        self.assertEqual(outcome["status"],"OK")
        self.assertGreater(outcome["datasets"]["belgium"]["count"],0)
        self.assertEqual(outcome["observed_gsc_seed_count"],0)

    def test_job_seeker_queries_are_excluded_from_content_opportunities(self):
        self.assertFalse(ads.relevant_keyword("marketing vacatures Antwerpen", ["marketing"]))
        self.assertTrue(ads.relevant_keyword("website voor bouwbedrijf", ["website"]))


class IndexingInventoryTests(unittest.TestCase):
    @patch("wat_seo_weekly_collect.collect_keyword_planner")
    def test_postdeploy_skips_ads_but_weekly_still_calls_planner(self,planner):
        planner.return_value={"status":"OK","successful_clusters":7}
        with patch.dict(os.environ,{"WAT_SKIP_KEYWORD_PLANNER":"1"}):
            skipped=weekly.collect_ads_for_mode([])
        self.assertEqual(skipped["status"],"SKIPPED")
        self.assertEqual(skipped["attempted_clusters"],0)
        planner.assert_not_called()
        with patch.dict(os.environ,{"WAT_SKIP_KEYWORD_PLANNER":"0"}):
            included=weekly.collect_ads_for_mode([])
        self.assertEqual(included["status"],"OK")
        planner.assert_called_once_with([])

    @patch("wat_seo_weekly_collect.session.get")
    def test_sitemap_and_historical_gsc_pages_discovered(self,get):
        response=MagicMock()
        response.content=b"""<?xml version="1.0"?>
            <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url><loc>https://www.watagencybelgium.be/en/</loc></url>
            </urlset>"""
        get.return_value=response
        gsc={"status":"OK","last90_pages":{"rows":[
            {"keys":["https://www.watagencybelgium.be/old-service/"],"impressions":1},
            {"keys":["https://watagencybelgium.be/"],"impressions":10}
        ]}}
        result=weekly.discover_url_inventory(gsc)
        urls=[x["url"] for x in result["urls"]]
        self.assertIn("https://www.watagencybelgium.be/old-service/",urls)
        self.assertIn("https://www.watagencybelgium.be/en/",urls)
        root=next(x for x in result["urls"] if x["url"]=="https://www.watagencybelgium.be/")
        self.assertTrue(root["expected_index"])
        self.assertIn("root_canonical_check",root["sources"])
        self.assertIn("/", weekly.PAGES)
        self.assertIn("/en/", weekly.PAGES)
        self.assertGreaterEqual(result["discovered_count"],8)
        self.assertIn("https://watagencybelgium.be/",urls)
        self.assertIn("https://watagencybelgium.be/en/",urls)
        apex=next(x for x in result["urls"] if x["url"]=="https://watagencybelgium.be/")
        self.assertFalse(apex["expected_index"])
        self.assertIn("apex_host_canonical_investigation",apex["sources"])

    @patch("wat_seo_weekly_collect.session.get")
    def test_apex_http_first_hop_not_erased_by_followed_redirect(self,get):
        response=MagicMock()
        response.status_code=200
        response.url="https://www.watagencybelgium.be/en/"
        response.history=[MagicMock(status_code=308,url="https://watagencybelgium.be/")]
        response.history[0].headers={"Location":"https://www.watagencybelgium.be/"}
        response.headers={"Content-Type":"text/html"}
        response.text="<html><head><title>WAT</title></head><body><h1>WAT</h1></body></html>"
        get.return_value=response
        data=weekly.fetch_page("https://watagencybelgium.be/")
        self.assertEqual(data["url"],"https://watagencybelgium.be/")
        self.assertEqual(data["first_hop_status"],308)
        self.assertEqual(data["first_hop_location"],"https://www.watagencybelgium.be/")
        self.assertTrue(data["cross_host_redirect"])
        get.assert_called_once()
        self.assertEqual(get.call_args.args[0],"https://watagencybelgium.be/")



if __name__=="__main__":
    unittest.main()
