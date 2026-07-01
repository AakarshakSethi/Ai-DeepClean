import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getPlan, upgradePlan } from "../api/billing";
import { disconnectGmail, deleteMyData } from "../api/settings";
import DashboardLayout from "../layouts/DashboardLayout";
import {
  FiUser,
  FiShield,
  FiAward,
  FiTrash2,
  FiLogOut,
  FiCheck,
  FiCreditCard,
  FiAlertTriangle,
  FiLoader,
  FiSliders,
  FiBell,
  FiClock,
  FiFilter
} from "react-icons/fi";

export default function Settings() {
  const userId = localStorage.getItem("deepclean_user_id");
  const userEmail = localStorage.getItem("deepclean_user_email") || "User";
  const navigate = useNavigate();

  const [planInfo, setPlanInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  // Tab Control: general | rules | billing | privacy
  const [activeTab, setActiveTab] = useState("general");

  // General Settings States (Persisted to localStorage for frontend defaults)
  const [defaultScan, setDefaultScan] = useState(
    Number(localStorage.getItem("deepclean_default_scan")) || 250
  );
  const [syncFreq, setSyncFreq] = useState(
    localStorage.getItem("deepclean_sync_freq") || "manual"
  );
  const [notifyOTPs, setNotifyOTPs] = useState(
    localStorage.getItem("deepclean_notify_otps") === "true"
  );
  const [displayLimit, setDisplayLimit] = useState(
    localStorage.getItem("deepclean_display_limit") || "auto"
  );

  // Auto-Clean Filters States
  const [autoDeleteOTPs, setAutoDeleteOTPs] = useState(
    localStorage.getItem("deepclean_autodelete_otps") === "true"
  );
  const [autoDeletePromos, setAutoDeletePromos] = useState(
    localStorage.getItem("deepclean_autodelete_promos") === "true"
  );

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await getPlan(userId);
      setPlanInfo(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [userId]);

  // Save General & Rules Settings handlers
  const handleSaveGeneral = () => {
    localStorage.setItem("deepclean_default_scan", defaultScan);
    localStorage.setItem("deepclean_sync_freq", syncFreq);
    localStorage.setItem("deepclean_notify_otps", notifyOTPs);
    localStorage.setItem("deepclean_display_limit", displayLimit);
    alert("General settings saved successfully!");
  };

  const handleSaveRules = () => {
    localStorage.setItem("deepclean_autodelete_otps", autoDeleteOTPs);
    localStorage.setItem("deepclean_autodelete_promos", autoDeletePromos);
    alert("Auto-clean rules updated! These filters will run on your next Gmail Scan.");
  };

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      await upgradePlan(userId);
      await fetchSettings();
      alert("Successfully upgraded to Pro! You now have unlimited sync & searches.");
    } catch (e) {
      console.error(e);
      alert("Upgrade failed. Make sure billing router is running.");
    } finally {
      setUpgrading(false);
    }
  };

  const handleDisconnect = async () => {
    if (
      !window.confirm(
        "Are you sure you want to disconnect Gmail? You will need to re-authenticate to sync new emails."
      )
    )
      return;

    try {
      await disconnectGmail(userId);
      localStorage.removeItem("deepclean_user_id");
      localStorage.removeItem("deepclean_user_email");
      localStorage.removeItem("deepclean_user_plan");
      navigate("/");
    } catch (e) {
      console.error(e);
      alert("Failed to disconnect Gmail. Please try again.");
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmText !== "DELETE MY DATA") {
      alert("Please type the exact phrase to confirm.");
      return;
    }

    try {
      await deleteMyData(userId);
      localStorage.removeItem("deepclean_user_id");
      localStorage.removeItem("deepclean_user_email");
      localStorage.removeItem("deepclean_user_plan");
      navigate("/");
    } catch (e) {
      console.error(e);
      alert("Failed to delete account data. Please try again.");
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] text-gray-400">
          <FiLoader className="animate-spin text-violet-500 mb-4" size={28} />
          <p className="text-sm">Loading settings preferences...</p>
        </div>
      </DashboardLayout>
    );
  }

  const isPro = planInfo && planInfo.plan === "pro";
  const searchLimit = planInfo ? planInfo.monthly_search_limit : 10;
  const searchCount = planInfo ? planInfo.monthly_search_count : 0;
  const searchPercent = Math.min((searchCount / searchLimit) * 100, 100);

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Settings Header */}
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-white">Settings</h1>
          <p className="text-xs text-gray-400 mt-1">
            Configure default scan levels, auto-clean filters, and account billing options.
          </p>
        </div>

        {/* Tab Sub-Navigation (Gmail-inspired tabs) */}
        <div className="flex border-b border-gray-800 gap-6 overflow-x-auto pb-0.5">
          <button
            onClick={() => setActiveTab("general")}
            className={`pb-4 text-xs md:text-sm font-bold border-b-2 whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === "general"
                ? "border-violet-500 text-violet-400"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <FiSliders size={14} />
            General
          </button>
          <button
            onClick={() => setActiveTab("rules")}
            className={`pb-4 text-xs md:text-sm font-bold border-b-2 whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === "rules"
                ? "border-violet-500 text-violet-400"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <FiFilter size={14} />
            Filters & Auto-Clean
          </button>
          <button
            onClick={() => setActiveTab("billing")}
            className={`pb-4 text-xs md:text-sm font-bold border-b-2 whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === "billing"
                ? "border-violet-500 text-violet-400"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <FiCreditCard size={14} />
            Accounts & Billing
          </button>
          <button
            onClick={() => setActiveTab("privacy")}
            className={`pb-4 text-xs md:text-sm font-bold border-b-2 whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === "privacy"
                ? "border-violet-500 text-violet-400"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <FiShield size={14} />
            Security & Privacy
          </button>
        </div>

        {/* Tab 1: General Preferences */}
        {activeTab === "general" && (
          <div className="glass-panel p-6 rounded-2xl border border-gray-800 space-y-6">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3">
              <FiSliders className="text-violet-400" />
              General Preferences
            </h3>

            {/* Scan Limit Defaults */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-300">Default Scan Limit:</label>
              <select
                value={defaultScan}
                onChange={(e) => setDefaultScan(Number(e.target.value))}
                className="bg-[#151A28] border border-gray-850 text-xs text-white rounded-xl py-2.5 px-4 w-full max-w-md outline-none focus:border-violet-500"
              >
                <option value="50">50 Emails (Quick Scan)</option>
                <option value="250">250 Emails (Standard)</option>
                <option value="500">500 Emails (Deep Scan)</option>
                <option value="2000">2000 Emails (Maximum Scan)</option>
              </select>
              <p className="text-[10px] text-gray-500">Set the default scan size used on your dashboard scanner.</p>
            </div>

            {/* Sync Frequencies */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-300">Automatic Sync Frequency:</label>
              <select
                value={syncFreq}
                onChange={(e) => setSyncFreq(e.target.value)}
                className="bg-[#151A28] border border-gray-850 text-xs text-white rounded-xl py-2.5 px-4 w-full max-w-md outline-none focus:border-violet-500"
              >
                <option value="manual">Manual Scan (Click "Scan Gmail" button)</option>
                <option value="hourly">Every Hour (Background auto-sync)</option>
                <option value="daily">Every 24 Hours</option>
              </select>
              <p className="text-[10px] text-gray-500">Select how often the backend fetches new headers.</p>
            </div>

            {/* Display Storage Cap */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-300">Display Storage Cap / Limit:</label>
              <select
                value={displayLimit}
                onChange={(e) => setDisplayLimit(e.target.value)}
                className="bg-[#151A28] border border-gray-850 text-xs text-white rounded-xl py-2.5 px-4 w-full max-w-md outline-none focus:border-violet-500"
              >
                <option value="auto">Auto-Detect (Use Google Account Limit)</option>
                <option value="15">15 GB (Standard Gmail Limit)</option>
                <option value="30">30 GB (G Suite / Workspace Basic)</option>
                <option value="100">100 GB (Google One Basic)</option>
                <option value="200">200 GB (Google One Standard)</option>
                <option value="2048">2 TB (Google One Premium)</option>
              </select>
              <p className="text-[10px] text-gray-500">
                Override Google organization pool limits (e.g. if Google shows a G Suite 5 TB limit but you want to calculate relative to a standard 15 GB limit).
              </p>
            </div>

            {/* Notification triggers */}
            <div className="space-y-3 pt-2">
              <label className="block text-xs font-semibold text-gray-300">Alerts & Notifications:</label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyOTPs}
                  onChange={(e) => setNotifyOTPs(e.target.checked)}
                  className="rounded bg-[#151A28] border-gray-850 text-violet-600 focus:ring-violet-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-xs text-gray-300">Alert me when new OTPs or logins are detected</span>
              </label>
            </div>

            <div className="pt-4 border-t border-gray-800/60">
              <button
                onClick={handleSaveGeneral}
                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-750 hover:to-indigo-750 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-all"
              >
                Save Settings
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Filters & Auto-Clean */}
        {activeTab === "rules" && (
          <div className="glass-panel p-6 rounded-2xl border border-gray-800 space-y-6">
            <div className="border-b border-gray-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FiFilter className="text-violet-400" />
                Auto-Clean Filters
              </h3>
              <p className="text-[11px] text-gray-400 mt-1">Configure automation rules to clean standard clutter silently</p>
            </div>

            <div className="space-y-4">
              {/* Auto-delete OTPs rule */}
              <div className="bg-[#151A28]/40 border border-gray-850 p-4 rounded-2xl space-y-2 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="max-w-xl">
                  <h4 className="text-xs font-bold text-white">Auto-Trash Standard OTPs</h4>
                  <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                    Standard OTPs (sign-in codes, login verifications) expire within minutes. This filter will automatically trash any standard OTP email older than 24 hours on your next sync.
                  </p>
                </div>
                <div className="shrink-0">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoDeleteOTPs}
                      onChange={(e) => setAutoDeleteOTPs(e.target.checked)}
                      className="rounded bg-[#151A28] border-gray-850 text-violet-600 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-violet-400">Enable</span>
                  </label>
                </div>
              </div>

              {/* Auto-delete promos rule */}
              <div className="bg-[#151A28]/40 border border-gray-850 p-4 rounded-2xl space-y-2 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="max-w-xl">
                  <h4 className="text-xs font-bold text-white">Auto-Trash Historical Promotions</h4>
                  <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                    Promotional clutter (newsletters, coupon flyers) gets old quickly. This rule automatically trashes any promotions or newsletter emails older than 30 days on your next scan.
                  </p>
                </div>
                <div className="shrink-0">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoDeletePromos}
                      onChange={(e) => setAutoDeletePromos(e.target.checked)}
                      className="rounded bg-[#151A28] border-gray-850 text-violet-600 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-violet-400">Enable</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-800/60">
              <button
                onClick={handleSaveRules}
                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-750 hover:to-indigo-750 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-all"
              >
                Apply Rules
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Accounts & Billing */}
        {activeTab === "billing" && (
          <div className="space-y-6">
            
            {/* Connected User details */}
            <div className="glass-panel p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-6 border border-gray-800">
              <div className="flex items-center gap-4 text-center sm:text-left flex-col sm:flex-row">
                <div className="w-14 h-14 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center font-bold text-violet-400 text-xl">
                  {userEmail[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{userEmail}</h3>
                  <p className="text-xs text-gray-500 mt-1">Google Credentials Authenticated (Full Write/Read)</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 bg-violet-600/10 border border-violet-500/25 px-3 py-1.5 rounded-full">
                <FiAward className="text-violet-400" size={14} />
                <span className="text-[10px] text-violet-300 font-bold uppercase tracking-wider">
                  {isPro ? "Pro Member" : "Free Tier"}
                </span>
              </div>
            </div>

            {/* Plan limits */}
            <div className="glass-panel p-6 rounded-2xl border border-gray-800 space-y-6">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <FiCreditCard className="text-violet-400" size={16} />
                  Plan & Billing limits
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">Manage search balances and plan subscriptions</p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Monthly AI Searches Balance</span>
                  <span className="text-white font-bold">
                    {searchCount} of {searchLimit === 999999 ? "∞" : searchLimit} used
                  </span>
                </div>
                <div className="w-full bg-[#151A28] border border-gray-850 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-violet-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${searchPercent}%` }}
                  ></div>
                </div>
              </div>

              {isPro ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl p-4 flex gap-2 items-center">
                  <FiCheck size={18} />
                  <span className="font-medium">Unlimited plan activated: Enjoy infinite inbox scans and searches!</span>
                </div>
              ) : (
                <div className="bg-violet-600/5 border border-violet-500/20 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-white">Upgrade to Pro Plan</h4>
                    <p className="text-[11px] text-gray-400 mt-1">Unlock unlimited sync, unlimited searches, and deep ML surveys for ₹149/mo.</p>
                  </div>

                  <button
                    onClick={handleUpgrade}
                    disabled={upgrading}
                    className="w-full sm:w-auto bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold px-6 py-2.5 rounded-xl text-xs shadow-md transition-all hover:scale-[1.01]"
                  >
                    {upgrading ? "Upgrading..." : "Upgrade for ₹149"}
                  </button>
                </div>
              )}
            </div>

          </div>
        )}

        {/* Tab 4: Security & Privacy */}
        {activeTab === "privacy" && (
          <div className="glass-panel p-6 rounded-2xl border border-gray-800 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5 border-b border-gray-800 pb-3">
                <FiShield className="text-red-400" />
                Security & Danger Zones
              </h3>
              <p className="text-xs text-gray-400 mt-1">Disconnect accounts and wipe backend sync logs</p>
            </div>

            {/* Disconnect button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[#151A28] border border-gray-850 rounded-2xl">
              <div>
                <h4 className="text-xs font-bold text-white">Disconnect Gmail API</h4>
                <p className="text-[11px] text-gray-400 mt-1">Remove Google authentication refresh token from our systems.</p>
              </div>
              <button
                onClick={handleDisconnect}
                className="flex items-center justify-center gap-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 font-semibold px-4 py-2 rounded-xl text-xs transition-all shrink-0"
              >
                <FiLogOut size={12} />
                Disconnect Gmail
              </button>
            </div>

            {/* Wipe account data */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-red-500/5 border border-red-500/15 rounded-2xl">
              <div>
                <h4 className="text-xs font-bold text-red-300">Wipe All My Data</h4>
                <p className="text-[11px] text-gray-400 mt-1">Irreversibly delete your account, synced headers, models, and history logs.</p>
              </div>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center justify-center gap-1 bg-red-600/10 hover:bg-red-600 border border-red-500/25 text-red-400 hover:text-white font-semibold px-4 py-2 rounded-xl text-xs transition-all shrink-0"
              >
                <FiTrash2 size={12} />
                Delete Account Data
              </button>
            </div>
          </div>
        )}

        {/* Destructive Double-Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-[#111827] border border-red-500/30 rounded-3xl p-6 md:p-8 max-w-md w-full text-center relative shadow-2xl">
              
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
                <FiAlertTriangle size={24} />
              </div>

              <h3 className="text-lg font-bold text-white">Irreversible Data Erasure!</h3>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                This will delete your database record, synced email metadatas, survey responses, and active subscription details. You cannot undo this action.
              </p>

              <div className="my-6">
                <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
                  Type <span className="text-red-400 select-all font-mono">DELETE MY DATA</span> below:
                </label>
                <input
                  type="text"
                  placeholder="DELETE MY DATA"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="w-full bg-[#151A28] border border-red-500/30 rounded-xl py-2.5 px-4 text-center font-semibold text-sm text-white outline-none focus:border-red-500 transition-all placeholder:text-gray-600"
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleDeleteAccount}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-xl text-xs transition-all"
                >
                  Confirm Delete
                </button>
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setConfirmText("");
                  }}
                  className="flex-1 border border-gray-700 hover:bg-gray-800 text-gray-300 font-semibold py-2.5 rounded-xl text-xs transition-all"
                >
                  Cancel
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}