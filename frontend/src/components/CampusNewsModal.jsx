import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { API_BASE } from '../services/api';
import { useModalAccessibility, handleBackdropClick } from '../utils/useModalAccessibility';
import Icon from './Icon';

const NOTICES_DATA = [
  {
    id: 1,
    title: 'Google & Microsoft Off-Campus Internship & Capstone Placement Drive',
    category: 'Placements',
    date: 'Oct 03, 2026',
    isNew: true,
    issuer: 'Department of Training & Placements (T&P Cell)',
    refCode: 'TP/OFF/2026/104',
    summary: 'Registrations are now open for final & pre-final year students (6.5+ CGPA, 0 active backlogs). Super Dream CTC packages up to ₹42 LPA.',
    docRef: 'google_microsoft_placement_drive_2026.md',
    clauses: [
      'Eligible Batches: 3rd Year (Internship 2027) & 4th Year (Full-time FTE 2026)',
      'Eligible Branches: CSE, IT, ECE, EEE, MECH, CIVIL (Minimum 6.5+ CGPA, 0 active backlogs)',
      'Compensation Packages: Super Dream CTC ₹42.0 LPA (FTE) | ₹1.25 Lakh/month (Internship Stipend)',
      'Selection Process: Online Coding Round → Technical Interview I & II → HR Assessment',
      'Mandatory Action: Update resume on T&P Portal before October 10, 2026, 05:00 PM',
    ],
  },
  {
    id: 2,
    title: 'Mid-Term Examination Schedule & Hall Ticket Clearance Released',
    category: 'Exams',
    date: 'Oct 02, 2026',
    isNew: true,
    issuer: 'Office of the Controller of Examinations',
    refCode: 'COE/EXAM/2026/ODD-03',
    summary: 'Mid-term examinations for all engineering branches commence next week. Hall tickets available on institutional student portal.',
    docRef: 'exam_schedule_CSE_3rdyr_2026.md',
    clauses: [
      'Continuous Assessment Test 1 (CAT-1): October 10 to October 15, 2026 (09:30 AM – 11:30 AM)',
      'Continuous Assessment Test 2 (CAT-2): November 20 to November 25, 2026 (09:30 AM – 11:30 AM)',
      'Practical & Laboratory End-Semester Exams: December 01 to December 07, 2026',
      'Semester End Theory Examinations (FAT): December 12 to December 24, 2026 (10:00 AM – 01:00 PM)',
      'Mandatory Regulation: Minimum 75% attendance in theory & practical sessions strictly enforced for hall ticket clearance',
    ],
  },
  {
    id: 3,
    title: 'Hostel Gate Curfew Timings & Biometric Turnstile Verification',
    category: 'Hostel',
    date: 'Oct 01, 2026',
    isNew: false,
    issuer: 'Chief Warden & Student Welfare Council',
    refCode: 'HST/ADM/2026/088',
    summary: 'Hostel Block A & Block B gate curfew is strictly enforced at 10:00 PM. Night out passes must be approved by Wardens by 6:00 PM.',
    docRef: 'hostel_and_campus_rules.md',
    clauses: [
      'Hostel Gate Curfew: Strictly 10:00 PM sharp with mandatory biometric turnstile entry verification',
      'Night Out Passes: Digital requests must be submitted before 06:00 PM and approved by Hostel Wardens',
      'Silence Hours: 11:00 PM to 06:00 AM strictly observed in all residence corridors and common spaces',
      'Hostel Wi-Fi Update: Network core switch maintenance active; packet loss resolution tickets prioritized',
    ],
  },
  {
    id: 4,
    title: 'Annual Student Innovation & Project Expo - Cash Awards & Mentorship',
    category: 'Events',
    date: 'Sep 28, 2026',
    isNew: false,
    issuer: 'Dean of Student Affairs & AI Innovation Cell',
    refCode: 'UNI/2026/EVE-09',
    summary: 'Annual inter-college technology innovation and AI project exhibition. Submit project abstract and team proposals before Oct 15.',
    docRef: 'student_innovation_and_project_expo.md',
    clauses: [
      'Total Cash Prize Pool: ₹5,00,000 INR across national innovation tracks',
      'Track 1: AI Copilots & LLM Applications (1st Prize: ₹1,50,000)',
      'Track 2: Smart Campus & Automation Solutions (1st Prize: ₹1,00,000)',
      'Track 3: Hardware, Embedded & IoT Innovations (1st Prize: ₹1,00,000)',
      'Eligibility: Teams of 2 to 4 registered students; prototype abstract submission closes October 15, 2026',
    ],
  },
  {
    id: 5,
    title: 'Academic & Tuition Fee Clearance Window Notice',
    category: 'Fees',
    date: 'Sep 25, 2026',
    isNew: false,
    issuer: 'Registrar & Finance Division',
    refCode: 'FIN/FEE/2026/SEM-FALL',
    summary: 'Semester tuition fee, digital library subscriptions, and lab consumable dues must be cleared before exam hall ticket issuance.',
    docRef: 'academic_policies_and_attendance.md',
    clauses: [
      'Semester tuition fee and lab dues clearance required prior to examination hall ticket issuance',
      'Digital fee payment receipts downloadable instantly via institutional ERP student portal',
      'Fine waiver requests for documented financial hardship must be submitted to the Dean of Student Welfare',
    ],
  },
];

export default function CampusNewsModal({ isOpen, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState('All');
  const [expandedNoticeId, setExpandedNoticeId] = useState(null);
  const modalRef = useRef(null);

  useModalAccessibility({ isOpen, onClose, modalRef });

  if (!isOpen) return null;

  const tags = ['All', 'Placements', 'Exams', 'Hostel', 'Events', 'Fees'];

  const filteredNotices = NOTICES_DATA.filter((notice) => {
    const matchesTag = selectedTag === 'All' || notice.category === selectedTag;
    const matchesSearch =
      notice.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notice.summary.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTag && matchesSearch;
  });

  return (
    <div
      onClick={(e) => handleBackdropClick(e, onClose)}
      className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-space-md sm:p-space-lg"
    >
      <motion.div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="campus-news-modal-title"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="bg-surface-container-lowest rounded-2xl max-w-3xl w-full p-space-lg shadow-2xl flex flex-col space-y-space-md max-h-[90vh] overflow-y-auto border border-surface-container outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-space-xs border-b border-surface-container">
          <div className="flex items-center gap-space-sm">
            <div className="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center font-bold">
              <Icon name="campaign" className="text-[24px]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="campus-news-modal-title" className="font-headline-md text-headline-md text-on-surface font-semibold">
                  Official Campus Circulars
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-secondary text-on-secondary font-label-sm text-label-sm font-semibold">
                  Verified
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Direct deterministic notifications from Dean and Registrar Office
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close campus circulars modal"
            className="w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors cursor-pointer"
          >
            <Icon name="close" className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Tag Filter */}
        <div className="flex flex-col sm:flex-row gap-space-sm">
          <div className="relative flex-1">
            <Icon name="search" className="absolute left-3 top-2.5 text-on-surface-variant text-[20px]" />
            <input
              type="text"
              placeholder="Search circulars, placement drives, exams..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-10 pr-3 rounded-xl bg-surface-container-low text-on-surface font-body-md text-body-md border border-surface-container outline-none focus:border-primary placeholder:text-outline"
            />
          </div>
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTag(tag)}
                className={`px-3 py-1.5 rounded-lg font-label-md text-label-md whitespace-nowrap transition-all cursor-pointer ${
                  selectedTag === tag
                    ? 'bg-primary-container text-on-primary font-semibold shadow-xs'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Notices List */}
        <div className="space-y-space-sm overflow-y-auto flex-1">
          {filteredNotices.length === 0 ? (
            <div className="text-center py-12 text-on-surface-variant font-body-sm text-body-sm">
              No matching circulars found.
            </div>
          ) : (
            filteredNotices.map((n) => (
              <div
                key={n.id}
                className="p-space-md rounded-xl bg-surface-container-low border border-surface-container hover:border-primary-fixed transition-all flex flex-col gap-space-xs shadow-2xs"
              >
                <div className="flex items-start justify-between gap-space-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-surface-container text-primary font-label-sm text-label-sm font-semibold">
                      {n.category}
                    </span>
                    {n.isNew && (
                      <span className="px-2 py-0.5 rounded-full bg-tertiary-fixed text-tertiary font-label-sm text-label-sm font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"></span>
                        New
                      </span>
                    )}
                    <span className="font-code-sm text-code-sm text-on-surface-variant">{n.date}</span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => setExpandedNoticeId(expandedNoticeId === n.id ? null : n.id)}
                      className="text-on-surface-variant hover:text-primary font-label-sm text-label-sm font-semibold cursor-pointer flex items-center gap-1"
                    >
                      <span>{expandedNoticeId === n.id ? 'Hide Clauses' : 'Read Clauses'}</span>
                      <Icon name={expandedNoticeId === n.id ? 'expand_less' : 'expand_more'} className="text-[14px]" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        window.open(`${API_BASE}/documents/view/${encodeURIComponent(n.docRef)}`, '_blank')
                      }
                      className="flex items-center gap-1 text-primary hover:underline font-label-sm text-label-sm font-semibold cursor-pointer"
                      title="Open full printable institutional document"
                    >
                      <span>View Gazette</span>
                      <Icon name="open_in_new" className="text-[14px]" />
                    </button>
                  </div>
                </div>

                <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold leading-snug">
                  {n.title}
                </h4>
                <p className="font-body-sm text-body-sm text-on-surface-variant">{n.summary}</p>

                {expandedNoticeId === n.id && (
                  <div className="mt-2 pt-3 border-t border-surface-container flex flex-col gap-2 bg-surface-container-lowest p-3 rounded-lg">
                    <div className="flex flex-wrap items-center justify-between text-xs text-on-surface-variant border-b border-surface-container pb-1.5">
                      <span><strong>Issued By:</strong> {n.issuer}</span>
                      <span className="font-mono text-primary font-semibold">{n.refCode}</span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-on-surface mt-1">
                      {n.clauses?.map((c, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-secondary font-bold">•</span>
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={() =>
                          window.open(`${API_BASE}/documents/view/${encodeURIComponent(n.docRef)}`, '_blank')
                        }
                        className="px-3 py-1.5 bg-primary text-on-primary text-xs font-semibold rounded-lg hover:bg-primary-container flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span>Open Printable Gazette Window</span>
                        <Icon name="open_in_new" className="text-[14px]" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-space-xs border-t border-surface-container flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-space-md py-2 rounded-xl bg-surface-container text-on-surface hover:bg-surface-container-high font-label-md text-label-md cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
