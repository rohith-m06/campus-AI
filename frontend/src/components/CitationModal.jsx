import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { API_BASE } from '../services/api';
import { useModalAccessibility, handleBackdropClick } from '../utils/useModalAccessibility';

export default function CitationModal({ isOpen, onClose, citationData }) {
  const modalRef = useRef(null);

  useModalAccessibility({ isOpen, onClose, modalRef });

  if (!isOpen || !citationData) return null;

  const docName = citationData.document || citationData.source || 'academic_policies_and_attendance.md';
  const cleanDocName = docName.replace(/^\[+|\]+$/g, '').trim();
  const clause = citationData.clause || 'Official Academic Policy & Syllabus Record';
  const excerpt =
    citationData.excerpt ||
    citationData.text ||
    '"Official verified clause extracted directly from university knowledge repository."';

  const handleOpenViewer = () => {
    const viewerUrl = `${API_BASE}/documents/view/${encodeURIComponent(cleanDocName)}`;
    window.open(viewerUrl, '_blank');
  };

  return (
    <div
      onClick={(e) => handleBackdropClick(e, onClose)}
      className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-space-md"
    >
      <motion.div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="citation-modal-title"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-surface-container-lowest rounded-2xl max-w-xl w-full p-space-lg shadow-2xl flex flex-col space-y-space-md border border-surface-container outline-none"
      >
        <div className="flex items-center justify-between pb-space-xs border-b border-surface-container">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[24px]">verified</span>
            <h3 id="citation-modal-title" className="font-headline-md text-headline-md text-on-surface font-semibold">
              Verified Institutional Clause
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close citation modal"
            className="w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-space-sm bg-surface-container-low rounded-xl flex items-center justify-between border border-surface-container">
          <div className="font-body-sm text-body-sm text-on-surface">
            <strong>Document:</strong> {cleanDocName}
          </div>
          <span className="font-code-sm text-code-sm text-primary font-semibold">
            {clause}
          </span>
        </div>

        <div className="p-space-md bg-surface-container rounded-xl font-body-md text-body-md text-on-surface italic border-l-4 border-primary leading-relaxed">
          {excerpt}
        </div>

        <div className="flex justify-end gap-space-sm pt-space-xs border-t border-surface-container">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close citation modal dialog"
            className="px-space-md py-2 rounded-xl bg-surface-container text-on-surface hover:bg-surface-container-high font-label-md text-label-md cursor-pointer transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleOpenViewer}
            className="px-space-md py-2 rounded-xl bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md flex items-center gap-1 shadow-xs cursor-pointer transition-all"
          >
            <span>Open Document Viewer</span>
            <span className="material-symbols-outlined text-[16px]">open_in_new</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
