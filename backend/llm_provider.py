"""
AgentFlow - LLM Provider Layer
Supports local Ollama inference and cloud-based LLMs (Groq, Google Gemini) via LangChain.
Reads LLM_PROVIDER, LLM_MODEL, GROQ_API_KEY, and GEMINI_API_KEY dynamically at call time.
Safe by design: NEVER exposes secrets or raw credentials.
"""

import os
import time
import json
import urllib.request
import urllib.error
from typing import Dict, Any, Optional, Tuple
from dotenv import load_dotenv

# Ensure environment is refreshed
load_dotenv()


def get_llm_provider() -> str:
    """
    Resolves active LLM provider dynamically at call time.
    Returns: 'ollama', 'groq', or 'gemini'.
    Defaults to 'ollama' for zero-config local use.
    """
    raw = os.getenv("LLM_PROVIDER", "").strip().lower()
    if raw in ("groq",):
        return "groq"
    if raw in ("gemini", "google", "google_genai"):
        return "gemini"
    if raw in ("ollama", "local"):
        return "ollama"
    return "ollama"


def detect_ollama_model(base_url: str, preferred_model: str) -> str:
    """Checks what models are installed in Ollama. Returns preferred if found or fallback."""
    clean_url = base_url.rstrip("/")
    tags_url = f"{clean_url}/api/tags"

    try:
        req = urllib.request.Request(tags_url, headers={"User-Agent": "AgentFlow"})
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            data = json.loads(resp.read().decode())
            models = [m.get("name", "") for m in data.get("models", [])]

            for m in models:
                if m == preferred_model or m.startswith(f"{preferred_model}:"):
                    return m

            if models:
                return models[0]

            return preferred_model
    except Exception:
        return preferred_model


def get_active_model_name(provider: Optional[str] = None) -> str:
    """
    Returns the active model name for the given or current provider.
    Honors LLM_MODEL override if explicitly provided.
    """
    prov = provider or get_llm_provider()
    custom_model = os.getenv("LLM_MODEL", "").strip()
    if custom_model:
        return custom_model

    if prov == "groq":
        return os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip()
    elif prov == "gemini":
        return os.getenv("GEMINI_MODEL", "gemini-1.5-flash").strip()
    else:
        base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
        preferred_model = os.getenv("OLLAMA_MODEL", "llama3.1").strip()
        return detect_ollama_model(base_url, preferred_model)


def is_llm_configured(provider: Optional[str] = None) -> bool:
    """
    Returns True if the required credentials/configuration for the provider exist.
    Never exposes values.
    """
    prov = provider or get_llm_provider()
    if prov == "groq":
        key = os.getenv("GROQ_API_KEY", "").strip()
        return bool(key and len(key) > 5)
    elif prov == "gemini":
        key = os.getenv("GEMINI_API_KEY", "").strip() or os.getenv("GOOGLE_API_KEY", "").strip()
        return bool(key and len(key) > 5)
    elif prov == "ollama":
        base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").strip()
        return bool(base_url)
    return False


def is_ollama_alive(base_url: Optional[str] = None, timeout: float = 2.0) -> bool:
    """Quick socket/HTTP probe to check if Ollama server is actively responding."""
    url = (base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")).rstrip("/")
    try:
        req = urllib.request.Request(f"{url}/api/tags", headers={"User-Agent": "AgentFlow"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status == 200
    except Exception:
        return False


def is_llm_available() -> Tuple[bool, str]:
    """
    Checks if the active LLM provider is both configured and currently reachable.
    Returns: (is_available, human_readable_reason)
    """
    prov = get_llm_provider()
    if prov == "ollama":
        base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
        if not is_ollama_alive(base_url):
            return False, "No LLM available on this server. Set LLM_PROVIDER and an API key."
        return True, "Ollama local inference server is online and responding."

    elif prov == "groq":
        if not is_llm_configured("groq"):
            return False, "GROQ_API_KEY is not configured in server environment."
        return True, "Groq cloud provider is configured."

    elif prov == "gemini":
        if not is_llm_configured("gemini"):
            return False, "GEMINI_API_KEY is not configured in server environment."
        return True, "Google Gemini cloud provider is configured."

    return False, f"Unknown LLM provider '{prov}'."


def get_chat_llm(
    provider: Optional[str] = None,
    model_name: Optional[str] = None,
    temperature: float = 0.1,
    timeout: float = 30.0,
    max_retries: int = 1
):
    """
    Dynamically instantiates and returns a LangChain ChatModel instance
    configured with the active provider and model.
    Raises RuntimeError if required API key or server is unavailable.
    """
    prov = provider or get_llm_provider()
    model = model_name or get_active_model_name(prov)

    if prov == "groq":
        key = os.getenv("GROQ_API_KEY", "").strip()
        if not key:
            raise RuntimeError("GROQ_API_KEY is not configured. Set GROQ_API_KEY on Render or in .env.")
        from langchain_groq import ChatGroq
        return ChatGroq(
            model_name=model,
            api_key=key,
            temperature=temperature,
            timeout=timeout,
            max_retries=max_retries
        )

    elif prov == "gemini":
        key = os.getenv("GEMINI_API_KEY", "").strip() or os.getenv("GOOGLE_API_KEY", "").strip()
        if not key:
            raise RuntimeError("GEMINI_API_KEY is not configured. Set GEMINI_API_KEY on Render or in .env.")
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model=model,
            google_api_key=key,
            temperature=temperature,
            timeout=timeout,
            max_retries=max_retries
        )

    else:  # ollama
        base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
        from langchain_ollama import ChatOllama
        return ChatOllama(
            model=model,
            base_url=base_url,
            temperature=temperature
        )


def test_llm_connection(prompt: str = "Say 'AgentFlow connection OK' in 5 words or less.") -> Dict[str, Any]:
    """
    Tests the active LLM provider connection by sending a lightweight test prompt.
    Returns status, latency_ms, masked configuration info, and user-facing guidance.
    NEVER leaks API keys or secrets.
    """
    prov = get_llm_provider()
    model = get_active_model_name(prov)
    configured = is_llm_configured(prov)

    provider_display_names = {
        "ollama": "Ollama Local LLM",
        "groq": "Groq Cloud LLM",
        "gemini": "Google Gemini Cloud LLM"
    }
    display_name = provider_display_names.get(prov, f"{prov.capitalize()} LLM")

    # If provider is Ollama and local port is unreachable
    if prov == "ollama":
        base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
        t0 = time.perf_counter()
        alive = is_ollama_alive(base_url, timeout=2.5)
        latency_ms = round((time.perf_counter() - t0) * 1000, 1)

        if not alive:
            return {
                "service": "llm",
                "display_name": display_name,
                "provider": prov,
                "active_model": model,
                "status": "offline",
                "configured": False,
                "latency_ms": latency_ms,
                "endpoint": base_url,
                "message": "No LLM available on this server. Set LLM_PROVIDER and an API key.",
                "guidance": "On Render or cloud hosts, set LLM_PROVIDER=groq and GROQ_API_KEY=your_key, or LLM_PROVIDER=gemini and GEMINI_API_KEY=your_key."
            }

    # If cloud provider lacks API key
    if not configured:
        env_var_name = "GROQ_API_KEY" if prov == "groq" else ("GEMINI_API_KEY" if prov == "gemini" else "OLLAMA_BASE_URL")
        return {
            "service": "llm",
            "display_name": display_name,
            "provider": prov,
            "active_model": model,
            "status": "not_configured",
            "configured": False,
            "latency_ms": 0.0,
            "message": f"{env_var_name} is not configured on this server.",
            "guidance": f"Add {env_var_name} in your Render environment variables or .env file to enable {display_name}."
        }

    # Attempt real invocation test
    t0 = time.perf_counter()
    try:
        from langchain_core.messages import HumanMessage
        llm = get_chat_llm(provider=prov, model_name=model, temperature=0.1, timeout=8.0, max_retries=0)
        resp = llm.invoke([HumanMessage(content=prompt)])
        latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        output_text = getattr(resp, "content", "").strip()

        return {
            "service": "llm",
            "display_name": display_name,
            "provider": prov,
            "active_model": model,
            "status": "connected",
            "configured": True,
            "latency_ms": latency_ms,
            "test_response": output_text[:200],
            "message": f"Connected to {display_name} ({model}) in {latency_ms} ms. Test response: \"{output_text[:120]}\"",
            "guidance": "LLM inference is active and ready for research and plan generation."
        }
    except Exception as e:
        latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        err_msg = str(e)

        # Sanitize error message to avoid printing potential key echoes
        sanitized_err = err_msg.replace(os.getenv("GROQ_API_KEY", "___NOKEY___"), "[REDACTED]")
        sanitized_err = sanitized_err.replace(os.getenv("GEMINI_API_KEY", "___NOKEY___"), "[REDACTED]")

        # Truncate if too long
        if len(sanitized_err) > 200:
            sanitized_err = sanitized_err[:200] + "..."

        if "401" in err_msg or "Invalid API Key" in err_msg or "API_KEY_INVALID" in err_msg:
            status = "invalid_credentials"
            hint = f"The provided API key for {prov.upper()} was rejected. Please verify your API key."
        elif "Connection" in err_msg or "unreachable" in err_msg or "refused" in err_msg:
            status = "offline"
            hint = "No LLM available on this server. Set LLM_PROVIDER and an API key."
        else:
            status = "error"
            hint = f"Error communicating with {display_name}. Check logs for details."

        return {
            "service": "llm",
            "display_name": display_name,
            "provider": prov,
            "active_model": model,
            "status": status,
            "configured": True,
            "latency_ms": latency_ms,
            "message": f"{display_name} error: {sanitized_err}",
            "guidance": hint
        }
