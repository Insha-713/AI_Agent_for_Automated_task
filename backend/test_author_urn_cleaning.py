import sqlite3
import os
from pathlib import Path
from backend.credentials import get_credential, set_credential
from backend.platform_engine import LinkedInAdapter

def main():
    print("--- Current Database & Environment Check ---")
    current_urn = get_credential("LINKEDIN_AUTHOR_URN")
    print(f"Current LINKEDIN_AUTHOR_URN from get_credential(): '{current_urn}'")

    # Check sqlite directly
    db_path = Path("backend/agentflow.db")
    if db_path.exists():
        conn = sqlite3.connect(str(db_path))
        c = conn.cursor()
        c.execute("SELECT key, value FROM user_settings WHERE key = 'LINKEDIN_AUTHOR_URN'")
        row = c.fetchone()
        print(f"SQLite user_settings row: {row}")
        conn.close()

    # Check .env directly
    env_path = Path(".env")
    if env_path.exists():
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("LINKEDIN_AUTHOR_URN"):
                    print(f".env line: {line.strip()}")

    print("\n--- Test Cleaning & Validation Test Cases ---")
    test_cases = [
        # Accidental Markdown bold
        ("**urn:li:person:1116653996**", True, "urn:li:person:1116653996"),
        ("**1116653996**", True, "urn:li:person:1116653996"),
        ("*urn:li:person:1116653996*", True, "urn:li:person:1116653996"),
        ("`urn:li:person:1116653996`", True, "urn:li:person:1116653996"),
        ("__urn:li:person:1116653996__", True, "urn:li:person:1116653996"),
        # Accidental HTML entity corruption
        ("&#x31;&#x31;&#x31;&#x36;&#x36;&#x35;&#x33;&#x39;&#x39;&#x36;", True, "urn:li:person:1116653996"),
        ("urn:li:person:&#x31;&#x31;&#x31;&#x36;&#x36;&#x35;&#x33;&#x39;&#x39;&#x36;", True, "urn:li:person:1116653996"),
        ("**urn:li:person:&#x31;&#x31;&#x31;&#x36;&#x36;&#x35;&#x33;&#x39;&#x39;&#x36;**", True, "urn:li:person:1116653996"),
        # Accidental HTML tags
        ("<code>urn:li:person:1116653996</code>", True, "urn:li:person:1116653996"),
        ("<span>1116653996</span>", True, "urn:li:person:1116653996"),
        # Whitespace and quotes
        ("  \"urn:li:person:1116653996\"  \n", True, "urn:li:person:1116653996"),
        (" '1116653996' ", True, "urn:li:person:1116653996"),
        # Nested/duplicated prefix
        ("urn:li:person:urn:li:person:1116653996", True, "urn:li:person:1116653996"),
        ("urn:li:member:1116653996", True, "urn:li:person:1116653996"),
        # Organization URN
        ("urn:li:organization:12345678", True, "urn:li:organization:12345678"),
        ("**urn:li:organization:12345678**", True, "urn:li:organization:12345678"),
        # Invalid cases (must be rejected)
        ("https://www.linkedin.com/in/insha-fatima-123456", False, None),
        ("urn:li:person:https://www.linkedin.com/in/insha-fatima", False, None),
        ("YOUR_MEMBER_ID", False, None),
        ("AQWxxxx...access_token_pasted", False, None),
        ("urn:li:person:abc_not_numeric", False, None),
        ("", False, None),
    ]

    all_passed = True
    for raw, expected_valid, expected_canon in test_cases:
        is_valid, canon, err = LinkedInAdapter.validate_author_urn(raw)
        passed = (is_valid == expected_valid) and (not expected_valid or canon == expected_canon)
        status_sym = "✓" if passed else "✗"
        if not passed:
            all_passed = False
        print(f"[{status_sym}] Raw: {raw!r:45} -> valid={is_valid}, canon={canon!r:30} err={err[:40] if err else ''}")

    print(f"\nAll tests passed: {all_passed}")

if __name__ == "__main__":
    main()
