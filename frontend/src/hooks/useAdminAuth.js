import { useState, useCallback, useRef } from 'react';

/**
 * useAdminAuth
 * Reusable React hook managing transient administrative authentication for remote deployments.
 *
 * Security Guidelines Followed:
 * 1. The key is NEVER saved to LocalStorage, SessionStorage, cookies, or window globals.
 * 2. The key is NEVER logged to console.log or UI activity logs.
 * 3. The key is passed ONLY in the 'X-AgentFlow-Admin-Key' request header for authorized operations.
 * 4. The key is cleared from component memory immediately after the operation completes or cancels.
 * 5. On localhost (127.0.0.1 / ::1), operations succeed directly without triggering the modal.
 */
export function useAdminAuth() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [actionDescription, setActionDescription] = useState('Administrative Action');

  // Holds pending operation parameters across the prompt interaction
  const pendingOpRef = useRef(null);

  /**
   * Closes the modal, cancels pending operations, and resets all state.
   */
  const cancelVerification = useCallback(() => {
    if (pendingOpRef.current?.onCancel) {
      try {
        pendingOpRef.current.onCancel();
      } catch (e) {
        // Safe ignore
      }
    }
    pendingOpRef.current = null;
    setIsOpen(false);
    setIsSubmitting(false);
    setErrorMessage('');
  }, []);

  /**
   * Called by AdminVerificationModal when the user submits their candidate AGENTFLOW_ADMIN_KEY.
   * Runs the queued action with the key header attached.
   */
  const submitVerification = useCallback(async (candidateKey) => {
    if (!candidateKey || !candidateKey.trim()) {
      setErrorMessage('Please enter your AGENTFLOW_ADMIN_KEY.');
      return;
    }

    if (!pendingOpRef.current) {
      setIsOpen(false);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    const cleanKey = candidateKey.trim();
    const { actionFn, onSuccess, onError } = pendingOpRef.current;

    try {
      // Execute the pending action with the candidate admin key header
      const response = await actionFn({ 'X-AgentFlow-Admin-Key': cleanKey });

      if (response && response.status === 403) {
        let detail = '';
        try {
          const errJson = await response.clone().json();
          detail = errJson.detail || errJson.message || '';
        } catch (_) {}

        if (detail.includes('X-AgentFlow-Admin-Key') || detail.includes('Administrative operation')) {
          setErrorMessage('Invalid Admin Key. Please ensure the key matches the AGENTFLOW_ADMIN_KEY configured on your Render dashboard.');
          setIsSubmitting(false);
          return;
        }
      }

      if (response && !response.ok) {
        let errJson = {};
        try {
          errJson = await response.clone().json();
        } catch (_) {}
        setErrorMessage(errJson.detail || errJson.message || `Operation failed with HTTP ${response.status}`);
        setIsSubmitting(false);
        if (onError) onError(errJson);
        return;
      }

      // Succeeded: clear pending action and modal state
      pendingOpRef.current = null;
      setIsOpen(false);
      setIsSubmitting(false);
      setErrorMessage('');

      if (onSuccess) {
        await onSuccess(response);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Network error during administrative verification.');
      setIsSubmitting(false);
      if (onError) onError(err);
    }
  }, []);

  /**
   * Initiates an administrative operation.
   * Attempts normal execution first. If the backend denies access (HTTP 403 requiring admin key),
   * opens the verification modal so the user can enter their key.
   *
   * @param {Function} actionFn - Async function (headers: Record<string, string>) => Promise<Response>
   * @param {Object} options - { actionName?: string, onSuccess?: (res: Response) => void, onError?: (err: any) => void, onCancel?: () => void }
   */
  const executeAdminAction = useCallback(async (actionFn, options = {}) => {
    try {
      // Attempt standard execution without admin header (works transparently for local dev)
      const res = await actionFn({});

      if (res && res.status === 403) {
        let detail = '';
        try {
          const errJson = await res.clone().json();
          detail = errJson.detail || errJson.message || '';
        } catch (_) {}

        if (detail.includes('X-AgentFlow-Admin-Key') || detail.includes('Administrative operation')) {
          // Remote client: queue operation and prompt verification modal
          setActionDescription(options.actionName || 'Administrative Action');
          setErrorMessage('');
          pendingOpRef.current = { actionFn, ...options };
          setIsOpen(true);
          return;
        }
      }

      // If already authorized (e.g. localhost) or non-auth outcome
      if (res && res.ok) {
        if (options.onSuccess) await options.onSuccess(res);
      } else {
        let errJson = {};
        try {
          errJson = await res.clone().json();
        } catch (_) {}
        if (options.onError) {
          options.onError(errJson);
        }
      }
    } catch (err) {
      if (options.onError) {
        options.onError(err);
      }
    }
  }, []);

  const adminModalProps = {
    isOpen,
    isSubmitting,
    errorMessage,
    actionDescription,
    onSubmit: submitVerification,
    onCancel: cancelVerification
  };

  return {
    executeAdminAction,
    adminModalProps,
    isAdminModalOpen: isOpen
  };
}
