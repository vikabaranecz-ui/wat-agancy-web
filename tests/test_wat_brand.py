"""Regression tests for WAT branded-keyword filtering. Run: python -m unittest discover -s tests"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from wat_brand import is_brand_query  # noqa: E402


class BrandQueryTests(unittest.TestCase):
    def test_brand_variants_are_detected(self):
        for query in ["wat agency", "wat? agency", "watagency", "WAT Agency Antwerpen",
                      "wat-agency", "watagencybelgium.be", "viktoriia marketing", "viktoriiamarketing"]:
            with self.subTest(query=query):
                self.assertTrue(is_brand_query(query))

    def test_non_brand_queries_are_kept(self):
        for query in ["marketingbureau antwerpen", "what agency does seo", "swat agency",
                      "google ads bureau", "", None]:
            with self.subTest(query=query):
                self.assertFalse(is_brand_query(query))


if __name__ == "__main__":
    unittest.main()
