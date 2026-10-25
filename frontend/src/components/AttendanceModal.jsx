import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { api } from '../services/api';
import Icon from './Icon';
import { useModalAccessibility, handleBackdropClick } from '../utils/useModalAccessibility';

export default function AttendanceModal({ isOpen, onClose, userProfile }) {
  const [attendanceData, setAttendanceData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const modalRef = useRef(null);

  useModalAccessibility({ isOpen, onClose, modalRef });

  useEffect(() => {
    if (isOpen) {
      loadAttendance();
    }
  }, [isOpen, userProfile]);

  async function loadAttendance() {
    setIsLoading(true);
    try {
      const data = await api.getAttendance();
      if (data) {
        setAttendanceData(data);
      }
    } catch (err) {
      console.error('Failed to load attendance:', err);
    } finally {
      setIsLoading(false);
    }
  }

  if (!isOpen) return null;

  const classwise = attendanceData?.subject_records || [];
  const totalAttended =
    attendanceData?.overall_attended || classwise.reduce((acc, c) => acc + (c.attended || 0), 0);
  const totalConducted =
    attendanceData?.overall_conducted ||
    classwise.reduce((acc, c) => acc + (c.total_conducted || c.total || 0), 0);
  const overallPercentage = parseFloat(
    attendanceData?.overall_percentage ||
      (totalConducted > 0 ? ((totalAttended / totalConducted) * 100).toFixed(1) : '83.2')
  );

  const absences = Math.max(0, totalConducted - totalAttended);
  const isOverallSafe = overallPercentage >= 75.0;

  return (
    <div
      onClick={(e) => handleBackdropClick(e, onClose)}
      className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-space-md sm:p-space-lg"
    >
      <motion.div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="attendance-modal-title"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="bg-surface-container-lowest rounded-2xl max-w-4xl w-full p-space-lg shadow-2xl flex flex-col space-y-space-md max-h-[90vh] overflow-y-auto border border-surface-container outline-none"
      >
        {/* Top Header & Identity Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md pb-space-sm border-b border-surface-container">
          <div className="flex items-center gap-space-md">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-primary-container text-on-primary flex items-center justify-center font-headline-md text-headline-md font-semibold shadow-xs">
                {userProfile?.full_name
                  ? userProfile.full_name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()
                  : 'ST'}
              </div>
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-tertiary-fixed-dim flex items-center justify-center">
                <span className="w-2 h-2 rounded-full bg-tertiary"></span>
              </span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-space-xs">
                <span id="attendance-modal-title" className="font-headline-md text-headline-md text-on-surface font-semibold">
                  {userProfile?.full_name || 'Student Attendance'}
                </span>
                <span className="font-code-sm text-code-sm px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-medium">
                  {userProfile?.student_id || '24CSE101'}
                </span>
              </div>
              <span className="font-label-md text-label-md text-on-surface-variant">
                {userProfile?.branch || 'CSE'} • {userProfile?.current_year || '1st'} Year • Demo-Generated Student Context
              </span>
            </div>
          </div>

          <div className="flex items-center gap-space-sm">
            <button
              onClick={onClose}
              aria-label="Close attendance modal"
              className="w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors cursor-pointer"
            >
              <Icon name="close" className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 3 Balanced Academic Metric Cards (No Aggregate & No Bunk Simulator) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-gutter">
          {/* Card 1: Total Classes Conducted */}
          <div className="p-space-md rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">
                  Total Conducted
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="font-display-lg text-display-lg font-bold text-on-surface">
                    {totalConducted}
                  </span>
                  <span className="font-label-md text-label-md text-on-surface-variant font-medium">Hours</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                <Icon name="calendar_view_week" className="w-5 h-5 text-primary" />
              </div>
            </div>
            <div className="mt-space-md pt-space-xs font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary"></span>
              <span>Across {classwise.length} Academic Courses</span>
            </div>
          </div>

          {/* Card 2: Total Classes Attended */}
          <div className="p-space-md rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">
                  Total Attended
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="font-display-lg text-display-lg font-bold text-emerald-700">
                    {totalAttended}
                  </span>
                  <span className="font-label-md text-label-md text-on-surface-variant font-medium">Hours</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Icon name="how_to_reg" className="w-5 h-5 text-emerald-700" />
              </div>
            </div>
            <div className="mt-space-md pt-space-xs font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              <span>Verified In-Person &amp; Lab Sessions</span>
            </div>
          </div>

          {/* Card 3: Absences Recorded */}
          <div className="p-space-md rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">
                  Absences Recorded
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="font-display-lg text-display-lg font-bold text-slate-700">{absences}</span>
                  <span className="font-label-md text-label-md text-on-surface-variant font-medium">Hours</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                <Icon name="event_busy" className="w-5 h-5 text-slate-700" />
              </div>
            </div>
            <div className="mt-space-md pt-space-xs flex items-center justify-between font-body-sm text-body-sm">
              <span className="text-on-surface-variant">Medical Waiver: <strong className="text-on-surface">2 Approved</strong></span>
              <span className="px-2 py-0.5 rounded bg-surface-container font-label-sm text-label-sm text-primary">
                Synced
              </span>
            </div>
          </div>
        </div>

        {/* Subject-Wise Attendance Detail Roster */}
        <div className="flex flex-col gap-space-sm pt-space-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs">
            <div>
              <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Course Attendance Roster
              </span>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Course-wise attendance breakdown and minimum eligibility criteria
              </p>
            </div>
            <div className="flex items-center gap-space-sm text-label-sm font-label-sm">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                <span className="text-on-surface-variant font-medium">Eligible (≥75%)</span>
              </div>
              <div className="flex items-center gap-1.5 ml-2">
                <span className="w-2.5 h-2.5 rounded-full bg-error"></span>
                <span className="text-on-surface-variant font-medium">Needs Attention (&lt;75%)</span>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-on-surface-variant">
              <Icon name="sync" className="w-8 h-8 text-primary animate-spin mb-2" />
              <p className="font-body-sm text-body-sm">Loading student attendance summary...</p>
            </div>
          ) : classwise.length === 0 ? (
            <div className="text-center py-8 font-body-sm text-body-sm text-on-surface-variant">
              No course attendance records registered yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
              {classwise.map((course, idx) => {
                const attended = course.attended || 0;
                const total = course.total_conducted || course.total || 0;
                const percentage = parseFloat(
                  course.percentage || (total > 0 ? ((attended / total) * 100).toFixed(1) : '0')
                );
                const neededClasses =
                  percentage < 75.0 ? Math.ceil((0.75 * total - attended) / 0.25) : 0;

                const isSafe = percentage >= 75.0;

                return (
                  <div
                    key={course.course_code || idx}
                    className="p-space-md rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col justify-between hover:border-primary-container transition-all shadow-2xs"
                  >
                    <div className="space-y-space-sm">
                      <div className="flex items-start justify-between gap-2">
                        <span className="px-2 py-0.5 rounded bg-surface-container font-code-sm text-code-sm text-primary font-bold">
                          {course.course_code || `SUB${idx + 1}`}
                        </span>
                        <span
                          className={`font-headline-sm text-headline-sm font-bold ${
                            isSafe ? 'text-emerald-700' : 'text-error'
                          }`}
                        >
                          {percentage}%
                        </span>
                      </div>

                      <div>
                        <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold leading-snug">
                          {course.course_name || course.title || 'Course Title'}
                        </h3>
                        <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                          {attended} of {total} Classes Attended
                        </p>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isSafe ? 'bg-emerald-600' : 'bg-error'}`}
                          style={{ width: `${Math.min(100, percentage)}%` }}
                        ></div>
                      </div>

                      {/* Positive Status Pill */}
                      {isSafe ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 font-label-sm text-label-sm border border-emerald-200">
                          <Icon name="check_circle" className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Eligible for Examinations</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-800 font-label-sm text-label-sm border border-rose-200">
                          <Icon name="error" className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>
                            Must attend next: <strong>{neededClasses} consecutive classes</strong> to reach 75%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-space-sm pt-space-xs border-t border-surface-container">
          <button
            type="button"
            onClick={onClose}
            className="px-space-md py-2 rounded-xl bg-surface-container text-on-surface hover:bg-surface-container-high font-label-md text-label-md cursor-pointer transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-space-md py-2 rounded-xl bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
          >
            <Icon name="print" className="w-4 h-4" />
            <span>Print Attendance Summary</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
