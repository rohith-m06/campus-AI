import React, { useState } from 'react';
import { BookOpen, Printer, Sparkles } from 'lucide-react';

// Consistent pastel color palette for courses (matches autoscheduler-v2)
const COURSE_PALETTE = [
  { bg: '#e0f2fe', pill: 'bg-sky-200 text-sky-900', border: 'border-sky-300' },
  { bg: '#dcfce7', pill: 'bg-emerald-200 text-emerald-900', border: 'border-emerald-300' },
  { bg: '#ede9fe', pill: 'bg-purple-200 text-purple-900', border: 'border-purple-300' },
  { bg: '#ffedd5', pill: 'bg-orange-200 text-orange-900', border: 'border-orange-300' },
  { bg: '#ffe4e6', pill: 'bg-rose-200 text-rose-900', border: 'border-rose-300' },
  { bg: '#ccfbf1', pill: 'bg-teal-200 text-teal-900', border: 'border-teal-300' },
  { bg: '#fef3c7', pill: 'bg-amber-200 text-amber-900', border: 'border-amber-300' },
  { bg: '#fce7f3', pill: 'bg-pink-200 text-pink-900', border: 'border-pink-300' },
  { bg: '#e0e7ff', pill: 'bg-indigo-200 text-indigo-900', border: 'border-indigo-300' },
  { bg: '#f1f5f9', pill: 'bg-slate-200 text-slate-900', border: 'border-slate-300' },
  { bg: '#fef9c3', pill: 'bg-yellow-200 text-yellow-900', border: 'border-yellow-300' },
  { bg: '#cffafe', pill: 'bg-cyan-200 text-cyan-900', border: 'border-cyan-300' },
];

function getCourseColor(courseCode) {
  if (!courseCode) return { bg: '#ffffff', pill: 'bg-slate-100 text-slate-700' };
  let hash = 0;
  for (let i = 0; i < courseCode.length; i++) {
    hash = (hash << 5) - hash + courseCode.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % COURSE_PALETTE.length;
  return COURSE_PALETTE[idx];
}

/**
 * Display-only timetable component bringing the autoscheduler-v2 visual matrix into CampusMind.
 * Receives normalized timetable data through props.
 */
export default function AutoschedulerTimetableGrid({ schedule, onPrint }) {
  const [selectedMobileDay, setSelectedMobileDay] = useState('ALL');

  if (!schedule) return null;

  const {
    metadata = {},
    days = ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    timeSlots = [],
    theoryMap = {},
    labMap = {},
    daySessions = {},
    coursesSummary = [],
    totalCredits = 0,
    totalCourses = 0,
  } = schedule;

  const visibleDays = selectedMobileDay === 'ALL' ? days : [selectedMobileDay];

  return (
    <div className="space-y-4">
      {/* 1. Header Banner matching autoscheduler-v2 */}
      <div className="rounded-2xl overflow-hidden shadow-sm border border-slate-200 bg-white">
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 px-4 py-3 text-white flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/20 text-white backdrop-blur-sm">
                {metadata.branch || 'CampusMind'} • {metadata.year || '3rd'} Year
              </span>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white/10 text-blue-100">
                Semester {metadata.semester || '5'}
              </span>
              <h2 className="text-base font-extrabold tracking-tight">Academic Timetable Matrix</h2>
            </div>
            <p className="text-[11px] text-blue-100 mt-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Verified conflict-free weekly schedule • Source: {metadata.source || 'Institutional Knowledge Base'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 backdrop-blur-sm">
              COURSES: <span className="font-bold text-white">{totalCourses}</span>
            </div>
            <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 backdrop-blur-sm">
              CREDITS: <span className="font-bold text-white">{totalCredits.toFixed(1)}</span>
            </div>
            {onPrint && (
              <button
                type="button"
                onClick={onPrint}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-medium text-xs transition-colors cursor-pointer"
                title="Print timetable"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile View Filter Tabs (shown on small viewports for ease of use) */}
        <div className="sm:hidden px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-1 overflow-x-auto">
          <span className="text-[11px] font-semibold text-slate-500 mr-1">View:</span>
          <button
            type="button"
            onClick={() => setSelectedMobileDay('ALL')}
            className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${
              selectedMobileDay === 'ALL' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            All Days
          </button>
          {days.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setSelectedMobileDay(d)}
              className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${
                selectedMobileDay === d ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        {/* 2. Timetable Matrix Grid (Autoscheduler layout) */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs min-w-[760px]">
            <thead>
              {/* Row 1: Session Groups & Vertical Lunch */}
              <tr className="bg-[#0a3d7a] text-white border-b border-blue-900">
                <th rowSpan={2} className="p-2 border border-blue-800 text-center text-xs font-black w-14">
                  DAY
                </th>
                <th rowSpan={2} className="p-2 border border-blue-800 text-center text-[11px] font-bold w-14">
                  TYPE
                </th>
                <th colSpan={4} className="p-1.5 border border-blue-800 text-center font-bold tracking-wide">
                  MORNING SESSIONS
                </th>
                <th
                  rowSpan={2}
                  className="p-1 border border-blue-800 bg-[#94a3b8] text-slate-900 font-extrabold text-[10px] [writing-mode:vertical-rl] rotate-180 tracking-widest text-center w-8 select-none"
                >
                  LUNCH
                </th>
                <th colSpan={4} className="p-1.5 border border-blue-800 text-center font-bold tracking-wide">
                  AFTERNOON SESSIONS
                </th>
              </tr>
              {/* Row 2: 8 Time Slot Columns */}
              <tr className="bg-[#0d4a94] text-slate-200 text-[10px] border-b border-blue-800">
                {timeSlots.map((ts, i) => (
                  <th key={i} className="p-1.5 border border-blue-900 text-center w-28 font-medium">
                    {ts}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleDays.map((day) => (
                <React.Fragment key={day}>
                  {/* Theory Row */}
                  <tr className="border-t border-slate-300">
                    <td
                      rowSpan={2}
                      className="bg-slate-200 font-black text-slate-800 text-xs text-center border border-slate-300 w-14 align-middle"
                    >
                      {day}
                    </td>
                    <td className="bg-blue-50 font-bold text-blue-900 text-[10px] text-center border border-slate-300 align-middle">
                      Theory
                    </td>

                    {/* Morning Theory Slots 1..4 */}
                    {[1, 2, 3, 4].map((s) => {
                      const cell = theoryMap[`${day}_${s}`];
                      const color = cell ? getCourseColor(cell.courseCode) : null;
                      return (
                        <td
                          key={s}
                          className="border border-slate-300 p-1 text-center h-12 align-middle transition-colors"
                          style={{ backgroundColor: color ? color.bg : '#ffffff' }}
                        >
                          {cell ? (
                            <div className="flex flex-col items-center justify-center space-y-0.5">
                              <span
                                className={`inline-block font-extrabold text-[9px] px-1.5 py-0.2 rounded ${
                                  color?.pill || 'bg-blue-200 text-blue-900'
                                }`}
                              >
                                {cell.slot || `T${s}`}
                              </span>
                              <div className="font-black text-[11px] text-slate-900 leading-tight">
                                {cell.courseCode}
                              </div>
                              <div className="text-[9px] text-slate-600 truncate max-w-[110px] font-medium" title={cell.courseTitle}>
                                {cell.courseTitle}
                              </div>
                              {cell.faculty && cell.faculty !== '—' && (
                                <div className="text-[8.5px] text-slate-500 truncate max-w-[110px]" title={cell.faculty}>
                                  {cell.faculty}
                                </div>
                              )}
                              {cell.room && cell.room !== '—' && (
                                <div className="text-[8px] text-slate-400 truncate max-w-[110px]" title={cell.room}>
                                  {cell.room}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-300 select-none">Free</span>
                          )}
                        </td>
                      );
                    })}

                    {/* Vertical LUNCH Divider */}
                    <td
                      rowSpan={2}
                      className="bg-slate-300 text-slate-600 font-black text-[10px] tracking-widest text-center border border-slate-300 select-none align-middle"
                    >
                      LUNCH
                    </td>

                    {/* Afternoon Theory Slots 5..8 */}
                    {[5, 6, 7, 8].map((s) => {
                      const cell = theoryMap[`${day}_${s}`];
                      const color = cell ? getCourseColor(cell.courseCode) : null;
                      return (
                        <td
                          key={s}
                          className="border border-slate-300 p-1 text-center h-12 align-middle transition-colors"
                          style={{ backgroundColor: color ? color.bg : '#ffffff' }}
                        >
                          {cell ? (
                            <div className="flex flex-col items-center justify-center space-y-0.5">
                              <span
                                className={`inline-block font-extrabold text-[9px] px-1.5 py-0.2 rounded ${
                                  color?.pill || 'bg-blue-200 text-blue-900'
                                }`}
                              >
                                {cell.slot || `T${s}`}
                              </span>
                              <div className="font-black text-[11px] text-slate-900 leading-tight">
                                {cell.courseCode}
                              </div>
                              <div className="text-[9px] text-slate-600 truncate max-w-[110px] font-medium" title={cell.courseTitle}>
                                {cell.courseTitle}
                              </div>
                              {cell.faculty && cell.faculty !== '—' && (
                                <div className="text-[8.5px] text-slate-500 truncate max-w-[110px]" title={cell.faculty}>
                                  {cell.faculty}
                                </div>
                              )}
                              {cell.room && cell.room !== '—' && (
                                <div className="text-[8px] text-slate-400 truncate max-w-[110px]" title={cell.room}>
                                  {cell.room}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-300 select-none">Free</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Lab Row */}
                  <tr className="bg-amber-50/40">
                    <td className="bg-slate-100 font-bold text-slate-600 text-[10px] text-center border border-slate-300 h-9 align-middle">
                      Lab
                    </td>

                    {/* Morning Lab Blocks 1 & 2 (each spans 2 slots) */}
                    {[1, 2].map((b) => {
                      const cell = labMap[`${day}_${b}`];
                      const color = cell ? getCourseColor(cell.courseCode) : null;
                      return (
                        <td
                          key={b}
                          colSpan={2}
                          className="border border-slate-300 p-1 text-center h-9 align-middle transition-colors"
                          style={{ backgroundColor: color ? color.bg : '#ffffff' }}
                        >
                          {cell ? (
                            <div className="flex flex-col items-center justify-center">
                              <div className="flex items-center gap-1.5">
                                <span className="font-extrabold text-[9px] px-1.5 py-0.2 rounded bg-amber-200 text-amber-900">
                                  {cell.slot || `L${b}`}
                                </span>
                                <span className="font-bold text-[10px] text-slate-900">
                                  {cell.courseCode} Lab
                                </span>
                              </div>
                              <div className="text-[9px] text-slate-600 truncate max-w-[180px] font-medium" title={cell.courseTitle}>
                                {cell.courseTitle}
                              </div>
                              {cell.faculty && cell.faculty !== '—' && (
                                <div className="text-[8.5px] text-slate-500 truncate max-w-[180px]" title={cell.faculty}>
                                  {cell.faculty}
                                </div>
                              )}
                              {cell.room && cell.room !== '—' && (
                                <div className="text-[8px] text-slate-400 truncate max-w-[180px]" title={cell.room}>
                                  {cell.room}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-300 select-none">Free</span>
                          )}
                        </td>
                      );
                    })}

                    {/* Afternoon Lab Blocks 3 & 4 (check if both same session to merge or render 2 blocks) */}
                    {(() => {
                      const cell3 = labMap[`${day}_3`];
                      const cell4 = labMap[`${day}_4`];
                      const isSameMergedLab = cell3 && cell4 && cell3.courseCode === cell4.courseCode;

                      if (isSameMergedLab) {
                        const color = getCourseColor(cell3.courseCode);
                        return (
                          <td
                            colSpan={4}
                            className="border border-slate-300 p-1.5 text-center h-9 align-middle transition-colors"
                            style={{ backgroundColor: color ? color.bg : '#ffffff' }}
                          >
                            <div className="flex flex-col items-center justify-center">
                              <div className="flex items-center gap-1.5">
                                <span className="font-extrabold text-[9px] px-1.5 py-0.2 rounded bg-amber-200 text-amber-900">
                                  {cell3.slot || 'L-Afternoon'}
                                </span>
                                <span className="font-bold text-[10px] text-slate-900">
                                  {cell3.courseCode} Practical Lab
                                </span>
                                <span className="text-[9px] text-amber-800 font-semibold bg-amber-100 px-1.5 rounded">
                                  {cell3.time || 'Afternoon Session'}
                                </span>
                              </div>
                              <div className="text-[9px] text-slate-600 truncate max-w-[360px] font-medium" title={cell3.courseTitle}>
                                {cell3.courseTitle}
                              </div>
                              <div className="flex items-center gap-2 text-[8.5px] text-slate-500 mt-0.5">
                                {cell3.faculty && cell3.faculty !== '—' && <span>{cell3.faculty}</span>}
                                {cell3.room && cell3.room !== '—' && <span>• {cell3.room}</span>}
                              </div>
                            </div>
                          </td>
                        );
                      }

                      // Render standard separate blocks 3 & 4
                      return [3, 4].map((b) => {
                        const cell = labMap[`${day}_${b}`];
                        const color = cell ? getCourseColor(cell.courseCode) : null;
                        return (
                          <td
                            key={b}
                            colSpan={2}
                            className="border border-slate-300 p-1 text-center h-9 align-middle transition-colors"
                            style={{ backgroundColor: color ? color.bg : '#ffffff' }}
                          >
                            {cell ? (
                              <div className="flex flex-col items-center justify-center">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-extrabold text-[9px] px-1.5 py-0.2 rounded bg-amber-200 text-amber-900">
                                    {cell.slot || `L${b}`}
                                  </span>
                                  <span className="font-bold text-[10px] text-slate-900">
                                    {cell.courseCode} Lab
                                  </span>
                                </div>
                                <div className="text-[9px] text-slate-600 truncate max-w-[180px] font-medium" title={cell.courseTitle}>
                                  {cell.courseTitle}
                                </div>
                                {cell.faculty && cell.faculty !== '—' && (
                                  <div className="text-[8.5px] text-slate-500 truncate max-w-[180px]" title={cell.faculty}>
                                    {cell.faculty}
                                  </div>
                                )}
                                {cell.room && cell.room !== '—' && (
                                  <div className="text-[8px] text-slate-400 truncate max-w-[180px]" title={cell.room}>
                                    {cell.room}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-300 select-none">Free</span>
                            )}
                          </td>
                        );
                      });
                    })()}
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Course Registration & Faculty Allocation Summary Table (matching autoscheduler-v2) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
            <BookOpen className="w-4 h-4 text-blue-600" />
            Course Registration &amp; Faculty Allocation Summary
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {coursesSummary.length} Courses Allocated • Total Credits: {totalCredits.toFixed(1)}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[650px]">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                <th className="py-2.5 px-3">Course Code</th>
                <th className="py-2.5 px-3">Course Title</th>
                <th className="py-2.5 px-3">Type / Category</th>
                <th className="py-2.5 px-3">Faculty</th>
                <th className="py-2.5 px-3">Room / Venue</th>
                <th className="py-2.5 px-3 text-center">Credits</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {coursesSummary.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400 font-medium">
                    No course registration data available.
                  </td>
                </tr>
              ) : (
                coursesSummary.map((sec, idx) => (
                  <tr key={sec.courseCode || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="py-2 px-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                    <td className="py-2 px-3 font-black text-slate-900">{sec.courseCode}</td>
                    <td className="py-2 px-3 font-semibold text-slate-800">{sec.courseTitle}</td>
                    <td className="py-2 px-3 text-slate-600">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                          sec.type === 'lab'
                            ? 'bg-amber-100 text-amber-900 border border-amber-200'
                            : 'bg-blue-100 text-blue-900 border border-blue-200'
                        }`}
                      >
                        {sec.category || (sec.type === 'lab' ? 'Lab' : 'Core')}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-700">{sec.faculty || '—'}</td>
                    <td className="py-2 px-3 text-slate-600">{sec.room || '—'}</td>
                    <td className="py-2 px-3 text-center font-extrabold text-slate-900">
                      {typeof sec.credits === 'number' ? sec.credits.toFixed(1) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
