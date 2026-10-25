/**
 * Focused test suite for frontend timetable normalization and autoscheduler matrix mapping.
 * Run with: node src/utils/timetable.test.js
 */

import {
  normalizeDay,
  parseTimeSlot,
  detectSessionType,
  mapSessionToSlots,
  normalizeSession,
  normalizeTimetableData,
  DAYS,
} from './timetable.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
}

console.log('--- 1. Testing Day Name Normalization ---');
assert(normalizeDay('Monday') === 'MON', 'Monday -> MON');
assert(normalizeDay('tuesday') === 'TUE', 'tuesday -> TUE');
assert(normalizeDay('WED') === 'WED', 'WED -> WED');
assert(normalizeDay('Thursday') === 'THU', 'Thursday -> THU');
assert(normalizeDay('friday') === 'FRI', 'friday -> FRI');
assert(normalizeDay('1') === 'MON', '1 -> MON');
assert(normalizeDay('5') === 'FRI', '5 -> FRI');
assert(normalizeDay(null) === 'MON', 'null fallback -> MON');
assert(normalizeDay('Unknown') === 'MON', 'unknown fallback -> MON');
console.log('✅ Day name normalization passed.');

console.log('\n--- 2. Testing Time Slot Parsing ---');
const t1 = parseTimeSlot('09:00 AM - 10:00 AM');
assert(t1.startTime === '09:00 AM', 't1 start time');
assert(t1.endTime === '10:00 AM', 't1 end time');
assert(!t1.isLab, 't1 is not lab');

const t2 = parseTimeSlot('01:15 PM - 04:15 PM (Lab)');
assert(t2.startTime === '01:15 PM', 't2 start time');
assert(t2.endTime === '04:15 PM', 't2 end time');
assert(t2.isLab, 't2 is marked lab');

const t3 = parseTimeSlot('08:30 - 09:30 AM');
assert(t3.startTime === '08:30', 't3 start time');
assert(t3.endTime === '09:30 AM', 't3 end time');

const t4 = parseTimeSlot(null);
assert(t4.startTime === '', 'null time parsed safely');
console.log('✅ Time slot parsing passed.');

console.log('\n--- 3. Testing Theory / Lab Discrimination ---');
assert(detectSessionType({ courseCode: 'CSE301', title: 'Operating Systems' }) === 'theory', 'CSE301 -> theory');
assert(detectSessionType({ courseCode: 'CSL301', title: 'DBMS Lab' }) === 'lab', 'CSL301 -> lab');
assert(detectSessionType({ courseCode: 'ECL101', title: 'Electronics Practical' }) === 'lab', 'ECL101 -> lab');
assert(detectSessionType({ courseCode: 'CSE304', time: '01:15 PM - 04:15 PM (Lab)' }) === 'lab', '(Lab) tag -> lab');
assert(detectSessionType({ courseCode: 'ME101', title: 'Workshop Practice Lab' }) === 'lab', 'Workshop Lab in title -> lab');
console.log('✅ Theory / Lab discrimination passed.');

console.log('\n--- 4. Testing Slot Mapping into Autoscheduler 8-Slot Matrix ---');
const slotMapTheory = mapSessionToSlots({ startTime: '09:00 AM', type: 'theory' });
assert(slotMapTheory.slotId === 1, '09:00 AM -> Slot 1');

const slotMapTheory3 = mapSessionToSlots({ startTime: '11:15 AM', type: 'theory' });
assert(slotMapTheory3.slotId === 3, '11:15 AM -> Slot 3');

const slotMapAfternoonLab = mapSessionToSlots({ startTime: '01:15 PM', type: 'lab' });
assert(slotMapAfternoonLab.slotId === 5, '01:15 PM lab -> Slot 5');
assert(slotMapAfternoonLab.blockId === 3, '01:15 PM lab -> Block 3');
assert(slotMapAfternoonLab.spansBlocks.includes(3) && slotMapAfternoonLab.spansBlocks.includes(4), 'Afternoon lab spans blocks 3 & 4');
console.log('✅ Slot mapping passed.');

console.log('\n--- 5. Testing Missing Field Handling (Room, Faculty, Credits) ---');
const normMissing = normalizeSession({
  courseCode: 'CSE999',
  courseTitle: 'Independent Study',
  // faculty missing
  // room missing
  // credits missing
});
assert(normMissing.faculty === '—', 'Missing faculty displayed as em dash');
assert(normMissing.room === '—', 'Missing room displayed as em dash');
assert(typeof normMissing.credits === 'number', 'Credits given reasonable default');
console.log('✅ Missing field handling passed.');

console.log('\n--- 6. Testing Full Timetable Normalization (Theory & Lab) ---');
const sampleBackendResponse = {
  branch: 'CSE',
  year: '3rd',
  semester: '5',
  source: 'timetable_CSE_3rdyr_2026.md',
  days: {
    MON: [
      {
        courseCode: 'CSE301',
        courseTitle: 'Database Management Systems',
        category: 'Program Core',
        type: 'theory',
        day: 'MON',
        startTime: '09:00 AM',
        endTime: '10:00 AM',
        time: '09:00 AM - 10:00 AM',
        slot: 'A1',
        slotId: 1,
        faculty: 'Dr. V. Ramanathan',
        room: 'CS Block 2 - Room 301',
        credits: 3.0,
      },
      {
        courseCode: 'CSL301',
        courseTitle: 'DBMS & SQL Lab',
        category: 'Practical / Lab',
        type: 'lab',
        day: 'MON',
        startTime: '01:15 PM',
        endTime: '04:15 PM',
        time: '01:15 PM - 04:15 PM (Lab)',
        slot: 'L29+L30',
        slotId: 5,
        faculty: 'Dr. V. Ramanathan',
        room: 'Database Lab 2',
        credits: 2.0,
      },
    ],
    TUE: [],
    WED: [],
    THU: [],
    FRI: [],
  },
  summary: [
    {
      courseCode: 'CSE301',
      courseTitle: 'Database Management Systems',
      category: 'Program Core',
      type: 'theory',
      faculty: 'Dr. V. Ramanathan',
      room: 'CS Block 2 - Room 301',
      credits: 3.0,
    },
    {
      courseCode: 'CSL301',
      courseTitle: 'DBMS & SQL Lab',
      category: 'Practical / Lab',
      type: 'lab',
      faculty: 'Dr. V. Ramanathan',
      room: 'Database Lab 2',
      credits: 2.0,
    },
  ],
};

const fullNormalized = normalizeTimetableData(sampleBackendResponse);
assert(fullNormalized.metadata.branch === 'CSE', 'Metadata branch');
assert(fullNormalized.metadata.year === '3rd', 'Metadata year');
assert(fullNormalized.theoryMap['MON_1'] !== undefined, 'MON_1 theory cell present');
assert(fullNormalized.theoryMap['MON_1'].courseCode === 'CSE301', 'MON_1 courseCode');
assert(fullNormalized.labMap['MON_3'] !== undefined, 'MON_3 lab cell present');
assert(fullNormalized.labMap['MON_3'].courseCode === 'CSL301', 'MON_3 courseCode');
assert(fullNormalized.totalCourses === 2, 'Total courses count');
assert(fullNormalized.totalCredits === 5.0, 'Total credits sum');
console.log('✅ Full timetable normalization with theory and lab passed.');

console.log('\n--- 7. Testing Empty / Graceful Fallback Handling ---');
const emptyNormalized = normalizeTimetableData({});
assert(emptyNormalized.metadata.branch === 'CSE', 'Empty fallback branch');
assert(emptyNormalized.metadata.year === '3rd', 'Empty fallback year');
assert(Array.isArray(emptyNormalized.days) && emptyNormalized.days.length === 5, 'Days array preserved');
assert(emptyNormalized.totalCourses === 0, 'Zero courses for completely empty input');
console.log('✅ Empty / graceful fallback handling passed.');

console.log('\n==========================================');
console.log(' ALL FRONTEND TIMETABLE TESTS PASSED!');
console.log('==========================================');
