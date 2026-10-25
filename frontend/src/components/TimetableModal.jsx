import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { api } from '../services/api';
import { normalizeTimetableData } from '../utils/timetable';
import AutoschedulerTimetableGrid from './AutoschedulerTimetableGrid';
import { AlertCircle, Calendar, RefreshCw, X } from 'lucide-react';
import { useModalAccessibility, handleBackdropClick } from '../utils/useModalAccessibility';

export default function TimetableModal({ isOpen, onClose, userProfile }) {
  const [timetableData, setTimetableData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const modalRef = useRef(null);

  useModalAccessibility({ isOpen, onClose, modalRef });

  useEffect(() => {
    if (isOpen) {
      loadTimetable();
    }
  }, [isOpen, userProfile?.branch, userProfile?.current_year]);

  async function loadTimetable() {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await api.getTimetable();
      setTimetableData(data);
    } catch (err) {
      console.error('Failed to load student timetable:', err);
      setErrorMessage(err.message || 'Unable to connect to academic timetable service. Please check connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }

  // Normalize API response into autoscheduler weekly matrix shape
  const normalized = useMemo(() => {
    if (!timetableData && !userProfile) return null;
    return normalizeTimetableData(timetableData, userProfile);
  }, [timetableData, userProfile]);

  function handlePrint() {
    window.print();
  }

  if (!isOpen) return null;

  const branch = normalized?.metadata?.branch || userProfile?.branch || 'CSE';
  const year = normalized?.metadata?.year || userProfile?.current_year || '3rd';
  const semester = normalized?.metadata?.semester || '5';
  const source = normalized?.metadata?.source || `timetable_${branch}_${year}yr_2026.md`;

  return (
    <div
      onClick={(e) => handleBackdropClick(e, onClose)}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <motion.div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="timetable-modal-title"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="bg-white rounded-2xl max-w-5xl xl:max-w-6xl w-full p-4 sm:p-6 shadow-2xl flex flex-col space-y-4 max-h-[92vh] overflow-y-auto border border-slate-200 outline-none"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shadow-xs">
              <Calendar className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="timetable-modal-title" className="font-headline-md text-base sm:text-lg text-slate-900 font-bold tracking-tight">
                  Timetable &amp; Academic Schedule
                </h3>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                  Autoscheduler Matrix
                </span>
              </div>
              <p className="font-body-sm text-xs text-slate-500 mt-0.5">
                {branch} Engineering • {year} Year • Semester {semester} • Source: <span className="font-mono text-[11px] text-slate-600">{source}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadTimetable}
              disabled={isLoading}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
              aria-label="Refresh timetable"
              title="Refresh timetable"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
              aria-label="Close timetable modal"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Loading, Error, Empty, or Timetable Matrix */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-semibold text-slate-600">
              Loading verified academic timetable for {branch} ({year} Year)...
            </p>
            <span className="text-[11px] text-slate-400">Loading schedule matrix from institutional repository</span>
          </div>
        ) : errorMessage ? (
          <div className="py-12 px-6 flex flex-col items-center justify-center text-center space-y-3 bg-rose-50/50 rounded-2xl border border-rose-200 my-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">Failed to Load Timetable</h4>
            <p className="text-xs text-rose-700 max-w-md">{errorMessage}</p>
            <button
              type="button"
              onClick={loadTimetable}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : !normalized || normalized.totalCourses === 0 ? (
          <div className="py-16 px-6 text-center space-y-3 bg-slate-50 rounded-2xl border border-slate-200">
            <Calendar className="w-10 h-10 text-slate-400 mx-auto" />
            <h4 className="text-sm font-bold text-slate-800">No Timetable Available</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No official classes are scheduled for {branch} {year} Year at this time.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <AutoschedulerTimetableGrid schedule={normalized} onPrint={handlePrint} />
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 hidden sm:inline-block">
            CampusMind AI Academic Timetable • Hyper-personalized for {userProfile?.student_id || 'Student'}
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
            >
              Print Schedule
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
