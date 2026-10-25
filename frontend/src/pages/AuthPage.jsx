import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import BrandLogo from '../components/BrandLogo';
import {
  ShieldCheck,
  Languages,
  Database,
  FileText,
  Lock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react';

export default function AuthPage() {
  const navigate = useNavigate();
  const { setAuth, isAuthenticated } = useAuthStore();

  const [activeTab, setActiveTab] = useState('signin'); // 'signin' or 'signup'
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null); // { type: 'success'|'error'|'info', text: string }

  // Sign In state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Sign Up state (9 profile fields)
  const [signupForm, setSignupForm] = useState({
    full_name: '',
    email: '',
    password: '',
    student_id: '',
    branch: '',
    current_year: '',
    batch: '',
    hostel_status: '',
    phone_number: '',
  });

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Demo accounts configuration (active when DEMO_MODE=true)
  const isDemoMode = (import.meta.env.VITE_DEMO_MODE ?? import.meta.env.DEMO_MODE ?? 'true').toString().toLowerCase() !== 'false';

  const demoAccounts = [
    {
      name: 'Arjun Sharma',
      email: 'arjun.sharma@campus.edu',
      roll: '24CSE101',
      branch: 'CSE',
      year: '2nd',
      batch: '2024-2028',
      hostel: 'Hostel Block B (Room 304)',
      phone: '+91 98765 43210',
    },
    {
      name: 'Priya Patel',
      email: 'priya.patel@campus.edu',
      roll: '23ECE044',
      branch: 'ECE',
      year: '3rd',
      batch: '2023-2027',
      hostel: 'Hostel Block A (Room 112)',
      phone: '+91 98765 12345',
    },
    {
      name: 'Rahul Verma',
      email: 'rahul.verma@campus.edu',
      roll: '22MECH012',
      branch: 'MECH',
      year: '4th',
      batch: '2022-2026',
      hostel: 'Day Scholar',
      phone: '+91 98111 22334',
    },
  ];

  // 1-Click Instant Login for Demo Profiles
  const handleQuickLogin = async (profile) => {
    setActiveTab('signin');
    if (!isDemoMode) {
      setStatusMessage({
        type: 'error',
        text: 'Demo 1-click login is disabled in non-demo mode. Please sign in with your credentials.',
      });
      return;
    }
    setIsLoading(true);
    setStatusMessage({
      type: 'info',
      text: `Connecting verified node for ${profile.name} (${profile.roll})...`,
    });

    try {
      // Set form fields for clarity
      setLoginEmail(profile.email);
      setLoginPassword('Campus@123');

      // Attempt login with default demo password
      const res = await api.login({
        email: profile.email,
        password: 'Campus@123',
      });
      setAuth(res.access_token, res.user);
      setStatusMessage({
        type: 'success',
        text: `Neural handshake confirmed. Welcome, ${res.user.full_name}!`,
      });
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 400);
    } catch (err) {
      console.error('Demo authentication error:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Authentication error. Please sign in manually with password Campus@123.',
      });
      setIsLoading(false);
    }
  };

  // Sign In handler
  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setStatusMessage({ type: 'error', text: 'Please enter both your university email and password.' });
      return;
    }

    setIsLoading(true);
    setStatusMessage({ type: 'info', text: 'Authenticating institutional credentials...' });

    try {
      const res = await api.login({
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword.trim(),
      });
      setAuth(res.access_token, res.user);
      setStatusMessage({
        type: 'success',
        text: `Welcome back, ${res.user.full_name}! Loading copilot workspace...`,
      });
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 500);
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Incorrect university email or password. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Sign Up handler (9 fields)
  const handleSignUp = async (e) => {
    e.preventDefault();
    const { full_name, email, password, student_id, branch, current_year, batch, hostel_status, phone_number } = signupForm;

    if (!full_name || !email || !password || !student_id || !branch || !current_year || !batch || !hostel_status) {
      setStatusMessage({ type: 'error', text: 'Please fill in all mandatory institutional fields.' });
      return;
    }

    setIsLoading(true);
    setStatusMessage({ type: 'info', text: 'Grounding university vectors and student persona...' });

    try {
      const normalizedYear = current_year.includes('1')
        ? '1st'
        : current_year.includes('2')
        ? '2nd'
        : current_year.includes('3')
        ? '3rd'
        : current_year.includes('4')
        ? '4th'
        : '1st';

      const res = await api.register({
        full_name: full_name.trim(),
        email: email.trim().toLowerCase(),
        password: password.trim(),
        student_id: student_id.trim().toUpperCase(),
        branch: branch.trim().toUpperCase(),
        current_year: normalizedYear,
        batch: batch.trim(),
        hostel_status: hostel_status.trim(),
        phone_number: phone_number ? phone_number.trim() : null,
      });

      setAuth(res.access_token, res.user);
      setStatusMessage({
        type: 'success',
        text: `Student agent registered successfully! Welcome, ${res.user.full_name}!`,
      });
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 500);
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Registration failed. Student ID or email may already be in use.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-background flex flex-col items-center justify-center p-space-md sm:p-space-lg">
      <div className="w-full max-w-7xl mx-auto py-space-md lg:py-space-xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-lg items-start">
          {/* Left Column: Strategic Branding, Academic Verification & Instant Access */}
          <section className="lg:col-span-6 flex flex-col gap-space-lg">
            {/* Brand Header Cluster */}
            <header className="flex flex-col gap-space-sm relative">
              <div className="flex items-center gap-space-sm">
                <BrandLogo className="w-10 h-10" />
                <div className="flex flex-col">
                  <div className="flex items-center gap-space-xs">
                    <span className="font-headline-lg text-headline-lg text-on-surface tracking-tight">CampusMind AI</span>
                    <span className="bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold">
                      Hackathon Demo
                    </span>
                  </div>
                  <p className="font-label-md text-label-md text-primary font-medium">
                    Hyper-Personalized Multilingual University Copilot
                  </p>
                </div>
              </div>

              <h1 className="font-display-lg text-display-lg text-on-surface mt-space-sm leading-tight">
                <span className="text-primary-container">Citation-Grounded</span> Answers for Your Exact Branch &amp; Semester.
              </h1>
              <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl">
                Direct deterministic ingestion of your faculty syllabus, grade regulations, real-time timetable shifts, and authorized circulars.
              </p>
            </header>

            {/* 4 Key Feature Cards Bento Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
              {/* Feature 1 */}
              <article className="bg-surface-container-lowest p-space-md rounded-xl shadow-xs border border-surface-container flex flex-col gap-space-xs hover:border-primary-fixed transition-colors">
                <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Citation-Grounded Answers</h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Grounded strictly in your university's verified curriculum, syllabus, and official circular documents.
                </p>
              </article>

              {/* Feature 2 */}
              <article className="bg-surface-container-lowest p-space-md rounded-xl shadow-xs border border-surface-container flex flex-col gap-space-xs hover:border-primary-fixed transition-colors">
                <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-secondary">
                  <Languages className="w-5 h-5" />
                </div>
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Multilingual Fluent</h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Chat naturally in Hindi, Telugu, Tamil, Spanish, French, German, or English with strict academic nomenclature.
                </p>
              </article>

              {/* Feature 3 */}
              <article className="bg-surface-container-lowest p-space-md rounded-xl shadow-xs border border-surface-container flex flex-col gap-space-xs hover:border-primary-fixed transition-colors">
                <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-primary-container">
                  <Database className="w-5 h-5" />
                </div>
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Instant Context Injection</h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Your branch, roll number, and demo-generated student context injected silently into every query prompt automatically.
                </p>
              </article>

              {/* Feature 4 */}
              <article className="bg-surface-container-lowest p-space-md rounded-xl shadow-xs border border-surface-container flex flex-col gap-space-xs hover:border-primary-fixed transition-colors">
                <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-tertiary-container">
                  <FileText className="w-5 h-5" />
                </div>
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Verifiable Citations</h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Official exam notifications and academic policies linked directly via page-referenced original PDFs.
                </p>
              </article>
            </div>
          </section>

          {/* Right Column: Interactive Auth Card with 9 Profile Fields & Sandbox Profiles Below */}
          <div className="lg:col-span-6 flex flex-col gap-space-md">
            <section className="bg-surface-container-lowest rounded-2xl shadow-xl border border-surface-container p-space-lg flex flex-col gap-space-md relative overflow-hidden">
              {/* Ambient Decorative AI Glow Accent */}
              <div className="absolute -top-16 -right-16 w-52 h-52 bg-primary-fixed opacity-40 rounded-full blur-3xl pointer-events-none"></div>

            {/* Auth Tabs Toggle */}
            <div className="flex items-center bg-surface-container-low p-1 rounded-xl relative z-10">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('signin');
                  setStatusMessage(null);
                }}
                className={`flex-1 py-2 text-center font-label-md text-label-md rounded-lg transition-all cursor-pointer ${activeTab === 'signin'
                  ? 'font-semibold bg-surface-container-lowest text-primary shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
                  }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('signup');
                  setStatusMessage(null);
                }}
                className={`flex-1 py-2 text-center font-label-md text-label-md rounded-lg transition-all cursor-pointer ${activeTab === 'signup'
                  ? 'font-semibold bg-surface-container-lowest text-primary shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
                  }`}
              >
                Create Account (Student)
              </button>
            </div>

            {/* Form Header Meta */}
            <div className="flex flex-col relative z-10">
              <h2 className="font-headline-lg text-headline-lg text-on-surface font-semibold">
                {activeTab === 'signin' ? 'Welcome Back, Scholar' : 'Institutional Student Enrollment'}
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                {activeTab === 'signin'
                  ? 'Enter your institutional credentials to resume synchronized agent context.'
                  : 'Initialize your student agent node with authenticated curriculum parameters.'}
              </p>
            </div>

            {/* Status Message Toast */}
            <AnimatePresence>
              {statusMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className={`p-space-sm rounded-xl font-body-sm text-body-sm flex items-center gap-2 border ${statusMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : statusMessage.type === 'error'
                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                      : 'bg-primary-fixed/50 text-primary border-primary-fixed'
                    }`}
                >
                  {statusMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : statusMessage.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                  ) : (
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  )}
                  <span>{statusMessage.text}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Forms */}
            {activeTab === 'signin' ? (
              /* SIGN IN FORM */
              <form onSubmit={handleSignIn} className="flex flex-col gap-space-md relative z-10">
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-md text-label-md font-medium text-on-surface" htmlFor="signin-email">
                    University Email
                  </label>
                  <input
                    id="signin-email"
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => {
                      setLoginEmail(e.target.value);
                      if (statusMessage) setStatusMessage(null);
                    }}
                    placeholder="arjun.sharma@campus.edu"
                    className="w-full h-11 px-3.5 bg-surface-container-low text-on-surface rounded-xl font-body-md text-body-md border border-surface-container-high placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:border-primary transition-all"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-label-md text-label-md font-medium text-on-surface" htmlFor="signin-password">
                      Password
                    </label>
                    <span className="font-label-sm text-label-sm text-outline">Case-sensitive</span>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      id="signin-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => {
                        setLoginPassword(e.target.value);
                        if (statusMessage) setStatusMessage(null);
                      }}
                      placeholder="••••••••••••"
                      className="w-full h-11 pl-3.5 pr-11 bg-surface-container-low text-on-surface rounded-xl font-body-md text-body-md border border-surface-container-high placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:border-primary transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 text-outline hover:text-on-surface p-1 rounded cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end text-on-surface-variant font-body-sm text-body-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginEmail('arjun.sharma@campus.edu');
                      setLoginPassword('Campus@123');
                      setStatusMessage(null);
                    }}
                    className="text-primary hover:underline font-label-md text-label-md cursor-pointer"
                  >
                    Use Demo Credentials
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="mt-space-xs w-full h-11 bg-gradient-to-r from-primary-container to-secondary text-on-primary font-headline-sm text-headline-sm rounded-xl flex items-center justify-center gap-space-xs shadow-md hover:brightness-105 active:scale-99 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  <span>{isLoading ? 'Authenticating...' : 'Authenticate & Launch Copilot'}</span>
                </button>
              </form>
            ) : (
              /* REGISTRATION FORM (9 FIELDS) */
              <form onSubmit={handleSignUp} className="flex flex-col gap-space-md relative z-10">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
                  {/* 1. Full Name */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-md text-label-md font-medium text-on-surface" htmlFor="full_name">
                      Full Name
                    </label>
                    <input
                      id="full_name"
                      type="text"
                      required
                      value={signupForm.full_name}
                      onChange={(e) => setSignupForm({ ...signupForm, full_name: e.target.value })}
                      placeholder="e.g. Arjun Sharma"
                      className="w-full h-10 px-3 bg-surface-container-low text-on-surface rounded-xl font-body-md text-body-md border border-surface-container-high placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:border-primary transition-all"
                    />
                  </div>

                  {/* 2. University Email */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-md text-label-md font-medium text-on-surface" htmlFor="email">
                      University Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      value={signupForm.email}
                      onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                      placeholder="arjun@univ.edu"
                      className="w-full h-10 px-3 bg-surface-container-low text-on-surface rounded-xl font-body-md text-body-md border border-surface-container-high placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:border-primary transition-all"
                    />
                  </div>

                  {/* 3. Password */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-md text-label-md font-medium text-on-surface" htmlFor="signup-password">
                      Password
                    </label>
                    <div className="relative flex items-center">
                      <input
                        id="signup-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={signupForm.password}
                        onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                        placeholder="••••••••••••"
                        className="w-full h-10 pl-3 pr-10 bg-surface-container-low text-on-surface rounded-xl font-body-md text-body-md border border-surface-container-high placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:border-primary transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-2.5 text-outline hover:text-on-surface p-1 rounded cursor-pointer"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 4. Student ID / Roll Number */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-md text-label-md font-medium text-on-surface" htmlFor="student_id">
                      Student ID / Roll No.
                    </label>
                    <input
                      id="student_id"
                      type="text"
                      required
                      value={signupForm.student_id}
                      onChange={(e) => setSignupForm({ ...signupForm, student_id: e.target.value })}
                      placeholder="e.g. 24CSE101"
                      className="w-full h-10 px-3 bg-surface-container-low text-on-surface rounded-xl font-body-md text-body-md border border-surface-container-high placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:border-primary transition-all"
                    />
                  </div>

                  {/* 5. Academic Branch */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-md text-label-md font-medium text-on-surface" htmlFor="branch">
                      Department Branch
                    </label>
                    <select
                      id="branch"
                      required
                      value={signupForm.branch}
                      onChange={(e) => setSignupForm({ ...signupForm, branch: e.target.value })}
                      className="w-full h-10 px-3 bg-surface-container-low text-on-surface rounded-xl font-body-md text-body-md border border-surface-container-high focus:outline-none focus:bg-surface-container-lowest focus:border-primary transition-all cursor-pointer"
                    >
                      <option value="" disabled>Select Branch</option>
                      <option value="CSE">Computer Science &amp; Engineering (CSE)</option>
                      <option value="ECE">Electronics &amp; Comm. (ECE)</option>
                      <option value="MECH">Mechanical Engineering (MECH)</option>
                      <option value="EEE">Electrical &amp; Electronics (EEE)</option>
                      <option value="CIVIL">Civil Engineering (CIVIL)</option>
                      <option value="IT">Information Technology (IT)</option>
                    </select>
                  </div>

                  {/* 6. Current Year */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-md text-label-md font-medium text-on-surface" htmlFor="current_year">
                      Academic Year
                    </label>
                    <select
                      id="current_year"
                      required
                      value={signupForm.current_year}
                      onChange={(e) => setSignupForm({ ...signupForm, current_year: e.target.value })}
                      className="w-full h-10 px-3 bg-surface-container-low text-on-surface rounded-xl font-body-md text-body-md border border-surface-container-high focus:outline-none focus:bg-surface-container-lowest focus:border-primary transition-all cursor-pointer"
                    >
                      <option value="" disabled>Select Year</option>
                      <option value="1st">1st Year (Freshman)</option>
                      <option value="2nd">2nd Year (Sophomore)</option>
                      <option value="3rd">3rd Year (Junior)</option>
                      <option value="4th">4th Year (Senior)</option>
                    </select>
                  </div>

                  {/* 7. Admission Batch */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-md text-label-md font-medium text-on-surface" htmlFor="batch">
                      Admission Batch
                    </label>
                    <select
                      id="batch"
                      required
                      value={signupForm.batch}
                      onChange={(e) => setSignupForm({ ...signupForm, batch: e.target.value })}
                      className="w-full h-10 px-3 bg-surface-container-low text-on-surface rounded-xl font-body-md text-body-md border border-surface-container-high focus:outline-none focus:bg-surface-container-lowest focus:border-primary transition-all cursor-pointer"
                    >
                      <option value="" disabled>Select Cohort</option>
                      <option value="2024-2028">2024 – 2028 Cohort</option>
                      <option value="2023-2027">2023 – 2027 Cohort</option>
                      <option value="2022-2026">2022 – 2026 Cohort</option>
                      <option value="2021-2025">2021 – 2025 Cohort</option>
                    </select>
                  </div>

                  {/* 8. Hostel Status */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-md text-label-md font-medium text-on-surface" htmlFor="hostel_status">
                      Residential Residency
                    </label>
                    <select
                      id="hostel_status"
                      required
                      value={signupForm.hostel_status}
                      onChange={(e) => setSignupForm({ ...signupForm, hostel_status: e.target.value })}
                      className="w-full h-10 px-3 bg-surface-container-low text-on-surface rounded-xl font-body-md text-body-md border border-surface-container-high focus:outline-none focus:bg-surface-container-lowest focus:border-primary transition-all cursor-pointer"
                    >
                      <option value="" disabled>Select Status</option>
                      <option value="Day Scholar">Day Scholar (Commuter)</option>
                      <option value="Hostel Block A">Hostel Block A (North Campus)</option>
                      <option value="Hostel Block B">Hostel Block B (South Campus)</option>
                    </select>
                  </div>
                </div>

                {/* 9. Phone Number (Optional) */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-label-md text-label-md font-medium text-on-surface" htmlFor="phone_number">
                      Emergency SMS / WhatsApp Notifications
                    </label>
                    <span className="font-label-sm text-label-sm text-outline">Optional</span>
                  </div>
                  <input
                    id="phone_number"
                    type="tel"
                    value={signupForm.phone_number}
                    onChange={(e) => setSignupForm({ ...signupForm, phone_number: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full h-10 px-3 bg-surface-container-low text-on-surface rounded-xl font-body-md text-body-md border border-surface-container-high placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:border-primary transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="mt-space-xs w-full h-11 bg-gradient-to-r from-primary-container to-secondary text-on-primary font-headline-sm text-headline-sm rounded-xl flex items-center justify-center gap-space-xs shadow-md hover:brightness-105 active:scale-99 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  <span>{isLoading ? 'Registering...' : 'Complete Registration & Launch Copilot'}</span>
                </button>
              </form>
            )}

            {/* Tab Switcher Navigation Link */}
            <div className="text-center pt-space-xs relative z-10">
              <p className="font-body-md text-body-md text-on-surface-variant">
                {activeTab === 'signin' ? 'Need to register a university node?' : 'Already registered?'}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab(activeTab === 'signin' ? 'signup' : 'signin');
                    setStatusMessage(null);
                  }}
                  className="font-semibold text-primary hover:underline ml-1 cursor-pointer"
                >
                  {activeTab === 'signin' ? 'Create Student Account' : 'Switch to Sign In'}
                </button>
              </p>
            </div>

            {/* Platform Capabilities Signature */}
            <footer className="mt-auto pt-space-md flex items-center justify-between text-outline font-label-sm text-label-sm border-t border-surface-container relative z-10">
              <span>Institutional Single Sign-On</span>
              <span className="w-1 h-1 rounded-full bg-outline"></span>
              <span>Citation-Grounded Answers</span>
              <span className="w-1 h-1 rounded-full bg-outline"></span>
              <span>Firebase Activity Analytics</span>
            </footer>
          </section>

          {/* 1-Click Evaluation Profiles (Shifted Below Signin Component) */}
          {isDemoMode && (
            <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-xl border border-surface-container flex flex-col gap-space-sm relative z-10">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm uppercase text-on-surface-variant tracking-wider font-semibold">
                  1-Click Evaluation Profiles (Instant Access)
                </span>
                <span className="inline-flex items-center gap-1 font-code-sm text-code-sm text-primary font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-tertiary-fixed-dim animate-pulse"></span> Sandbox Ready
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-xs">
                {demoAccounts.map((profile) => (
                  <button
                    key={profile.roll}
                    type="button"
                    onClick={() => handleQuickLogin(profile)}
                    disabled={isLoading}
                    className="group flex flex-col items-start p-space-sm bg-surface-container-low rounded-xl hover:bg-surface-container border border-surface-container hover:border-primary-container transition-all text-left shadow-2xs cursor-pointer active:scale-98 disabled:opacity-50"
                  >
                    <span className="inline-flex items-center gap-1 font-label-md text-label-md font-semibold text-on-surface group-hover:text-primary">
                      ⚡ {profile.name}
                    </span>
                    <span className="font-code-sm text-code-sm text-on-surface-variant">
                      {profile.year} {profile.branch} • {profile.roll}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  </main>
  );
}
