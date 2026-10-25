import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import Icon from './Icon';

export default function InteractiveTicketCard({
  category = 'Hostel Maintenance',
  initialTitle = '',
  initialDescription = '',
  userProfile = {},
  onOpenGrievances,
  onSuccess,
}) {
  const [ticketCategory, setTicketCategory] = useState(category);
  const [title, setTitle] = useState(initialTitle || '');
  const [description, setDescription] = useState(initialDescription || '');
  const [submitting, setSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState(null);
  const [error, setError] = useState('');
  const [isResolved, setIsResolved] = useState(false);
  const [isEscalated, setIsEscalated] = useState(false);

  useEffect(() => {
    if (initialTitle) setTitle(initialTitle);
    if (initialDescription) setDescription(initialDescription);
    if (category) setTicketCategory(category);
  }, [initialTitle, initialDescription, category]);

  const handleEscalate = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await api.createTicket({
        category: ticketCategory,
        title: title || 'Urgent Grievance Escalation',
        description: description || 'Priority escalation requested via active copilot conversation.',
        location: userProfile?.hostel_status || 'Hostel Campus',
        priority: 'Critical',
      });
      setSubmittedTicket(res);
      setIsEscalated(true);
      window.dispatchEvent(new CustomEvent('ticket_submitted'));
      if (onSuccess) onSuccess(res);
    } catch (err) {
      setError(err.message || 'Failed to dispatch ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = () => {
    setIsResolved(true);
  };

  if (isResolved) {
    return (
      <div className="rounded-xl bg-surface-container p-space-sm border border-surface-container-high opacity-60 flex items-center justify-between">
        <span className="font-label-md text-label-md text-on-surface flex items-center gap-1.5">
          <Icon name="check_circle" className="w-4 h-4 text-tertiary-container" />
          Grievance inquiry marked as resolved by student.
        </span>
        <button
          type="button"
          onClick={() => setIsResolved(false)}
          className="text-primary font-label-sm text-label-sm hover:underline cursor-pointer"
        >
          Undo
        </button>
      </div>
    );
  }

  if (submittedTicket || isEscalated) {
    return (
      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-space-md flex flex-col gap-space-xs text-emerald-900 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-headline-sm text-headline-sm font-semibold">
            <Icon name="verified" className="w-5 h-5 text-emerald-700" />
            <span>Ticket Escalated: {submittedTicket?.ticket_number || '#HSTL-DISPATCH'}</span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800 font-code-sm text-code-sm font-semibold">
            SLA: 24 Hours
          </span>
        </div>
        <p className="font-body-sm text-body-sm text-emerald-800">
          Your ticket has been dispatched to <strong>Dean of Infrastructure &amp; IT Cell</strong>.
          Turnaround SLA is strictly monitored.
        </p>
        <div className="flex justify-end pt-space-xs">
          <button
            type="button"
            onClick={onOpenGrievances}
            className="text-emerald-800 hover:text-emerald-950 font-label-md text-label-md font-semibold underline flex items-center gap-1 cursor-pointer"
          >
            <span>View in Grievance Redressal Portal</span>
            <Icon name="open_in_new" className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-surface-container-low p-space-md sm:p-space-lg flex flex-col space-y-space-md border border-surface-container shadow-xs">
      <div className="flex items-center justify-between pb-space-xs border-b border-surface-container">
        <div className="flex items-center gap-space-xs">
          <div className="w-8 h-8 rounded-lg bg-secondary-fixed flex items-center justify-center text-secondary">
            <Icon name="support_agent" className="w-4 h-4 text-secondary" />
          </div>
          <div>
            <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Instant Grievance Filing
            </h4>
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              Direct Ombudsman Routing • 24h Mandatory SLA
            </span>
          </div>
        </div>
        <span className="font-code-sm text-code-sm px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-medium">
          Priority Channel
        </span>
      </div>

      {error && (
        <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-body-sm font-body-sm flex items-center gap-2">
          <Icon name="error" className="w-4 h-4 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Form Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
        <div className="flex flex-col gap-1">
          <label className="font-label-sm text-label-sm font-medium text-on-surface-variant">
            Grievance Category
          </label>
          <select
            value={ticketCategory}
            onChange={(e) => setTicketCategory(e.target.value)}
            className="w-full bg-surface-container-lowest text-on-surface font-body-sm text-body-sm rounded-lg px-3 py-2 outline-none border border-surface-container focus:border-secondary transition-colors"
          >
            <option value="Academic Grievance">Academic Grievance</option>
            <option value="Hostel Maintenance">Hostel Maintenance</option>
            <option value="Mess & Dining Food">Mess & Dining Food</option>
            <option value="Fee & Accounts Cell">Fee & Accounts Cell</option>
            <option value="Library Services">Library Services</option>
            <option value="Campus Infrastructure">Campus Infrastructure</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-label-sm text-label-sm font-medium text-on-surface-variant">
            Issue Title / Subject
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Professor attendance discrepancy / Wi-Fi outage"
            className="w-full bg-surface-container-lowest text-on-surface font-body-sm text-body-sm rounded-lg px-3 py-2 outline-none border border-surface-container focus:border-secondary transition-colors"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="font-label-sm text-label-sm font-medium text-on-surface-variant">
          Detailed Description & Urgency
        </label>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Briefly state your concern, affected course/faculty or room location..."
          className="w-full bg-surface-container-lowest text-on-surface font-body-sm text-body-sm rounded-lg px-3 py-2 outline-none border border-surface-container focus:border-secondary transition-colors resize-none"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-space-sm pt-space-xs">
        <div className="flex items-center gap-space-sm">
          <button
            type="button"
            disabled={submitting}
            onClick={handleEscalate}
            className="px-space-md py-2 rounded-lg bg-secondary text-on-secondary hover:brightness-105 font-label-md text-label-md font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            <Icon name={submitting ? 'sync' : 'send'} className={`w-4 h-4 ${submitting ? 'animate-spin' : ''}`} />
            <span>{submitting ? 'Submitting...' : 'Submit Grievance Now'}</span>
          </button>

          <button
            type="button"
            onClick={handleResolve}
            className="px-space-md py-2 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container font-label-md text-label-md font-medium transition-colors shadow-2xs border border-surface-container cursor-pointer"
          >
            Dismiss
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenGrievances}
          className="text-primary hover:underline font-label-md text-label-md flex items-center gap-1 cursor-pointer"
        >
          <span>Open Grievances Portal</span>
          <Icon name="arrow_forward" className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
