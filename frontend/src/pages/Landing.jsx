import { Link } from "react-router-dom";
import { FiInbox, FiCheckSquare, FiSearch, FiSliders, FiCheck, FiArrowRight } from "react-icons/fi";

export default function Landing() {
  return (
    <div className="min-height-screen bg-[#0B0F19] text-white flex flex-col">
      {/* Navbar */}
      <header className="px-6 py-5 flex items-center justify-between border-b border-gray-800/50 backdrop-blur bg-[#0B0F19]/80 sticky top-0 z-50">
        <h1 className="text-xl font-bold flex items-center gap-2 m-0">
          <span className="bg-gradient-to-r from-violet-400 to-indigo-400 text-transparent bg-clip-text">
            DeepClean
          </span>
          <span className="text-xs bg-violet-500/20 text-violet-400 px-1.5 py-0.5 rounded font-medium">
            AI
          </span>
        </h1>
        <Link
          to="/login"
          className="bg-violet-600 hover:bg-violet-700 text-white px-5 py-2 rounded-xl text-sm font-medium transition-all shadow-md shadow-violet-600/25"
        >
          Connect Gmail
        </Link>
      </header>

      {/* Hero Section */}
      <section className="px-6 py-20 text-center max-w-4xl mx-auto flex flex-col items-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse"></span>
          Reclaim Your Gmail Space with AI
        </div>

        <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight m-0 text-white">
          Is your Gmail storage full? <br />
          <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400 text-transparent bg-clip-text">
            DeepClean it in minutes.
          </span>
        </h2>

        <p className="mt-6 text-gray-400 text-base md:text-lg max-w-2xl leading-relaxed">
          DeepClean helps you declutter your inbox. It categorizes your mail, isolates normal OTPs, preserves delivery OTPs, and guides you through 10-second micro-surveys. We never auto-delete — you have absolute control.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4">
          <Link
            to="/login"
            className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-medium px-8 py-3.5 rounded-xl shadow-lg shadow-violet-600/30 transition-all hover:scale-[1.02]"
          >
            Get Started Free
            <FiArrowRight size={16} />
          </Link>
          <a
            href="#features"
            className="flex items-center justify-center border border-gray-800 hover:bg-gray-800/40 text-gray-300 font-medium px-8 py-3.5 rounded-xl transition-all"
          >
            How it works
          </a>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="px-6 py-20 bg-slate-900/40 border-y border-gray-800/50">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-center text-3xl font-bold text-white mb-16">
            Smart Features Built for Busy Professionals
          </h3>

          <div className="responsive-grid">
            <div className="glass-card p-8 rounded-2xl flex flex-col items-start">
              <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center mb-6">
                <FiInbox size={24} />
              </div>
              <h4 className="text-xl font-bold text-white mb-2">Smart Folders</h4>
              <p className="text-sm text-gray-400 leading-relaxed">
                Automatically group emails by brand/application (like LinkedIn, Facebook, Myntra, Flipkart). Clean up cluster by cluster instead of going page-by-page.
              </p>
            </div>

            <div className="glass-card p-8 rounded-2xl flex flex-col items-start">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-6">
                <FiSliders size={24} />
              </div>
              <h4 className="text-xl font-bold text-white mb-2">OTP Exceptions</h4>
              <p className="text-sm text-gray-400 leading-relaxed">
                Cleans general OTPs automatically but protects OTPs from Amazon, Myntra, Flipkart, and FedEx needed for delivery collection. No lost packages.
              </p>
            </div>

            <div className="glass-card p-8 rounded-2xl flex flex-col items-start">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-6">
                <FiCheckSquare size={24} />
              </div>
              <h4 className="text-xl font-bold text-white mb-2">10-Second Surveys</h4>
              <p className="text-sm text-gray-400 leading-relaxed">
                Tired of manually sifting through gallery-like junk? Answer 3 quick taps to teach our AI system your preferences, helping you sort emails instantly.
              </p>
            </div>

            <div className="glass-card p-8 rounded-2xl flex flex-col items-start">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-6">
                <FiSearch size={24} />
              </div>
              <h4 className="text-xl font-bold text-white mb-2">AI Search & Restore</h4>
              <p className="text-sm text-gray-400 leading-relaxed">
                Search your inbox in plain English. If you search for an email you already deleted, the system reminds you and lets you restore it in a single tap.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="px-6 py-20 max-w-5xl mx-auto w-full">
        <div className="text-center mb-16">
          <h3 className="text-3xl font-extrabold text-white">Simple, Transparent Pricing</h3>
          <p className="text-gray-400 mt-3 text-sm">Start cleaning for free, upgrade as you need more power.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {/* Free Tier */}
          <div className="glass-panel p-8 rounded-2xl border border-gray-800 flex flex-col h-full relative">
            <h4 className="text-lg font-bold text-white mb-1">Free Tier</h4>
            <p className="text-xs text-gray-400 mb-6">Perfect for basic inbox audits</p>
            <div className="text-3xl font-extrabold text-white mb-6">
              ₹0 <span className="text-sm font-normal text-gray-400">/ month</span>
            </div>

            <ul className="space-y-3 flex-1 mb-8 text-sm text-gray-300">
              <li className="flex items-center gap-2">
                <FiCheck className="text-violet-400 shrink-0" size={16} />
                <span>Sync up to 50 recent emails</span>
              </li>
              <li className="flex items-center gap-2">
                <FiCheck className="text-violet-400 shrink-0" size={16} />
                <span>Limit: 10 AI Searches per month</span>
              </li>
              <li className="flex items-center gap-2">
                <FiCheck className="text-violet-400 shrink-0" size={16} />
                <span>Standard OTP Cleanups</span>
              </li>
              <li className="flex items-center gap-2">
                <FiCheck className="text-violet-400 shrink-0" size={16} />
                <span>Review-30 Candidate Batches</span>
              </li>
            </ul>

            <Link
              to="/login"
              className="w-full text-center border border-gray-700 hover:bg-gray-800 text-white font-medium py-3 rounded-xl transition-all"
            >
              Get Started
            </Link>
          </div>

          {/* Pro Tier */}
          <div className="glass-panel p-8 rounded-2xl border border-violet-500/40 bg-gradient-to-b from-[#1E1B4B]/20 to-transparent flex flex-col h-full relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-violet-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-xl">
              Recommended
            </div>
            
            <h4 className="text-lg font-bold text-white mb-1">Pro Plan</h4>
            <p className="text-xs text-gray-400 mb-6">For heavy users and storage-heavy accounts</p>
            <div className="text-3xl font-extrabold text-white mb-6">
              ₹149 <span className="text-sm font-normal text-gray-400">/ month</span>
            </div>

            <ul className="space-y-3 flex-1 mb-8 text-sm text-gray-300">
              <li className="flex items-center gap-2">
                <FiCheck className="text-violet-400 shrink-0" size={16} />
                <span>Unlimited Email Syncing</span>
              </li>
              <li className="flex items-center gap-2">
                <FiCheck className="text-violet-400 shrink-0" size={16} />
                <span>Unlimited AI Searches</span>
              </li>
              <li className="flex items-center gap-2">
                <FiCheck className="text-violet-400 shrink-0" size={16} />
                <span>Priority Smart App Folders</span>
              </li>
              <li className="flex items-center gap-2">
                <FiCheck className="text-violet-400 shrink-0" size={16} />
                <span>ML Model Survey Personalization</span>
              </li>
            </ul>

            <Link
              to="/login"
              className="w-full text-center bg-violet-600 hover:bg-violet-700 text-white font-medium py-3 rounded-xl shadow-lg shadow-violet-600/25 transition-all hover:scale-[1.01]"
            >
              Upgrade to Pro
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto py-8 text-center text-gray-500 text-xs border-t border-gray-800/40">
        © 2026 AI Inbox DeepClean. All rights reserved. Google and Gmail are trademarks of Google LLC.
      </footer>
    </div>
  );
}