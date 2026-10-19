"""
AgentFlow - Human-in-the-loop Approval Manager
Coordinates pausing the agent before sensitive actions (e.g. sending emails or overwriting files),
broadcasting approval cards over SSE, and resuming or cancelling based on user choice.
"""

import uuid
import threading
import asyncio
from typing import Dict, Any, Optional, Callable, List
from datetime import datetime

class ApprovalManager:
    def __init__(self):
        self._pending: Dict[str, Dict[str, Any]] = {}
        self._listeners: List[Callable[[Dict[str, Any]], None]] = []
        self._lock = threading.Lock()

    def register_listener(self, callback: Callable[[Dict[str, Any]], None]):
        """Registers a queue or callback to receive approval broadcast events."""
        with self._lock:
            if callback not in self._listeners:
                self._listeners.append(callback)

    def unregister_listener(self, callback: Callable[[Dict[str, Any]], None]):
        """Unregisters an event listener."""
        with self._lock:
            if callback in self._listeners:
                self._listeners.remove(callback)

    def has_active_listeners(self) -> bool:
        """Returns True if there is at least one active web SSE listener."""
        with self._lock:
            return len(self._listeners) > 0

    def broadcast_event(self, event_data: Dict[str, Any]):
        """Broadcasts an approval event to active SSE streams."""
        with self._lock:
            listeners = list(self._listeners)
        for cb in listeners:
            try:
                cb(event_data)
            except Exception as e:
                print(f"[ApprovalManager] Error notifying listener: {e}")

    def request_approval(
        self,
        task_id: str,
        action_type: str,
        tool_name: str,
        parameters: Dict[str, Any],
        details: str,
        timeout: float = 300.0
    ) -> bool:
        """
        Pauses the calling thread and requests user approval over SSE.
        Returns True if approved, False if rejected or timed out.
        """
        approval_id = str(uuid.uuid4())
        event = threading.Event()

        approval_record = {
            "id": approval_id,
            "task_id": task_id,
            "action_type": action_type,
            "tool_name": tool_name,
            "parameters": parameters,
            "details": details,
            "status": "pending",
            "event": event,
            "decision": None,
            "created_at": datetime.now().isoformat()
        }

        with self._lock:
            self._pending[approval_id] = approval_record

        # Broadcast approval card event to SSE clients
        self.broadcast_event({
            "type": "approval_required",
            "approval_id": approval_id,
            "task_id": task_id,
            "action_type": action_type,
            "tool": tool_name,
            "args": parameters,
            "details": details
        })

        # Pause execution until user clicks Approve or Reject (or timeout after 5 mins)
        signaled = event.wait(timeout=timeout)
        
        with self._lock:
            entry = self._pending.pop(approval_id, None)

        if not signaled:
            print(f"[ApprovalManager] Approval {approval_id} timed out after {timeout}s.")
            return False

        is_approved = (entry.get("decision") == "approve") if entry else False
        return is_approved

    def register_pending(self, approval_record: Dict[str, Any]):
        """Registers a pending approval record from workflow engine or agent."""
        with self._lock:
            self._pending[approval_record["id"]] = approval_record

    def resolve_approval(self, approval_id: str, decision: str) -> bool:
        """
        Resolves a pending approval with 'approve' or 'reject' and unblocks the waiting agent.
        """
        with self._lock:
            entry = self._pending.get(approval_id)
            if not entry:
                return False

            entry["decision"] = decision
            entry["status"] = decision
            if "event" in entry and entry["event"]:
                try:
                    entry["event"].set()
                except Exception:
                    pass
            return True

    def get_pending_approval(self, approval_id: str) -> Optional[Dict[str, Any]]:
        """Returns pending approval metadata if present."""
        with self._lock:
            entry = self._pending.get(approval_id)
            if entry:
                return {
                    "id": entry["id"],
                    "task_id": entry.get("task_id") or entry.get("workflow_id"),
                    "action_type": entry.get("action_type", entry.get("tool")),
                    "tool_name": entry.get("tool_name", entry.get("tool")),
                    "parameters": entry.get("parameters", {}),
                    "details": entry.get("details", ""),
                    "status": entry.get("status", "pending"),
                    "decision": entry.get("decision"),
                    "dry_run": entry.get("dry_run", False),
                    "created_at": entry.get("created_at")
                }
            return None


# Global ApprovalManager singleton
approval_manager = ApprovalManager()
