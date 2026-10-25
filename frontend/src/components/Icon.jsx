import React from 'react';
import {
  PanelLeft,
  Plus,
  Brain,
  CheckSquare,
  AlertTriangle,
  Calendar,
  Headphones,
  Megaphone,
  Trash2,
  Languages,
  Menu,
  GraduationCap,
  Bell,
  Award,
  Mail,
  CalendarDays,
  CalendarRange,
  ArrowRight,
  LogOut,
  MessageSquare,
  CheckCheck,
  Copy,
  CheckCircle,
  ExternalLink,
  Info,
  Mic,
  ArrowUp,
  X,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Scale,
  Receipt,
  ListPlus,
  BookOpen,
  Lock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Search,
  Send,
  SlidersHorizontal,
  ThumbsUp,
  ThumbsDown,
  Share2,
  HelpCircle,
  FileText,
  User,
  UserCheck,
  CalendarX,
  Printer,
  Clock,
  Sparkles,
  Download,
  Filter,
  Check,
  IdCard,
  Building,
  FileCheck,
  Shield,
  Activity,
  WifiOff,
  Loader2
} from 'lucide-react';

const ICON_MAP = {
  // Navigation & Layout
  dock_to_left: PanelLeft,
  menu: Menu,
  logout: LogOut,
  close: X,
  add: Plus,

  // Academic & Persona
  school: GraduationCap,
  neurology: Brain,
  fact_check: CheckSquare,
  badge: Award,
  calendar_today: Calendar,
  calendar_month: CalendarDays,
  calendar_view_week: CalendarRange,
  schedule: Clock,
  history_edu: BookOpen,
  user: User,
  account_circle: User,
  how_to_reg: UserCheck,
  event_busy: CalendarX,
  id_card: IdCard,

  // Communication & Grievances
  support_agent: Headphones,
  campaign: Megaphone,
  translate: Languages,
  notifications: Bell,
  forum: MessageSquare,
  mail: Mail,
  balance: Scale,
  receipt_long: Receipt,
  add_task: ListPlus,

  // Feedback & Status
  verified: CheckCircle,
  verified_user: ShieldCheck,
  check_circle: CheckCircle2,
  done: Check,
  done_all: CheckCheck,
  check: Check,
  warning: AlertTriangle,
  error: AlertCircle,
  info: Info,
  lock: Lock,
  refresh: RefreshCw,
  sync: RefreshCw,
  wifi_off: WifiOff,
  progress_activity: Loader2,

  // Actions & Inputs
  content_copy: Copy,
  open_in_new: ExternalLink,
  delete: Trash2,
  delete_forever: Trash2,
  mic: Mic,
  arrow_upward: ArrowUp,
  arrow_forward: ArrowRight,
  chevron_down: ChevronDown,
  chevron_up: ChevronUp,
  chevron_right: ChevronRight,
  expand_less: ChevronUp,
  expand_more: ChevronDown,
  search: Search,
  send: Send,
  tune: SlidersHorizontal,
  sparkles: Sparkles,
  download: Download,
  filter: Filter,
  file_text: FileText,
  building: Building,
  file_check: FileCheck,
  print: Printer,
  thumb_up: ThumbsUp,
  thumb_down: ThumbsDown,
  share: Share2,
  help: HelpCircle,
  shield: Shield,
  pending_actions: Clock,
  task_alt: CheckCircle2,
  assignment_turned_in: CheckSquare,
  timer: Clock,
  timeline: Activity,
  apartment: Building,
};

export default function Icon({ name, className = "", size, ...props }) {
  if (!name) return null;
  const normalizedKey = name.toString().trim().toLowerCase().replace(/[\s-]+/g, '_');
  const Component = ICON_MAP[normalizedKey] || Sparkles;

  // Extract explicit pixel size from classes like text-[18px] or text-[20px]
  let computedSize = size;
  if (!computedSize && className) {
    const match = className.match(/text-\[(\d+)px\]/);
    if (match) {
      computedSize = parseInt(match[1], 10);
    }
  }

  // Ensure default dimensions if neither size nor w- is given
  const hasWidth = /\bw-\d+|\bw-\[/.test(className);
  const defaultDim = !hasWidth && !computedSize ? 'w-5 h-5' : '';

  return (
    <Component
      className={`inline-block shrink-0 ${defaultDim} ${className}`}
      size={computedSize}
      {...props}
    />
  );
}
