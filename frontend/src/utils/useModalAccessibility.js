import { useEffect, useRef } from 'react';

/**
 * Custom hook to handle comprehensive modal accessibility:
 * - 8.1 Escape key to close
 * - 8.3 Focus management: Auto-focus first control, trap focus within modal, restore focus on close
 * - 8.4 Lock background body scrolling while modal is open
 */
export function useModalAccessibility({ isOpen, onClose, modalRef }) {
  const previousActiveElementRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    // Save current active element to restore later
    previousActiveElementRef.current = document.activeElement;

    // 8.4 Lock background scrolling
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }
    document.body.style.overflow = 'hidden';

    // 8.3 Auto-focus modal or first interactive element
    const focusTimer = setTimeout(() => {
      if (modalRef?.current) {
        const focusableSelector =
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
        const focusableElements = modalRef.current.querySelectorAll(focusableSelector);
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        } else {
          modalRef.current.focus?.();
        }
      }
    }, 50);

    // 8.1 Escape key listener and 8.3 Focus trapping
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
        return;
      }

      if (e.key === 'Tab' && modalRef?.current) {
        const focusableSelector =
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
        const focusableElements = Array.from(
          modalRef.current.querySelectorAll(focusableSelector)
        ).filter((el) => el.offsetParent !== null); // only visible elements

        if (focusableElements.length === 0) {
          e.preventDefault();
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement || !modalRef.current.contains(document.activeElement)) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement || !modalRef.current.contains(document.activeElement)) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown, true);

      // Restore body scrolling
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;

      // Restore focus to triggering element
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
        try {
          previousActiveElementRef.current.focus();
        } catch (err) {
          // ignore focus error if element is unmounted
        }
      }
    };
  }, [isOpen, onClose, modalRef]);
}

/**
 * Helper to handle backdrop click (8.2)
 * Ensures clicks on the backdrop close the modal, but clicks inside modal content do not.
 */
export function handleBackdropClick(e, onClose) {
  if (e.target === e.currentTarget) {
    onClose?.();
  }
}
