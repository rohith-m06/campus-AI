import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../services/api';
import { useModalAccessibility, handleBackdropClick } from '../utils/useModalAccessibility';

export default function GrievancesModal({ isOpen, onClose, userProfile, onTicketCreated }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('tickets'); // 'tickets' or 'file'
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const modalRef = useRef(null);

  useModalAccessibility({ isOpen, onClose, modalRef });

  const [formData, setFormData] = useState({
    category: 'Wi-Fi & Campus IT Systems',
    title: '',
    description: '',
    location: userProfile?.hostel_status || 'Hostel Block B, Room 314',
    priority: 'Normal',
  });

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const data = await api.getMyTickets();
      setTickets(data || []);
    } catch (err) {
      console.error('Failed to load tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTickets();
      if (userProfile?.hostel_status) {
        setFormData((prev) => ({
          ...prev,
          location: userProfile.hostel_status,
        }));
      }
    }
    const handleTicketSubmitted = () => fetchTickets();
    window.addEventListener('ticket_submitted', handleTicketSubmitted);
    return () => {
      window.removeEventListener('ticket_submitted', handleTicketSubmitted);
    };
  }, [isOpen, userProfile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!formData.title.trim() || !formData.description.trim()) {
      setError('Please provide both a grievance title and a detailed description.');
      return;
    }

    setSubmitting(true);
    try {
      const newTicket = await api.createTicket({
        category: formData.category,
        title: formData.title.trim(),
        description: formData.description.trim(),
        location: formData.location.trim(),
        priority: formData.priority,
      });

      setSuccessMsg(`Ticket ${newTicket.ticket_number} logged successfully with 24-hr statutory SLA.`);
      setFormData({
        category: 'Wi-Fi & Campus IT Systems',
        title: '',
        description: '',
        location: userProfile?.hostel_status || 'Hostel Block B, Room 314',
        priority: 'Normal',
      });
      await fetchTickets();
      setActiveTab('tickets');
      if (onTicketCreated) onTicketCreated();
    } catch (err) {
      setError(err.message || 'Failed to submit grievance. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const unresolvedCount = tickets.filter(
    (t) => t.status && !['Resolved', 'Closed'].includes(t.status)
  ).length;

  return (
    <div
      onClick={(e) => handleBackdropClick(e, onClose)}
      className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-space-md sm:p-space-lg"
    >
      <motion.div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="grievance-modal-title"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="relative bg-surface-container-lowest rounded-2xl max-w-5xl w-full p-space-lg shadow-2xl flex flex-col space-y-space-md max-h-[90vh] overflow-y-auto border border-surface-container outline-none"
      >
        {/* Top Right Close Button for Section Component */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Grievance Portal"
          className="absolute top-4 right-4 z-20 w-9 h-9 rounded-xl bg-surface-container/70 hover:bg-surface-container text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer shadow-xs border border-surface-container"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        {/* Banner Section */}
        <div className="relative overflow-hidden rounded-xl bg-surface-container-low p-space-md sm:p-space-lg border border-surface-container pr-12">
          <div className="absolute -right-16 -top-16 w-72 h-72 rounded-full bg-gradient-to-br from-primary-fixed-dim/30 via-secondary-fixed/20 to-transparent blur-2xl pointer-events-none"></div>

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
            <div className="flex flex-col gap-space-xs max-w-xl">
              <div className="flex items-center gap-space-xs">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary font-semibold px-2 py-0.5 rounded-full bg-primary-fixed">
                  Statutory Portal
                </span>
                <span className="text-outline-variant">•</span>
                <span className="font-code-sm text-code-sm text-on-surface-variant">
                  UGC Redressal Compliance 2024
                </span>
              </div>
              <h1 id="grievance-modal-title" className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-semibold">
                Student Grievance Redressal Portal
              </h1>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Guaranteed under university SLA protocols. Every inquiry is cryptographically logged and routed to the Student Welfare Ombudsman.
              </p>
            </div>

            <div className="flex items-center gap-space-sm flex-wrap">
              <div className="flex items-center gap-space-sm bg-surface-container-lowest px-space-md py-space-xs rounded-xl shadow-2xs border border-surface-container">
                <div className="w-9 h-9 rounded-lg bg-tertiary-fixed flex items-center justify-center text-tertiary-container">
                  <span className="material-symbols-outlined text-[20px]">verified_user</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-headline-sm text-headline-sm text-on-surface">24h SLA</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">Mandatory Response</span>
                </div>
              </div>

              <div className="flex items-center gap-space-sm bg-surface-container-lowest px-space-md py-space-xs rounded-xl shadow-2xs border border-surface-container">
                <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[20px]">balance</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-headline-sm text-headline-sm text-on-surface">Ombudsman #4</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">Active Neutral Desk</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Controls Bar */}
          <div className="mt-space-md pt-space-sm flex flex-wrap items-center justify-between gap-space-md bg-surface-container-lowest/90 backdrop-blur rounded-xl p-space-xs border border-surface-container">
            <div className="flex items-center gap-2 p-1 bg-surface-container rounded-lg">
              <button
                type="button"
                onClick={() => setActiveTab('tickets')}
                className={`flex items-center gap-space-xs px-space-md py-1.5 rounded-md font-label-md text-label-md transition-all cursor-pointer ${
                  activeTab === 'tickets'
                    ? 'bg-surface-container-lowest text-primary font-semibold shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                <span>Active &amp; Past Tickets</span>
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary-fixed text-primary font-code-sm text-code-sm font-semibold">
                  {tickets.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('file')}
                className={`flex items-center gap-space-xs px-space-md py-1.5 rounded-md font-label-md text-label-md transition-all cursor-pointer ${
                  activeTab === 'file'
                    ? 'bg-surface-container-lowest text-primary font-semibold shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">add_task</span>
                <span>+ File New Grievance</span>
              </button>
            </div>

            <div className="flex items-center gap-space-sm text-on-surface-variant font-body-sm text-body-sm px-space-sm">
              <span className="w-2 h-2 rounded-full bg-tertiary-container animate-ping"></span>
              <span>
                Escalation Dispatcher: <strong className="text-on-surface">Online (SLA Active)</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="p-space-sm bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-body-sm text-body-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-space-sm bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-body-sm text-body-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>{successMsg}</span>
          </div>
        )}

        {/* TAB 1: TICKETS LIST */}
        {activeTab === 'tickets' ? (
          <div className="flex flex-col gap-space-md">
            {/* KPI Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
              <div className="bg-surface-container-low p-space-md rounded-xl border border-surface-container flex flex-col justify-between">
                <div className="flex items-center justify-between text-on-surface-variant">
                  <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold">
                    Unresolved Issues
                  </span>
                  <span className="material-symbols-outlined text-secondary text-[20px]">
                    pending_actions
                  </span>
                </div>
                <div className="mt-space-sm flex items-baseline gap-space-xs">
                  <span className="font-display-lg text-display-lg font-bold text-on-surface">
                    {unresolvedCount}
                  </span>
                  <span className="font-label-md text-label-md text-error">
                    {unresolvedCount > 0 ? 'Action In Progress' : 'All Clear'}
                  </span>
                </div>
                <div className="mt-space-xs w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-secondary-container h-full"
                    style={{
                      width: `${tickets.length > 0 ? (unresolvedCount / tickets.length) * 100 : 0}%`,
                    }}
                  ></div>
                </div>
              </div>

              <div className="bg-surface-container-low p-space-md rounded-xl border border-surface-container flex flex-col justify-between">
                <div className="flex items-center justify-between text-on-surface-variant">
                  <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold">
                    Total Petitions
                  </span>
                  <span className="material-symbols-outlined text-primary text-[20px]">history_edu</span>
                </div>
                <div className="mt-space-sm flex items-baseline gap-space-xs">
                  <span className="font-display-lg text-display-lg font-bold text-on-surface">
                    {tickets.length}
                  </span>
                  <span className="font-label-md text-label-md text-on-surface-variant">
                    Logged in System
                  </span>
                </div>
                <div className="mt-space-xs w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                  <div className="bg-primary h-full w-full"></div>
                </div>
              </div>

              <div className="bg-surface-container-low p-space-md rounded-xl border border-surface-container flex flex-col justify-between">
                <div className="flex items-center justify-between text-on-surface-variant">
                  <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold">
                    Resolved Term Avg
                  </span>
                  <span className="material-symbols-outlined text-tertiary-container text-[20px]">
                    task_alt
                  </span>
                </div>
                <div className="mt-space-sm flex items-baseline gap-space-xs">
                  <span className="font-display-lg text-display-lg font-bold text-tertiary-container">
                    94.8%
                  </span>
                  <span className="font-label-md text-label-md text-on-surface-variant">
                    Within SLA bounds
                  </span>
                </div>
                <div className="mt-space-xs w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                  <div className="bg-tertiary-container h-full w-11/12"></div>
                </div>
              </div>
            </div>

            {/* Registered Petitions */}
            <div className="flex flex-col gap-space-sm">
              <div className="flex items-center justify-between">
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                  Registered Institutional Petitions
                </h2>
                <span className="font-code-sm text-code-sm text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
                  Academic Year 2024-25
                </span>
              </div>

              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-[32px] text-primary animate-spin mb-2">
                    sync
                  </span>
                  <p className="font-body-sm text-body-sm">Loading grievance ledger...</p>
                </div>
              ) : tickets.length === 0 ? (
                <div className="p-space-lg text-center bg-surface-container-low rounded-xl border border-surface-container text-on-surface-variant">
                  <span className="material-symbols-outlined text-[36px] text-primary mb-2">
                    check_circle
                  </span>
                  <p className="font-headline-sm text-headline-sm text-on-surface font-medium">
                    No active grievances recorded.
                  </p>
                  <p className="font-body-sm text-body-sm mt-1">
                    Have an issue with hostel Wi-Fi, mess, or timetable? File a complaint above.
                  </p>
                </div>
              ) : (
                <div className="space-y-space-sm">
                  {tickets.map((t) => {
                    const isHigh = t.priority === 'High' || t.priority === 'Critical';
                    return (
                      <div
                        key={t.id || t.ticket_number}
                        className="bg-surface-container-low rounded-xl border border-surface-container p-space-md flex flex-col lg:flex-row gap-space-md relative overflow-hidden shadow-2xs hover:border-primary-fixed transition-all"
                      >
                        <div
                          className={`absolute top-0 left-0 bottom-0 w-1.5 ${
                            isHigh ? 'bg-secondary' : 'bg-primary-container'
                          }`}
                        ></div>

                        <div className="flex-1 flex flex-col justify-between gap-space-sm pl-2">
                          <div className="flex flex-col gap-space-xs">
                            <div className="flex flex-wrap items-center gap-space-xs">
                              <span className="font-code-sm text-code-sm font-semibold px-2 py-0.5 rounded bg-surface-container text-primary">
                                {t.ticket_number}
                              </span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full font-label-sm text-label-sm bg-surface-container-high text-on-surface">
                                <span className="material-symbols-outlined text-[14px] mr-1 text-primary">
                                  apartment
                                </span>
                                {t.category}
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
                                {t.status || 'In Progress'}
                              </span>
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full font-label-sm text-label-sm ${
                                  isHigh
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-surface-container text-on-surface-variant'
                                }`}
                              >
                                Priority: {t.priority || 'Medium'}
                              </span>
                            </div>

                            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold mt-1">
                              {t.title}
                            </h3>
                            <p className="font-body-sm text-body-sm text-on-surface-variant">
                              {t.description}
                            </p>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-xs p-space-xs px-space-sm rounded-lg bg-surface-container text-on-surface font-body-sm text-body-sm">
                            <div className="flex flex-col">
                              <span className="font-label-sm text-label-sm text-on-surface-variant">
                                Guaranteed SLA
                              </span>
                              <span className="font-label-md text-label-md font-semibold text-primary">
                                {t.estimated_sla || '24 Hours'}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="font-label-sm text-label-sm text-on-surface-variant">
                                Assigned Desk
                              </span>
                              <span className="font-label-md text-label-md font-semibold truncate">
                                {t.offline_option || 'IT & Maintenance Cell'}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="font-label-sm text-label-sm text-on-surface-variant">
                                Location Node
                              </span>
                              <span className="font-label-md text-label-md font-semibold truncate">
                                {t.location || 'Hostel Campus'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex lg:flex-col justify-end lg:justify-center items-stretch gap-space-xs min-w-[160px]">
                          <button
                            type="button"
                            onClick={() => alert(`Tracking Ticket ${t.ticket_number}\nStatus: ${t.status || 'In Progress'}\nTurnaround SLA: ${t.estimated_sla || '24h'}`)}
                            className="flex items-center justify-center gap-space-xs px-space-sm py-1.5 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md hover:bg-primary transition-all shadow-xs cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">timeline</span>
                            <span>Track Ticket</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* TAB 2: FILE NEW GRIEVANCE */
          <div className="flex flex-col lg:flex-row gap-space-lg">
            <div className="flex-1 bg-surface-container-low p-space-md sm:p-space-lg rounded-xl border border-surface-container flex flex-col gap-space-md">
              <div className="flex items-center justify-between pb-space-xs border-b border-surface-container">
                <div className="flex flex-col">
                  <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary font-semibold">
                    Formal Submission
                  </span>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    File Instant Grievance Form
                  </h2>
                </div>
                <span className="font-code-sm text-code-sm px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                  Encrypted Ticket Entry
                </span>
              </div>

              {/* Student Context Bar */}
              <div className="p-space-sm rounded-xl bg-surface-container flex flex-wrap items-center justify-between gap-space-sm">
                <div className="flex items-center gap-space-sm">
                  <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-label-md text-label-md font-semibold">
                    {userProfile?.full_name?.slice(0, 2).toUpperCase() || 'ST'}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-label-md text-label-md font-semibold text-on-surface">
                      {userProfile?.full_name || 'Student'}
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      Roll: {userProfile?.student_id || '24CSE101'} • {userProfile?.branch || 'CSE'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-space-xs text-on-surface-variant bg-surface-container-lowest px-space-sm py-1 rounded-lg text-xs">
                  <span className="material-symbols-outlined text-[16px] text-primary">apartment</span>
                  <span>Quarters: <strong>{userProfile?.hostel_status || 'Hostel Block B'}</strong></span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-space-md">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
                  {/* Category */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                      Redressal Category <span className="text-error">*</span>
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full h-10 px-3 bg-surface-container-lowest rounded-lg text-on-surface font-body-md text-body-md border border-surface-container outline-none focus:border-primary cursor-pointer"
                      required
                    >
                      <option value="Wi-Fi & Campus IT Systems">Wi-Fi &amp; Campus IT Systems</option>
                      <option value="Hostel Maintenance & Sanity">Hostel Maintenance &amp; Sanity</option>
                      <option value="Mess & Dietary Services">Mess &amp; Dietary Services</option>
                      <option value="Academic & Faculty Review">Academic &amp; Faculty Review</option>
                      <option value="Fees & Financial Clearing">Fees &amp; Financial Clearing</option>
                      <option value="Transport & Campus Logistics">Transport &amp; Campus Logistics</option>
                    </select>
                  </div>

                  {/* Location */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                      Specific Location / Room <span className="text-error">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="e.g. Block B, Room 314"
                      className="w-full h-10 px-3 bg-surface-container-lowest rounded-lg text-on-surface font-body-md text-body-md border border-surface-container outline-none focus:border-primary placeholder:text-outline"
                    />
                  </div>
                </div>

                {/* Grievance Title */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                    Grievance Title <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Concise summary of the grievance issue"
                    className="w-full h-10 px-3 bg-surface-container-lowest rounded-lg text-on-surface font-body-md text-body-md border border-surface-container outline-none focus:border-primary placeholder:text-outline"
                  />
                </div>

                {/* Detailed Incident Description */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                    Detailed Incident Description <span className="text-error">*</span>
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Provide complete facts, timings, dates, and previous verbal requests made..."
                    className="w-full p-3 bg-surface-container-lowest rounded-lg text-on-surface font-body-md text-body-md border border-surface-container outline-none focus:border-primary placeholder:text-outline resize-none"
                  ></textarea>
                </div>

                {/* Urgency Level Assessment */}
                <div className="flex flex-col gap-2">
                  <span className="font-label-sm text-label-sm font-semibold text-on-surface">
                    Urgency Level Assessment
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-xs">
                    {['Low', 'Normal', 'High', 'Critical'].map((level) => {
                      const isSelected = formData.priority === level;
                      return (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setFormData({ ...formData, priority: level })}
                          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-label-md text-label-md transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-primary-container text-on-primary font-semibold shadow-xs'
                              : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container border border-surface-container'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              level === 'Critical'
                                ? 'bg-error'
                                : level === 'High'
                                ? 'bg-secondary'
                                : level === 'Normal'
                                ? 'bg-primary'
                                : 'bg-outline'
                            }`}
                          ></span>
                          <span>{level}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-space-xs flex flex-col sm:flex-row items-center justify-between gap-space-md border-t border-surface-container">
                  <div className="flex items-center gap-space-xs text-on-surface-variant font-body-sm text-body-sm">
                    <span className="material-symbols-outlined text-[18px] text-tertiary-container shrink-0">
                      shield
                    </span>
                    <span>Direct cryptographic dispatch to Student Welfare Ombudsman.</span>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full sm:w-auto flex items-center justify-center gap-space-xs px-space-lg py-2.5 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-semibold hover:bg-primary-container transition-all shadow-md cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {submitting ? 'sync' : 'assignment_turned_in'}
                    </span>
                    <span>{submitting ? 'Dispatching...' : 'Submit Grievance to Administration'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Right Side Guide */}
            <div className="w-full lg:w-72 flex flex-col gap-space-md">
              <div className="bg-surface-container-low p-space-md rounded-xl border border-surface-container flex flex-col gap-space-xs">
                <div className="flex items-center gap-space-xs text-primary font-label-md text-label-md font-semibold">
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  <span>Statutory Protection</span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Under Section 7 of the University Redressal Charter, student petitioners are shielded from any academic or administrative reprisal.
                </p>
                <div className="p-space-xs rounded-lg bg-surface-container text-on-surface font-code-sm text-code-sm mt-1">
                  Identity Token: <strong>ANON-883-CAMPUS</strong>
                </div>
              </div>

              <div className="bg-surface-container-low p-space-md rounded-xl border border-surface-container flex flex-col gap-space-xs">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">
                  Response SLA Protocols
                </span>
                <ul className="space-y-space-xs font-body-sm text-body-sm text-on-surface-variant">
                  <li className="flex items-start gap-space-xs">
                    <span className="material-symbols-outlined text-primary text-[16px] shrink-0 mt-0.5">
                      timer
                    </span>
                    <span><strong>Critical:</strong> On-ground review within 120 minutes.</span>
                  </li>
                  <li className="flex items-start gap-space-xs">
                    <span className="material-symbols-outlined text-primary text-[16px] shrink-0 mt-0.5">
                      timer
                    </span>
                    <span><strong>Wi-Fi &amp; Infrastructure:</strong> Diagnostic within 4 hours.</span>
                  </li>
                  <li className="flex items-start gap-space-xs">
                    <span className="material-symbols-outlined text-primary text-[16px] shrink-0 mt-0.5">
                      timer
                    </span>
                    <span><strong>Academic:</strong> 7 working days with review board.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-space-xs border-t border-surface-container">
          <button
            type="button"
            onClick={onClose}
            className="px-space-md py-2 rounded-xl bg-surface-container text-on-surface hover:bg-surface-container-high font-label-md text-label-md cursor-pointer transition-colors"
          >
            Close Portal
          </button>
        </div>
      </motion.div>
    </div>
  );
}
