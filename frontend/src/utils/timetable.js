/**
 * CampusMind AI - Timetable Normalization Helper
 * Safely parses, maps, and normalizes timetable entries from backend API
 * or fallback sources into the autoscheduler weekly matrix presentation shape.
 */

export const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI'];

export const STANDARD_TIME_SLOTS = [
  '09:00 - 10:00',
  '10:00 - 11:00',
  '11:15 - 12:15',
  '12:15 - 01:15',
  '01:15 - 02:15',
  '02:15 - 03:15',
  '03:15 - 04:15',
  '04:15 - 05:15',
];

/**
 * Normalizes day name to standard 3-letter uppercase MON/TUE/WED/THU/FRI.
 */
export function normalizeDay(dayInput) {
  if (!dayInput) return 'MON';
  const s = String(dayInput).trim().toUpperCase();

  if (s.startsWith('MON')) return 'MON';
  if (s.startsWith('TUE')) return 'TUE';
  if (s.startsWith('WED')) return 'WED';
  if (s.startsWith('THU')) return 'THU';
  if (s.startsWith('FRI')) return 'FRI';

  // Support numeric index (1=Mon ... 5=Fri)
  if (s === '1') return 'MON';
  if (s === '2') return 'TUE';
  if (s === '3') return 'WED';
  if (s === '4') return 'THU';
  if (s === '5') return 'FRI';

  return 'MON';
}

/**
 * Parses time string safely into components.
 */
export function parseTimeSlot(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') {
    return { startTime: '', endTime: '', raw: '', isLab: false };
  }

  const raw = timeStr.trim();
  const isLab = /\(lab\)/i.test(raw);
  const cleanTime = raw.replace(/\(lab\)/gi, '').trim();

  let startTime = '';
  let endTime = '';

  if (cleanTime.includes('-')) {
    const parts = cleanTime.split('-').map((p) => p.trim());
    startTime = parts[0] || '';
    endTime = parts[1] || '';
  } else {
    startTime = cleanTime;
  }

  return { startTime, endTime, raw, isLab };
}

/**
 * Distinguishes whether a session is theory or lab.
 */
export function detectSessionType(session) {
  if (!session) return 'theory';
  if (session.type === 'lab') return 'lab';
  if (session.type === 'theory') return 'theory';

  const timeStr = session.time || session.timeSlot || '';
  if (/\(lab\)/i.test(timeStr)) return 'lab';

  const code = (session.courseCode || session.code || '').trim().toUpperCase();
  const title = (session.courseTitle || session.title || '').trim().toLowerCase();

  // Standard lab prefixes and keywords
  const labPrefixes = ['CSL', 'ECL', 'MEL', 'EEL', 'CVL', 'ITL', 'CHL', 'PHL', 'MED', 'EED'];
  if (labPrefixes.some((p) => code.startsWith(p))) return 'lab';
  if (title.includes('lab') || title.includes('practical') || title.includes('workshop')) return 'lab';

  return 'theory';
}

/**
 * Resolves session to its grid position (slotId 1..8 for theory, blockId 1..4 for lab).
 */
export function mapSessionToSlots(session, indexInDay = 0) {
  const type = detectSessionType(session);

  // If slotId is already explicitly provided
  if (typeof session.slotId === 'number' && session.slotId >= 1 && session.slotId <= 8) {
    if (type === 'lab') {
      const blockId = Math.ceil(session.slotId / 2);
      return { type, slotId: session.slotId, blockId, spansBlocks: [blockId] };
    }
    return { type, slotId: session.slotId, blockId: Math.ceil(session.slotId / 2) };
  }

  const timeStr = session.startTime || session.time || session.timeSlot || '';
  const parsed = parseTimeSlot(timeStr);
  const start = (parsed.startTime || '').toUpperCase();

  let slotId = 1;
  let blockId = 1;
  let spansBlocks = [1];

  if (start.includes('09:00') || start.includes('08:30') || start.includes('08:00')) {
    slotId = 1;
    blockId = 1;
    spansBlocks = [1];
  } else if (start.includes('10:00') || start.includes('09:45')) {
    slotId = 2;
    blockId = 1;
    spansBlocks = [1];
  } else if (start.includes('11:15') || start.includes('11:30') || start.includes('11:00')) {
    slotId = 3;
    blockId = 2;
    spansBlocks = [2];
  } else if (start.includes('12:15') || start.includes('12:30') || start.includes('12:00')) {
    slotId = 4;
    blockId = 2;
    spansBlocks = [2];
  } else if (start.includes('01:15') || start.includes('01:00') || start.includes('13:15') || start.includes('13:45') || start.includes('02:00') || start.includes('14:00')) {
    slotId = 5;
    blockId = 3;
    // Afternoon lab sessions commonly span blocks 3 & 4 (3 hours: 1:15 PM - 4:15 PM)
    spansBlocks = type === 'lab' ? [3, 4] : [3];
  } else if (start.includes('02:15') || start.includes('14:15') || start.includes('02:30')) {
    slotId = 6;
    blockId = 3;
    spansBlocks = [3];
  } else if (start.includes('03:15') || start.includes('15:15') || start.includes('03:30')) {
    slotId = 7;
    blockId = 4;
    spansBlocks = [4];
  } else if (start.includes('04:15') || start.includes('16:15')) {
    slotId = 8;
    blockId = 4;
    spansBlocks = [4];
  } else {
    // Controlled fallback mapping based on sequence index
    if (type === 'lab') {
      slotId = 5;
      blockId = 3;
      spansBlocks = [3, 4];
    } else {
      slotId = Math.min(8, Math.max(1, indexInDay + 1));
      blockId = Math.ceil(slotId / 2);
      spansBlocks = [blockId];
    }
  }

  return { type, slotId, blockId, spansBlocks };
}

/**
 * Normalizes raw session object with explicit defaults and safety guards.
 */
export function normalizeSession(raw, day = 'MON', index = 0) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const courseCode = String(raw.courseCode || raw.code || 'SUBJ101').replace(/\*/g, '').trim();
  const courseTitle = String(raw.courseTitle || raw.title || 'Course Lecture').replace(/\*/g, '').trim();
  const type = detectSessionType(raw);
  const { startTime, endTime, raw: timeRaw } = parseTimeSlot(raw.time || raw.timeSlot || raw.startTime || '');

  // Missing values handled explicitly
  const faculty = raw.faculty ? String(raw.faculty).trim() : '—';
  const room = raw.room ? String(raw.room).trim() : '—';
  const category = raw.category ? String(raw.category).trim() : (type === 'lab' ? 'Practical / Lab' : 'Program Core');

  let credits = null;
  if (typeof raw.credits === 'number' && !isNaN(raw.credits)) {
    credits = raw.credits;
  } else if (courseCode.startsWith('PRJ')) {
    credits = 6.0;
  } else if (type === 'lab') {
    credits = 2.0;
  } else {
    credits = 3.0;
  }

  const { slotId, blockId, spansBlocks } = mapSessionToSlots({ ...raw, type, startTime }, index);

  // Default slot label if missing
  let slot = raw.slot || '';
  if (!slot) {
    if (type === 'theory') {
      const defaultTheorySlots = ['A1', 'F1', 'D1', 'TC1', 'A2', 'F2', 'D2', 'TC2'];
      slot = defaultTheorySlots[slotId - 1] || `T${slotId}`;
    } else {
      const defaultLabSlots = ['L1+L2', 'L5+L6', 'L29+L30', 'L33+L34'];
      slot = defaultLabSlots[blockId - 1] || `L${blockId}`;
    }
  }

  return {
    courseCode,
    courseTitle,
    category,
    type,
    day,
    startTime: startTime || '—',
    endTime: endTime || '—',
    time: timeRaw || '—',
    slot,
    slotId,
    blockId,
    spansBlocks,
    faculty,
    room,
    credits,
  };
}

/**
 * Converts backend timetable response or legacy data into normalized shape
 * for AutoschedulerTimetableGrid.
 */
export function normalizeTimetableData(input, userProfile = {}) {
  const branch = input?.branch || userProfile?.branch || 'CSE';
  const rawYear = input?.year || userProfile?.current_year || '3rd';
  const cleanYear = String(rawYear).includes('1')
    ? '1st'
    : String(rawYear).includes('2')
    ? '2nd'
    : String(rawYear).includes('4')
    ? '4th'
    : '3rd';

  const semester = input?.semester || (cleanYear === '1st' ? '1' : cleanYear === '2nd' ? '3' : cleanYear === '4th' ? '7' : '5');
  const batch = input?.batch || userProfile?.batch || '2023-2027';
  const source = input?.source || `timetable_${branch}_${cleanYear}yr_2026.md`;

  const theoryMap = {};
  const labMap = {};
  const daySessions = {
    MON: [],
    TUE: [],
    WED: [],
    THU: [],
    FRI: [],
  };

  const rawDays = input?.days || input || {};

  // Extract sessions by day
  DAYS.forEach((d) => {
    let dayList = [];
    if (Array.isArray(rawDays[d])) {
      dayList = rawDays[d];
    } else {
      // Check full day name e.g. Monday, Tuesday...
      const fullName = {
        MON: 'Monday',
        TUE: 'Tuesday',
        WED: 'Wednesday',
        THU: 'Thursday',
        FRI: 'Friday',
      }[d];
      if (Array.isArray(rawDays[fullName])) {
        dayList = rawDays[fullName];
      }
    }

    dayList.forEach((rawItem, idx) => {
      const norm = normalizeSession(rawItem, d, idx);
      if (!norm) return;

      daySessions[d].push(norm);

      if (norm.type === 'theory') {
        theoryMap[`${d}_${norm.slotId}`] = norm;
      } else {
        // Lab maps to blocks (1..4)
        if (Array.isArray(norm.spansBlocks) && norm.spansBlocks.length > 0) {
          norm.spansBlocks.forEach((bId) => {
            labMap[`${d}_${bId}`] = norm;
          });
        } else {
          labMap[`${d}_${norm.blockId}`] = norm;
        }
      }
    });
  });

  // Extract unique courses for summary
  const summaryMap = new Map();

  // If backend provided summary, prioritize that with normalization
  if (Array.isArray(input?.summary) && input.summary.length > 0) {
    input.summary.forEach((c) => {
      if (c && c.courseCode) {
        summaryMap.set(c.courseCode, {
          courseCode: String(c.courseCode).replace(/\*/g, '').trim(),
          courseTitle: String(c.courseTitle || '—').replace(/\*/g, '').trim(),
          category: c.category || (c.type === 'lab' ? 'Practical / Lab' : 'Program Core'),
          type: c.type || (c.category?.toLowerCase().includes('lab') ? 'lab' : 'theory'),
          faculty: c.faculty || '—',
          room: c.room || '—',
          credits: typeof c.credits === 'number' ? c.credits : null,
        });
      }
    });
  }

  // Also collect from day sessions to make sure all scheduled courses are accounted for
  DAYS.forEach((d) => {
    daySessions[d].forEach((s) => {
      if (!summaryMap.has(s.courseCode)) {
        summaryMap.set(s.courseCode, {
          courseCode: s.courseCode,
          courseTitle: s.courseTitle,
          category: s.category,
          type: s.type,
          faculty: s.faculty,
          room: s.room,
          credits: s.credits,
        });
      }
    });
  });

  const coursesSummary = Array.from(summaryMap.values());
  const totalCredits = coursesSummary.reduce((acc, c) => acc + (typeof c.credits === 'number' ? c.credits : 0), 0);
  const totalCourses = coursesSummary.length;

  return {
    metadata: {
      branch,
      year: cleanYear,
      semester,
      batch,
      source,
    },
    days: DAYS,
    timeSlots: STANDARD_TIME_SLOTS,
    theoryMap,
    labMap,
    daySessions,
    coursesSummary,
    totalCredits,
    totalCourses,
  };
}
