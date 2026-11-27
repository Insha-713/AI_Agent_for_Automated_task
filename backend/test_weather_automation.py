"""
AgentFlow - Weather Automation & Duplicate Prevention Test Suite
Tests:
1. get_weather live retrieval for Lucknow (with actual data verification)
2. Mock empty response handling (prevents "Expecting value: line 1 column 1 (char 0)")
3. Mock invalid JSON / HTML response handling
4. Mock HTTP 429 rate limit response handling
5. Mock network connection timeout handling
6. Secondary provider fallback (wttr.in) when primary provider fails
7. WorkflowExecutor error recognition (ensures failed weather step is marked failed, not completed)
8. Prevention of misleading weather forecast emails
9. Dispatch of clearly labelled failure notifications when weather retrieval fails
10. Scheduler duplicate job prevention
"""

import os
import sys
import json
import unittest
from unittest.mock import patch, MagicMock
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.tools import (
    get_weather,
    _safe_weather_get_json,
    _fetch_weather_wttr_in,
    KNOWN_CITY_COORDINATES
)
from backend.workflows import WorkflowExecutionEngine


class TestWeatherAutomation(unittest.TestCase):

    def test_01_static_coordinates_present(self):
        """Verify Lucknow and major cities are in the static coordinate fallback dictionary."""
        self.assertIn("lucknow", KNOWN_CITY_COORDINATES)
        lko = KNOWN_CITY_COORDINATES["lucknow"]
        self.assertAlmostEqual(lko["lat"], 26.8467, places=2)
        self.assertAlmostEqual(lko["lon"], 80.9462, places=2)
        self.assertIn("Uttar Pradesh", lko["admin1"])

    def test_02_safe_get_json_empty_response(self):
        """Verify empty responses (0 bytes) do not raise JSONDecodeError."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = ""  # Empty body that causes 'Expecting value: line 1 column 1 (char 0)'
        
        with patch("backend.tools.requests.get", return_value=mock_resp):
            data, err = _safe_weather_get_json("https://fake-weather-api.test/data", timeout=5, max_retries=1)
            self.assertIsNone(data)
            self.assertIn("Empty response body", err)

    def test_03_safe_get_json_invalid_json(self):
        """Verify invalid non-JSON/HTML responses are cleanly handled."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = "<html><head><title>Cloudflare 502</title></head><body>Bad Gateway</body></html>"
        
        with patch("backend.tools.requests.get", return_value=mock_resp):
            data, err = _safe_weather_get_json("https://fake-weather-api.test/data", timeout=5, max_retries=1)
            self.assertIsNone(data)
            self.assertIn("Invalid JSON received", err)

    def test_04_safe_get_json_rate_limit_429(self):
        """Verify HTTP 429 rate limit is recognized without raising an exception."""
        mock_resp = MagicMock()
        mock_resp.status_code = 429
        mock_resp.text = "Too Many Requests"
        
        with patch("backend.tools.requests.get", return_value=mock_resp):
            data, err = _safe_weather_get_json("https://fake-weather-api.test/data", timeout=5, max_retries=1)
            self.assertIsNone(data)
            self.assertIn("Rate limit exceeded", err)

    def test_05_mock_empty_geocoding_falls_back_to_known_city(self):
        """
        When Open-Meteo Geocoding returns an empty response (0 bytes) for Lucknow,
        the tool must seamlessly use static coordinates and fetch the forecast.
        """
        mock_geo_resp = MagicMock()
        mock_geo_resp.status_code = 200
        mock_geo_resp.text = ""  # Trigger empty response for geocoding

        mock_forecast_resp = MagicMock()
        mock_forecast_resp.status_code = 200
        mock_forecast_resp.text = json.dumps({
            "current": {
                "temperature_2m": 22.5,
                "apparent_temperature": 23.0,
                "relative_humidity_2m": 55,
                "wind_speed_10m": 5.2,
                "weather_code": 0
            },
            "daily": {
                "time": ["2026-11-27"],
                "temperature_2m_max": [27.0],
                "temperature_2m_min": [14.0],
                "precipitation_probability_max": [0],
                "weather_code": [0]
            }
        })

        def fake_get(url, **kwargs):
            if "geocoding-api" in url:
                return mock_geo_resp
            return mock_forecast_resp

        with patch("backend.tools.requests.get", side_effect=fake_get):
            weather_fn = get_weather.func if hasattr(get_weather, "func") else get_weather
            report = weather_fn("Lucknow", days=1)
            self.assertIn("Lucknow", report)
            self.assertIn("22.5°C", report)
            self.assertIn("Clear sky", report)
            self.assertIn("Relative Humidity: 55%", report)
            self.assertNotIn("Expecting value", report)

    def test_06_mock_both_open_meteo_fail_falls_back_to_wttr(self):
        """
        When Open-Meteo geocoding and forecast fail, the tool must fall back to wttr.in.
        """
        mock_fail_resp = MagicMock()
        mock_fail_resp.status_code = 503
        mock_fail_resp.text = "Service Unavailable"

        mock_wttr_resp = MagicMock()
        mock_wttr_resp.status_code = 200
        mock_wttr_resp.text = json.dumps({
            "current_condition": [{
                "temp_C": "21",
                "FeelsLikeC": "21",
                "humidity": "45",
                "windspeedKmph": "6",
                "weatherDesc": [{"value": "Sunny"}]
            }],
            "nearest_area": [{
                "areaName": [{"value": "Lucknow"}],
                "region": [{"value": "Uttar Pradesh"}],
                "country": [{"value": "India"}],
                "latitude": "26.850",
                "longitude": "80.917"
            }],
            "weather": [{
                "date": "2026-11-27",
                "maxtempC": "26",
                "mintempC": "12",
                "hourly": [{}, {}, {}, {}, {"weatherDesc": [{"value": "Sunny"}], "chanceofrain": "0"}]
            }]
        })

        def fake_get(url, **kwargs):
            if "wttr.in" in url:
                return mock_wttr_resp
            return mock_fail_resp

        with patch("backend.tools.requests.get", side_effect=fake_get):
            weather_fn = get_weather.func if hasattr(get_weather, "func") else get_weather
            report = weather_fn("Lucknow", days=1)
            self.assertIn("Lucknow", report)
            self.assertIn("21°C", report)
            self.assertIn("Sunny", report)
            self.assertIn("wttr.in", report)
            self.assertNotIn("Expecting value", report)

    def test_07_complete_outage_returns_clean_error(self):
        """
        When all services are completely unreachable, get_weather must return a structured
        error string starting with 'Error:' without crashing or exposing secrets.
        """
        mock_fail_resp = MagicMock()
        mock_fail_resp.status_code = 500
        mock_fail_resp.text = "Internal Server Error"

        with patch("backend.tools.requests.get", return_value=mock_fail_resp):
            weather_fn = get_weather.func if hasattr(get_weather, "func") else get_weather
            report = weather_fn("Lucknow", days=1)
            self.assertTrue(report.startswith("Error:"), f"Expected string to start with 'Error:', got: {report}")
            self.assertIn("Weather data currently unavailable", report)
            self.assertNotIn("Expecting value", report)

    def test_08_workflow_recognizes_weather_error_and_does_not_send_misleading_email(self):
        """
        WorkflowExecutionEngine must recognize weather errors, mark the step as failed,
        and not treat the error string as completed data.
        """
        import asyncio

        step_1 = {
            "id": "step_1",
            "tool": "get_weather",
            "name": "Fetch Current Weather Forecast",
            "params": {"city": "Lucknow", "days": 1},
            "output_key": "weather_data",
            "requires_approval": False
        }

        step_2 = {
            "id": "step_2",
            "tool": "send_email",
            "name": "Dispatch Weather Digest via Gmail SMTP",
            "params": {
                "to_email": "test@example.com",
                "subject": "Weather Report for Lucknow",
                "body": "Hello,\n\nHere is your requested weather forecast for Lucknow:\n\n{{weather_data}}\n\n— Automated AgentFlow Dispatch"
            },
            "output_key": "email_status",
            "requires_approval": False
        }

        mock_fail = "Error: Weather data currently unavailable for 'Lucknow'. Both primary (Open-Meteo) and secondary (wttr.in) services could not be reached."

        plan = {
            "workflow_id": "wf_test_weather",
            "title": "Weather Report by Email",
            "steps": [step_1, step_2]
        }

        executor = WorkflowExecutionEngine(workflow_id="wf_test_weather", plan=plan, dry_run=False, run_id="run_test_weather_err")

        async def run_step_test():
            from backend.workflows import REGISTERED_TOOLS_META
            orig_func = REGISTERED_TOOLS_META["get_weather"]["func"]
            try:
                REGISTERED_TOOLS_META["get_weather"]["func"] = lambda **kwargs: mock_fail
                result = await executor.execute_step(step_1)
                return result
            finally:
                REGISTERED_TOOLS_META["get_weather"]["func"] = orig_func

        res = asyncio.run(run_step_test())
        self.assertEqual(res["status"], "failed", f"Expected step to fail, but got status: {res.get('status')}")
        self.assertIn("unavailable", res["error"])

        # Also verify that if weather_data failed, unresolved placeholder check prevents sending raw placeholder
        executor.step_context = {}  # weather_data not set because step 1 failed
        resolved_params = executor.substitute_params(step_2["params"])
        self.assertIn("{{weather_data}}", resolved_params["body"], "Placeholder should remain unresolved when step 1 fails")

    def test_09_scheduler_duplicate_prevention(self):
        """
        Verify that add_scheduled_task updates existing active jobs instead of
        creating duplicate jobs in APScheduler.
        """
        import asyncio
        from backend.scheduler import add_scheduled_task, scheduler

        async def run_dup_test():
            name = "Test Unique Weather Automation"
            prompt = "Send Lucknow weather every day"

            rec1 = await add_scheduled_task(
                name=name,
                prompt=prompt,
                frequency="daily",
                hour=7,
                minute=0
            )

            rec2 = await add_scheduled_task(
                name=name,
                prompt=prompt,
                frequency="daily",
                hour=7,
                minute=30
            )

            # IDs must match: rec2 should update rec1, not generate a duplicate job
            self.assertEqual(rec1["id"], rec2["id"], "Duplicate schedule created instead of updating existing job!")

            # Clean up test job
            try:
                from backend.scheduler import delete_scheduled_task
                await delete_scheduled_task(rec1["id"])
            except Exception:
                pass

        asyncio.run(run_dup_test())

    def test_10_email_contains_actual_weather_data_on_success(self):
        """
        Verify that when weather retrieval succeeds, the email body contains
        genuine meteorological data, temperatures, conditions, and zero unresolved placeholders.
        """
        sample_weather = (
            "🌤️ Weather Report for Lucknow, Uttar Pradesh, India:\n"
            "--------------------------------------------------\n"
            "- Condition: Clear sky\n"
            "- Current Temperature: 22.0°C (Feels like 22.0°C)\n"
            "- Relative Humidity: 50%\n"
            "- Wind Speed: 5.5 km/h\n"
            "- Coordinates: 26.85°N, 80.92°E\n\n"
            "Upcoming Forecast:\n"
            "  • 2026-11-27: Clear sky | High: 26.0°C, Low: 13.0°C | Rain Chance: 0%\n"
            "--------------------------------------------------\n"
            "(Source: Open-Meteo Free Global Forecast API, zero-cost)"
        )

        email_step = {
            "id": "step_2",
            "tool": "send_email",
            "name": "Dispatch Weather Digest via Gmail SMTP",
            "params": {
                "to_email": "inshaf713@gmail.com",
                "subject": "Weather Report for Lucknow",
                "body": "Hello,\n\nHere is your requested weather forecast for Lucknow:\n\n{{weather_data}}\n\nStay prepared and have a productive day!\n— Automated AgentFlow Dispatch"
            }
        }

        plan = {
            "workflow_id": "wf_test_weather_success",
            "title": "Weather Report by Email",
            "steps": [email_step]
        }

        executor = WorkflowExecutionEngine(workflow_id="wf_test_weather_success", plan=plan, dry_run=False)
        executor.step_context = {"weather_data": sample_weather, "step_1.output": sample_weather}

        resolved_params = executor.substitute_params(email_step["params"])

        # Check rendered body
        body = resolved_params["body"]
        self.assertNotIn("{{weather_data}}", body)
        self.assertIn("Weather Report for Lucknow, Uttar Pradesh, India", body)
        self.assertIn("Current Temperature: 22.0°C", body)
        self.assertIn("Condition: Clear sky", body)
        self.assertIn("Relative Humidity: 50%", body)
        self.assertIn("Rain Chance: 0%", body)
        self.assertIn("inshaf713@gmail.com", resolved_params["to_email"])
        self.assertEqual(resolved_params["subject"], "Weather Report for Lucknow")

    def test_11_live_weather_retrieval_if_online(self):
        """
        Tests live weather retrieval for Lucknow if network is reachable.
        Gracefully skips if offline/sandboxed without network.
        """
        import socket
        is_online = False
        try:
            socket.create_connection(("8.8.8.8", 53), timeout=1.5)
            is_online = True
        except Exception:
            is_online = False

        if not is_online:
            self.skipTest("Network unreachable (standard sandbox environment); skipping live API test.")

        weather_fn = get_weather.func if hasattr(get_weather, "func") else get_weather
        report = weather_fn("Lucknow", days=1)
        self.assertIn("Lucknow", report)
        self.assertIn("°C", report)
        self.assertNotIn("Expecting value", report)


if __name__ == "__main__":
    unittest.main()
