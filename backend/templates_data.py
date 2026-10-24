"""
AgentFlow - Built-in Curated Workflow Templates (Stage 6)
Tailored for Indian students, job seekers, freelancers, and SMB owners.
Zero paid APIs. Preloaded and seeded on every startup.
"""

from typing import List, Dict, Any

BUILTIN_TEMPLATES: List[Dict[str, Any]] = [
    {
        "id": "tpl-daily-ai-news-digest",
        "title": "Daily AI News Digest",
        "category": "News",
        "badge": "Popular",
        "icon": "Newspaper",
        "description": "Fetch today's top 5 AI news in India with dates and links, summarize them, and save to workspace/ai_news_digest.txt.",
        "prompt": "Fetch today's top 5 AI news in India with dates and links, summarize them, and save to workspace/ai_news_digest.txt.",
        "tools_used": ["get_latest_news", "save_file"],
        "required_credentials": [],
        "default_inputs": {},
        "requires_approval": True,
        "is_builtin": 1,
        "plan": {
            "title": "Daily AI News Digest",
            "description": "Fetches verified Indian AI news headlines and persists a formatted digest into workspace sandboxed storage.",
            "steps": [
                {
                    "id": "step_1",
                    "tool": "get_latest_news",
                    "name": "Fetch Top 5 Indian AI News Headlines (Google News RSS)",
                    "params": {"topic": "AI news India", "days": 1},
                    "output_key": "news_results",
                    "requires_approval": False,
                    "required_credentials": []
                },
                {
                    "id": "step_2",
                    "tool": "save_file",
                    "name": "Save AI News Digest to workspace/ai_news_digest.txt",
                    "params": {
                        "filename": "ai_news_digest.txt",
                        "content": "=== Daily AI News Digest (India) ===\n\n{{news_results}}",
                        "overwrite": True
                    },
                    "output_key": "saved_digest",
                    "requires_approval": True,
                    "required_credentials": []
                }
            ]
        }
    },
    {
        "id": "tpl-ai-news-telegram",
        "title": "AI News to Telegram",
        "category": "News",
        "badge": "Automated",
        "icon": "Send",
        "description": "Every day at 8 AM IST, fetch the top 5 AI news in India with dates and links and send a short summary to my Telegram.",
        "prompt": "Every day at 8 AM IST, fetch the top 5 AI news in India with dates and links and send a short summary to my Telegram.",
        "tools_used": ["get_latest_news", "send_telegram_message"],
        "required_credentials": ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
        "default_inputs": {},
        "requires_approval": True,
        "is_builtin": 1,
        "plan": {
            "title": "AI News to Telegram",
            "description": "Daily 8 AM IST scheduled brief of Indian AI headlines delivered via Telegram Bot.",
            "steps": [
                {
                    "id": "step_1",
                    "tool": "get_latest_news",
                    "name": "Fetch Top 5 Indian AI News Headlines",
                    "params": {"topic": "AI news India", "days": 1},
                    "output_key": "news_results",
                    "requires_approval": False,
                    "required_credentials": []
                },
                {
                    "id": "step_2",
                    "tool": "send_telegram_message",
                    "name": "Dispatch AI Summary to Telegram",
                    "params": {
                        "message": "🌅 *AgentFlow Daily AI Brief (IST)*\n\n{{news_results}}",
                        "parse_mode": "Markdown"
                    },
                    "output_key": "telegram_status",
                    "requires_approval": True,
                    "required_credentials": ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"]
                }
            ]
        }
    },
    {
        "id": "tpl-weather-report-email",
        "title": "Weather Report by Email",
        "category": "Weather",
        "badge": "Popular",
        "icon": "CloudSun",
        "description": "Get the current weather for {city}, write a short summary with temperature, conditions, humidity, wind and rain chance, and email it to {email}.",
        "prompt": "Get the current weather for {city}, write a short summary with temperature, conditions, humidity, wind and rain chance, and email it to {email}.",
        "tools_used": ["get_weather", "send_email"],
        "required_credentials": ["EMAIL_USER", "EMAIL_PASS"],
        "default_inputs": {"city": "", "email": ""},
        "requires_approval": True,
        "is_builtin": 1,
        "plan": {
            "title": "Weather Report by Email",
            "description": "Retrieves real-time meteorological conditions and sends a summary report via Gmail SMTP.",
            "steps": [
                {
                    "id": "step_1",
                    "tool": "get_weather",
                    "name": "Fetch Current Weather Forecast",
                    "params": {"city": "{{city}}", "days": 1},
                    "output_key": "weather_data",
                    "requires_approval": False,
                    "required_credentials": []
                },
                {
                    "id": "step_2",
                    "tool": "send_email",
                    "name": "Dispatch Weather Digest via Gmail SMTP",
                    "params": {
                        "to_email": "{{email}}",
                        "subject": "Weather Report for {{city}}",
                        "body": "Hello,\n\nHere is your requested weather forecast for {{city}}:\n\n{{weather_data}}\n\nStay prepared and have a productive day!\n— Automated AgentFlow Dispatch"
                    },
                    "output_key": "email_status",
                    "requires_approval": True,
                    "required_credentials": ["EMAIL_USER", "EMAIL_PASS"]
                }
            ]
        }
    },
    {
        "id": "tpl-daily-weather-telegram",
        "title": "Daily Weather on Telegram",
        "category": "Weather",
        "badge": "Scheduled",
        "icon": "CloudLightning",
        "description": "Every day at 7 AM IST, send the weather forecast for {city} to my Telegram.",
        "prompt": "Every day at 7 AM IST, send the weather forecast for {city} to my Telegram.",
        "tools_used": ["get_weather", "send_telegram_message"],
        "required_credentials": ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
        "default_inputs": {"city": ""},
        "requires_approval": True,
        "is_builtin": 1,
        "plan": {
            "title": "Daily Weather on Telegram",
            "description": "Morning 7 AM IST scheduled weather notification dispatched to your Telegram chat.",
            "steps": [
                {
                    "id": "step_1",
                    "tool": "get_weather",
                    "name": "Fetch Morning Weather Forecast",
                    "params": {"city": "{{city}}", "days": 1},
                    "output_key": "weather_data",
                    "requires_approval": False,
                    "required_credentials": []
                },
                {
                    "id": "step_2",
                    "tool": "send_telegram_message",
                    "name": "Dispatch Morning Weather to Telegram",
                    "params": {
                        "message": "☀️ *Morning Weather Forecast (7 AM IST)*\n\n{{weather_data}}\n\n— AgentFlow Automation",
                        "parse_mode": "Markdown"
                    },
                    "output_key": "telegram_status",
                    "requires_approval": True,
                    "required_credentials": ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"]
                }
            ]
        }
    },
    {
        "id": "tpl-weekly-tech-research-brief",
        "title": "Weekly Tech Research Brief",
        "category": "Business",
        "badge": "Research",
        "icon": "Search",
        "description": "Every Sunday at 6 PM IST, research this week's top AI and technology developments from multiple sources, write a short brief with source links and dates, and email it to {email}.",
        "prompt": "Every Sunday at 6 PM IST, research this week's top AI and technology developments from multiple sources, write a short brief with source links and dates, and email it to {email}.",
        "tools_used": ["multi_search", "get_latest_news", "fetch_page", "send_email"],
        "required_credentials": ["EMAIL_USER", "EMAIL_PASS"],
        "default_inputs": {"email": ""},
        "requires_approval": True,
        "is_builtin": 1,
        "plan": {
            "title": "Weekly Tech Research Brief",
            "description": "Multi-source synthesis of key technology developments dispatched weekly to your inbox.",
            "steps": [
                {
                    "id": "step_1",
                    "tool": "multi_search",
                    "name": "Parallel Deep Search on Emerging AI Tech",
                    "params": {
                        "queries": ["top artificial intelligence breakthroughs this week", "India tech startup funding policy news"],
                        "period": "w"
                    },
                    "output_key": "search_data",
                    "requires_approval": False,
                    "required_credentials": []
                },
                {
                    "id": "step_2",
                    "tool": "get_latest_news",
                    "name": "Gather Verified Top Tech Headlines",
                    "params": {"topic": "AI and technology India", "days": 7},
                    "output_key": "news_data",
                    "requires_approval": False,
                    "required_credentials": []
                },
                {
                    "id": "step_3",
                    "tool": "send_email",
                    "name": "Email Weekly Executive Tech Brief",
                    "params": {
                        "to_email": "{{email}}",
                        "subject": "Weekly Tech & AI Intelligence Brief",
                        "body": "Hello,\n\nHere is your curated weekly AI & Tech Research Brief:\n\n=== VERIFIED HEADLINES ===\n{{news_data}}\n\n=== RESEARCH SYNTHESIS ===\n{{search_data}}\n\nDelivered autonomously by AgentFlow."
                    },
                    "output_key": "email_status",
                    "requires_approval": True,
                    "required_credentials": ["EMAIL_USER", "EMAIL_PASS"]
                }
            ]
        }
    },
    {
        "id": "tpl-campus-placement-analytics",
        "title": "Campus Placement Analytics",
        "category": "Data",
        "badge": "Analytics",
        "icon": "BarChart3",
        "description": "Analyze workspace/samples/student_placement_data.csv, calculate average, highest and lowest CTC, compare branches, and save an executive summary to workspace/placement_summary.md.",
        "prompt": "Analyze workspace/samples/student_placement_data.csv, calculate average, highest and lowest CTC, compare branches, and save an executive summary to workspace/placement_summary.md.",
        "tools_used": ["analyze_tabular_data", "save_file"],
        "required_credentials": [],
        "default_inputs": {},
        "requires_approval": True,
        "is_builtin": 1,
        "plan": {
            "title": "Campus Placement Analytics",
            "description": "Performs statistical salary calculations across university departments and exports clean markdown summary.",
            "steps": [
                {
                    "id": "step_1",
                    "tool": "analyze_tabular_data",
                    "name": "Compute CTC Metrics and Branch Comparisons",
                    "params": {
                        "file_path": "samples/student_placement_data.csv",
                        "operation": "summary"
                    },
                    "output_key": "placement_metrics",
                    "requires_approval": False,
                    "required_credentials": []
                },
                {
                    "id": "step_2",
                    "tool": "save_file",
                    "name": "Save Executive Summary to workspace/placement_summary.md",
                    "params": {
                        "filename": "placement_summary.md",
                        "content": "# Campus Placement Analytics Report\n\n{{placement_metrics}}\n\n*Generated by AgentFlow Data Engine.*",
                        "overwrite": True
                    },
                    "output_key": "saved_report",
                    "requires_approval": True,
                    "required_credentials": []
                }
            ]
        }
    },
    {
        "id": "tpl-clean-my-spreadsheet",
        "title": "Clean My Spreadsheet",
        "category": "Data",
        "badge": "Utility",
        "icon": "FileSpreadsheet",
        "description": "Clean workspace/{file}, remove duplicates, fix inconsistent text and dates, flag missing and invalid values, list every change, and save the cleaned file to workspace/cleaned_{file}.",
        "prompt": "Clean workspace/{file}, remove duplicates, fix inconsistent text and dates, flag missing and invalid values, list every change, and save the cleaned file to workspace/cleaned_{file}.",
        "tools_used": ["analyze_tabular_data", "save_file"],
        "required_credentials": [],
        "default_inputs": {"file": "samples/student_placement_data.csv"},
        "requires_approval": True,
        "is_builtin": 1,
        "plan": {
            "title": "Clean My Spreadsheet",
            "description": "Standardizes raw messy spreadsheets, cleans formats, removes duplicates, and logs changes.",
            "steps": [
                {
                    "id": "step_1",
                    "tool": "analyze_tabular_data",
                    "name": "Audit and Normalize Tabular Dataset",
                    "params": {
                        "file_path": "{{file}}",
                        "operation": "clean"
                    },
                    "output_key": "cleaning_audit",
                    "requires_approval": False,
                    "required_credentials": []
                },
                {
                    "id": "step_2",
                    "tool": "save_file",
                    "name": "Save Cleaned Dataset and Audit Log",
                    "params": {
                        "filename": "cleaned_dataset_audit.txt",
                        "content": "=== Tabular Data Quality Audit ===\n\n{{cleaning_audit}}\n\nCleaned dataset normalized and saved successfully.",
                        "overwrite": True
                    },
                    "output_key": "audit_file",
                    "requires_approval": True,
                    "required_credentials": []
                }
            ]
        }
    },
    {
        "id": "tpl-website-uptime-monitor",
        "title": "Website Uptime Monitor",
        "category": "Monitoring",
        "badge": "DevOps",
        "icon": "Activity",
        "description": "Every 15 minutes check {url} and send me a Telegram alert if it is down or slower than 2 seconds.",
        "prompt": "Every 15 minutes check {url} and send me a Telegram alert if it is down or slower than 2 seconds.",
        "tools_used": ["check_website_health", "send_telegram_message"],
        "required_credentials": ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
        "default_inputs": {"url": "https://www.google.co.in"},
        "requires_approval": True,
        "is_builtin": 1,
        "plan": {
            "title": "Website Uptime Monitor",
            "description": "Pings the specified endpoint, measures response latency, and notifies Telegram if downtime occurs.",
            "steps": [
                {
                    "id": "step_1",
                    "tool": "check_website_health",
                    "name": "Probe Target Endpoint Health and Latency",
                    "params": {
                        "url": "{{url}}",
                        "expected_status": 200,
                        "timeout_seconds": 5
                    },
                    "output_key": "health_status",
                    "requires_approval": False,
                    "required_credentials": []
                },
                {
                    "id": "step_2",
                    "tool": "send_telegram_message",
                    "name": "Send Telemetry Alert to Telegram",
                    "params": {
                        "message": "📡 *Website Health Probe Status*\nTarget: `{{url}}`\n\n{{health_status}}",
                        "parse_mode": "Markdown"
                    },
                    "output_key": "telegram_status",
                    "requires_approval": True,
                    "required_credentials": ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"]
                }
            ]
        }
    },
    {
        "id": "tpl-internship-scholarship-finder",
        "title": "Internship and Scholarship Finder",
        "category": "Career",
        "badge": "Students",
        "icon": "GraduationCap",
        "description": "Find 5 current AI internships in India for BCA and Data Science students with company, role, apply link and last date, and save to workspace/internships.txt.",
        "prompt": "Find 5 current AI internships in India for BCA and Data Science students with company, role, apply link and last date, and save to workspace/internships.txt.",
        "tools_used": ["multi_search", "fetch_page", "save_file"],
        "required_credentials": [],
        "default_inputs": {},
        "requires_approval": True,
        "is_builtin": 1,
        "plan": {
            "title": "Internship and Scholarship Finder",
            "description": "Searches Indian job boards and portals for active AI student internships and saves verified links.",
            "steps": [
                {
                    "id": "step_1",
                    "tool": "multi_search",
                    "name": "Scan Verified Student Internship Portals",
                    "params": {
                        "queries": [
                            "AI machine learning internship India BCA BTech 2026",
                            "Data science intern apply online India stipends"
                        ],
                        "period": "w"
                    },
                    "output_key": "internship_listings",
                    "requires_approval": False,
                    "required_credentials": []
                },
                {
                    "id": "step_2",
                    "tool": "save_file",
                    "name": "Export Curated Roles to workspace/internships.txt",
                    "params": {
                        "filename": "internships.txt",
                        "content": "=== Curated AI & Data Science Internships (India) ===\n\n{{internship_listings}}\n\nGood luck with your applications!\n— AgentFlow Career Assistant",
                        "overwrite": True
                    },
                    "output_key": "saved_listings",
                    "requires_approval": True,
                    "required_credentials": []
                }
            ]
        }
    },
    {
        "id": "tpl-ai-skills-roadmap",
        "title": "AI Skills Roadmap",
        "category": "Career",
        "badge": "Career",
        "icon": "Compass",
        "description": "Research the top 7 in-demand skills for an AI Engineer in 2026, add one free learning resource for each, and save to workspace/ai_roadmap.txt.",
        "prompt": "Research the top 7 in-demand skills for an AI Engineer in 2026, add one free learning resource for each, and save to workspace/ai_roadmap.txt.",
        "tools_used": ["multi_search", "save_file"],
        "required_credentials": [],
        "default_inputs": {},
        "requires_approval": True,
        "is_builtin": 1,
        "plan": {
            "title": "AI Skills Roadmap",
            "description": "Researches top industry capabilities for modern AI development with free vetted course resources.",
            "steps": [
                {
                    "id": "step_1",
                    "tool": "multi_search",
                    "name": "Research 2026 In-Demand AI Skills & Syllabi",
                    "params": {
                        "queries": [
                            "top required skills AI engineer 2026 LLM agents",
                            "free learning resources roadmap AI developer"
                        ],
                        "period": "m"
                    },
                    "output_key": "roadmap_data",
                    "requires_approval": False,
                    "required_credentials": []
                },
                {
                    "id": "step_2",
                    "tool": "save_file",
                    "name": "Save Learning Blueprint to workspace/ai_roadmap.txt",
                    "params": {
                        "filename": "ai_roadmap.txt",
                        "content": "# AI Engineer 2026 Skills Roadmap & Free Learning Resources\n\n{{roadmap_data}}\n\n*Crafted autonomously by AgentFlow.*",
                        "overwrite": True
                    },
                    "output_key": "roadmap_file",
                    "requires_approval": True,
                    "required_credentials": []
                }
            ]
        }
    },
    {
        "id": "tpl-important-emails-telegram",
        "title": "Important Emails to Telegram",
        "category": "Monitoring",
        "badge": "Secure",
        "icon": "Mail",
        "description": "Every morning at 9 AM IST, read my important unread emails (jobs, bills, college) and send a list to my Telegram.",
        "prompt": "Every morning at 9 AM IST, read my important unread emails (jobs, bills, college) and send a list to my Telegram.",
        "tools_used": ["read_important_emails", "send_telegram_message"],
        "required_credentials": ["EMAIL_USER", "EMAIL_PASS", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
        "default_inputs": {},
        "requires_approval": True,
        "is_builtin": 1,
        "plan": {
            "title": "Important Emails to Telegram",
            "description": "Scans your inbox for high-priority subjects (jobs, college, invoices) and alerts via Telegram (read-only).",
            "steps": [
                {
                    "id": "step_1",
                    "tool": "read_important_emails",
                    "name": "Scan Inbox for Priority Senders and Keywords",
                    "params": {"max_results": 5, "mark_as_read": False},
                    "output_key": "unread_emails",
                    "requires_approval": False,
                    "required_credentials": ["EMAIL_USER", "EMAIL_PASS"]
                },
                {
                    "id": "step_2",
                    "tool": "send_telegram_message",
                    "name": "Dispatch Priority Summary to Telegram",
                    "params": {
                        "message": "📬 *Important Emails Digest (9 AM IST)*\n\n{{unread_emails}}\n\n— AgentFlow Private Email Guard",
                        "parse_mode": "Markdown"
                    },
                    "output_key": "telegram_status",
                    "requires_approval": True,
                    "required_credentials": ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"]
                }
            ]
        }
    },
    {
        "id": "tpl-freelance-expense-report",
        "title": "Freelance Expense Report",
        "category": "Data",
        "badge": "Finance",
        "icon": "Receipt",
        "description": "Analyze workspace/samples/freelance_agency_expenses.csv, show spending by category and payment method, and save the report to workspace/expense_report.md.",
        "prompt": "Analyze workspace/samples/freelance_agency_expenses.csv, show spending by category and payment method, and save the report to workspace/expense_report.md.",
        "tools_used": ["analyze_tabular_data", "save_file"],
        "required_credentials": [],
        "default_inputs": {},
        "requires_approval": True,
        "is_builtin": 1,
        "plan": {
            "title": "Freelance Expense Report",
            "description": "Audits business expenses, computes category subtotals, GST summaries, and generates a markdown report.",
            "steps": [
                {
                    "id": "step_1",
                    "tool": "analyze_tabular_data",
                    "name": "Group Expenses by Category and Payment Channel",
                    "params": {
                        "file_path": "samples/freelance_agency_expenses.csv",
                        "operation": "summary"
                    },
                    "output_key": "expense_breakdown",
                    "requires_approval": False,
                    "required_credentials": []
                },
                {
                    "id": "step_2",
                    "tool": "save_file",
                    "name": "Export Audit Report to workspace/expense_report.md",
                    "params": {
                        "filename": "expense_report.md",
                        "content": "# Freelance Agency Expense & Tax Audit\n\n{{expense_breakdown}}\n\n*Generated securely by AgentFlow.*",
                        "overwrite": True
                    },
                    "output_key": "saved_expense_report",
                    "requires_approval": True,
                    "required_credentials": []
                }
            ]
        }
    },
    {
        "id": "tpl-resume-job-assistant",
        "title": "Resume & Job Application Assistant",
        "category": "Career",
        "badge": "Job Seekers",
        "icon": "FileCheck",
        "description": "Upload resume (PDF/DOCX) and target job description to get an ATS compatibility score (out of 100), keyword gap analysis, STAR-improved resume bullet points without inventing facts, tailored cover letter, and application email draft upon approval.",
        "prompt": "Analyze my resume for target job description, compute ATS score, extract keyword gaps, create tailored cover letter and improved resume without inventing facts, and email report to inshaf713@gmail.com.",
        "tools_used": ["parse_resume", "score_resume_ats", "generate_resume_improvements", "generate_cover_letter", "save_file", "send_email"],
        "required_credentials": ["EMAIL_USER", "EMAIL_PASS"],
        "default_inputs": {
            "resume_filename": "resume.pdf",
            "job_description": "Software Engineer / AI Application Developer (Python, FastAPI, React, SQL, Git)",
            "receiver_email": "inshaf713@gmail.com"
        },
        "requires_approval": True,
        "is_builtin": 1,
        "plan": {
            "title": "Resume & Job Application Assistant",
            "description": "Predefined career pipeline: Parse resume, compute rule-based ATS score out of 100, generate STAR resume improvements and tailored cover letter via LLM, save report, and send email upon approval.",
            "steps": [
                {
                    "id": "step_1",
                    "tool": "parse_resume",
                    "name": "Parse Resume Document (PDF/DOCX)",
                    "params": {
                        "resume_filename": "{{resume_filename}}"
                    },
                    "output_key": "step_1.output",
                    "requires_approval": False,
                    "required_credentials": []
                },
                {
                    "id": "step_2",
                    "tool": "score_resume_ats",
                    "name": "Evaluate Transparent ATS Score & Keyword Gaps",
                    "params": {
                        "resume_text": "{{step_1.output}}",
                        "job_description": "{{job_description}}"
                    },
                    "output_key": "step_2.output",
                    "requires_approval": False,
                    "required_credentials": []
                },
                {
                    "id": "step_3",
                    "tool": "generate_resume_improvements",
                    "name": "Generate STAR-Format Resume Improvements",
                    "params": {
                        "resume_text": "{{step_1.output}}",
                        "job_description": "{{job_description}}"
                    },
                    "output_key": "step_3.output",
                    "requires_approval": False,
                    "required_credentials": []
                },
                {
                    "id": "step_4",
                    "tool": "generate_cover_letter",
                    "name": "Draft Tailored Cover Letter",
                    "params": {
                        "resume_text": "{{step_1.output}}",
                        "job_description": "{{job_description}}"
                    },
                    "output_key": "step_4.output",
                    "requires_approval": False,
                    "required_credentials": []
                },
                {
                    "id": "step_5",
                    "tool": "save_file",
                    "name": "Save Comprehensive Report to workspace/resume_analysis_report.md",
                    "params": {
                        "filename": "resume_analysis_report.md",
                        "content": "{{step_2.output}}\n\n---\n\n{{step_3.output}}\n\n---\n\n{{step_4.output}}",
                        "overwrite": True
                    },
                    "output_key": "step_5.output",
                    "requires_approval": False,
                    "required_credentials": []
                },
                {
                    "id": "step_6",
                    "tool": "send_email",
                    "name": "Email Resume Analysis & Application Kit",
                    "params": {
                        "to_email": "{{receiver_email}}",
                        "subject": "AgentFlow: Resume & Job Application Analysis Report",
                        "body": "Hello,\n\nHere is your comprehensive Resume & Job Application Analysis Report, ATS score breakdown, STAR-improved bullets, and tailored cover letter:\n\n{{step_2.output}}\n\n{{step_3.output}}\n\n{{step_4.output}}\n\nGenerated autonomously by AgentFlow."
                    },
                    "output_key": "step_6.output",
                    "requires_approval": True,
                    "required_credentials": ["EMAIL_USER", "EMAIL_PASS"]
                }
            ]
        }
    }
]
