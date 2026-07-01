import { useState, useEffect } from "react";
import { useStorageSummary } from "../hooks/useEmails";
import { listEmails, getEmailDetails, getAttachmentDownloadUrl, sendEmail } from "../api/emails";
import { runSync } from "../api/sync";
import { approveAction } from "../api/cleanup";
import DashboardLayout from "../layouts/DashboardLayout";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend
} from "recharts";
import {
  FiRefreshCw,
  FiFolder,
  FiTrash2,
  FiShield,
  FiMail,
  FiInfo,
  FiAlertTriangle,
  FiEdit3
} from "react-icons/fi";

const CATEGORY_COLORS = {
  Promotions: "#8B5CF6", // Violet
  Social: "#EC4899",     // Pink
  Updates: "#3B82F6",    // Blue
  Receipts: "#10B981",   // Emerald
  OTP: "#F59E0B",        // Amber
  uncategorized: "#6B7280" // Gray
};

function formatBytes(bytes) {
  if (!bytes) return "0.00 MB";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

export default function Dashboard() {
  const userId = localStorage.getItem("deepclean_user_id");
  const userPlan = localStorage.getItem("deepclean_user_plan") || "free";
  const { data: summaryData, loading: summaryLoading, error: summaryError, refetch } = useStorageSummary(userId);

  const [activeTab, setActiveTab] = useState("overview"); // overview | folders | otps
  const [allEmails, setAllEmails] = useState([]);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");
  const [syncProgress, setSyncProgress] = useState(0);
  const [scanLimit, setScanLimit] = useState(50);
  const [expandedFolder, setExpandedFolder] = useState(null);

  // Email Reader Modal states
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Compose Email states
  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [sending, setSending] = useState(false);

  // Load all emails to perform folder groupings and OTP filterings
  const fetchAllEmails = async () => {
    if (!userId) return;
    setEmailsLoading(true);
    try {
      const res = await listEmails(userId);
      setAllEmails(res.emails || []);
    } catch (e) {
      console.error(e);
    } finally {
      setEmailsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllEmails();
  }, [userId]);

  const handleScanLimitChange = (val) => {
    setScanLimit(val);
  };

  // Open Email Reader
  const handleOpenEmail = async (emailId) => {
    setModalLoading(true);
    setShowModal(true);
    try {
      const res = await getEmailDetails(emailId, userId);
      setSelectedEmail(res);
    } catch (e) {
      console.error(e);
      alert("Failed to load email details from Gmail.");
      setShowModal(false);
    } finally {
      setModalLoading(false);
    }
  };

  // Compose Email handler
  const handleSendEmail = async (e) => {
    e.preventDefault();
    if (!composeTo || !composeSubject || !composeBody) {
      alert("Please fill in all fields.");
      return;
    }
    setSending(true);
    try {
      const res = await sendEmail(userId, composeTo, composeSubject, composeBody);
      if (res.error) {
        alert(res.error);
      } else {
        alert("Email sent successfully via Gmail API!");
        setShowCompose(false);
        setComposeTo("");
        setComposeSubject("");
        setComposeBody("");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to send email. Make sure your Gmail account has been successfully authenticated.");
    } finally {
      setSending(false);
    }
  };

  // Sync handler with animated progress bar
  const handleSync = async () => {
    setSyncing(true);
    setSyncProgress(0);
    setSyncStatus("Connecting to Gmail API...");
    
    // Smooth progress bar simulation
    const interval = setInterval(() => {
      setSyncProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + 10;
      });
    }, 600);

    try {
      setSyncStatus(`Syncing recent ${scanLimit} emails...`);
      const res = await runSync(userId, scanLimit);
      
      clearInterval(interval);
      setSyncProgress(100);
      setSyncStatus(`Sync complete! Synced ${res.synced_new_emails} new emails.`);
      
      setTimeout(() => {
        setSyncing(false);
        refetch();
        fetchAllEmails();
      }, 1500);
    } catch (e) {
      clearInterval(interval);
      setSyncing(false);
      alert("Failed to sync inbox. Make sure Google credentials are valid.");
    }
  };

  // Delete handler for dashboard elements
  const handleDeleteEmail = async (emailId) => {
    if (!window.confirm("Are you sure you want to delete this email?")) return;
    try {
      await approveAction(userId, emailId, "delete");
      setAllEmails((prev) => prev.filter((e) => e.id !== emailId));
      refetch();
    } catch (e) {
      console.error(e);
    }
  };

  // Bulk Delete for Smart Folders
  const handleBulkDeleteFolder = async (folderEmails, folderName) => {
    if (
      !window.confirm(
        `Are you sure you want to delete all ${folderEmails.length} emails in the "${folderName}" folder?`
      )
    )
      return;

    try {
      for (const email of folderEmails) {
        await approveAction(userId, email.id, "delete");
      }
      setAllEmails((prev) => prev.filter((e) => !folderEmails.some((fe) => fe.id === e.id)));
      setExpandedFolder(null);
      refetch();
    } catch (e) {
      console.error(e);
    }
  };

  // Bulk Delete for standard OTPs
  const handleBulkDeleteStandardOTPs = async () => {
    const cleanable = allEmails.filter(
      (e) => e.category === "OTP" && !e.is_order_otp_exception
    );
    if (cleanable.length === 0) return;

    if (
      !window.confirm(
        `Are you sure you want to delete all ${cleanable.length} standard OTP emails?`
      )
    )
      return;

    try {
      for (const email of cleanable) {
        await approveAction(userId, email.id, "delete");
      }
      setAllEmails((prev) => prev.filter((e) => !cleanable.some((c) => c.id === e.id)));
      refetch();
    } catch (e) {
      console.error(e);
    }
  };

  // Grouping logic for smart folders
  const getBrandFolders = () => {
    const groups = {};
    allEmails.forEach((email) => {
      let brand = "Other Senders";
      const senderLower = email.sender.toLowerCase();

      if (senderLower.includes("linkedin")) brand = "LinkedIn";
      else if (senderLower.includes("facebook")) brand = "Facebook";
      else if (senderLower.includes("myntra")) brand = "Myntra";
      else if (senderLower.includes("amazon")) brand = "Amazon";
      else if (senderLower.includes("flipkart")) brand = "Flipkart";
      else if (senderLower.includes("netflix")) brand = "Netflix";
      else if (senderLower.includes("spotify")) brand = "Spotify";
      else if (senderLower.includes("github")) brand = "GitHub";
      else if (senderLower.includes("google") || senderLower.includes("gmail")) brand = "Google";
      else {
        const match = senderLower.match(/@([a-z0-9\-]+)\./i);
        if (match && match[1]) {
          brand = match[1].charAt(0).toUpperCase() + match[1].slice(1);
        }
      }

      if (!groups[brand]) {
        groups[brand] = { name: brand, emails: [], size: 0 };
      }
      groups[brand].emails.push(email);
      groups[brand].size += email.size_bytes;
    });

    return Object.values(groups).sort((a, b) => b.size - a.size);
  };

  if (summaryLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] text-gray-400 space-y-4">
          <FiRefreshCw className="animate-spin text-violet-500" size={32} />
          <p className="text-sm font-medium">Scanning database & loading metrics...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (summaryError) {
    return (
      <DashboardLayout>
        <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl max-w-xl mx-auto mt-10">
          <h3 className="font-bold text-lg mb-2">Error Loading Dashboard</h3>
          <p className="text-sm">{summaryError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-red-600 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </DashboardLayout>
    );
  }

  // Prepping pie chart data
  const pieData = Object.entries(summaryData.size_by_category || {}).map(([name, value]) => ({
    name,
    value: value / (1024 * 1024) // in MB
  }));

  const folders = getBrandFolders();
  const standardOTPs = allEmails.filter((e) => e.category === "OTP" && !e.is_order_otp_exception);
  const deliveryOTPs = allEmails.filter((e) => e.category === "OTP" && e.is_order_otp_exception);

  const limitBytes = summaryData.real_limit_bytes || (15 * 1024 * 1024 * 1024);
  const usageBytes = summaryData.real_usage_bytes || (14.4 * 1024 * 1024 * 1024);
  const usagePercent = Math.round((usageBytes / limitBytes) * 100);
  
  const limitGB = (limitBytes / (1024 * 1024 * 1024)).toFixed(0);
  const usageGB = (usageBytes / (1024 * 1024 * 1024)).toFixed(1);
  const isHighUsage = usagePercent >= 80;

  return (
    <DashboardLayout>
      <div className="space-y-8 relative">
        
        {/* Storage Quota Warning Card (Google-style Alert) */}
        <div className={`glass-panel p-6 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-6 ${
          isHighUsage ? "border-red-500/25 bg-red-500/5" : "border-violet-500/25 bg-violet-500/5"
        }`}>
          <div className="space-y-1 text-center md:text-left">
            <h3 className="text-base font-bold text-white flex items-center gap-2 justify-center md:justify-start">
              <FiAlertTriangle className={isHighUsage ? "text-red-400 animate-pulse" : "text-violet-400"} size={20} />
              Gmail Storage Quota ({usagePercent}% Full)
            </h3>
            <p className="text-xs text-gray-400 max-w-lg leading-relaxed">
              {isHighUsage 
                ? `Your Google Account is using ${usageGB} GB of your ${limitGB} GB shared storage. If you reach 100%, you will not be able to receive new emails. Use DeepClean below to clear space!`
                : `Your Google Account is using ${usageGB} GB of your ${limitGB} GB shared storage. Keep your inbox clean to stay far below your storage limit.`}
            </p>
          </div>
          <div className="w-full md:w-64 space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-gray-300">{usageGB} GB used</span>
              <span className={isHighUsage ? "text-red-400" : "text-violet-400"}>{usagePercent}%</span>
            </div>
            <div className="w-full bg-gray-800/80 h-2.5 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${isHighUsage ? "bg-red-500" : "bg-violet-500"}`} 
                style={{ width: `${usagePercent}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Sync Controls Section */}
        <div className="glass-panel p-4 md:p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-extrabold text-white">Inbox Scanner</h2>
            <p className="text-xs text-gray-400 mt-1">Specify how many emails you want to fetch and scan</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
            {/* Scan Limit Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-semibold">Scan Limit:</span>
              <select
                value={scanLimit}
                onChange={(e) => handleScanLimitChange(Number(e.target.value))}
                className="bg-[#151A28] border border-[#2E3B52] text-xs text-white rounded-xl py-2 px-3 outline-none focus:border-violet-500"
              >
                <option value="50">50 Emails (Quick)</option>
                <option value="250">250 Emails (Standard)</option>
                <option value="500">500 Emails (Deep)</option>
                <option value="1000">1000 Emails (Full)</option>
                <option value="2000">2000 Emails (Max Scan)</option>
              </select>
            </div>

            <button
              onClick={handleSync}
              disabled={syncing}
              className={`flex items-center justify-center gap-2 w-full sm:w-auto bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md ${
                syncing ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.01]"
              }`}
            >
              <FiRefreshCw className={syncing ? "animate-spin" : ""} size={16} />
              {syncing ? "Syncing..." : "Scan Gmail"}
            </button>
          </div>
        </div>

        {/* Animated Sync Progress Bar */}
        {syncing && (
          <div className="glass-panel p-5 rounded-2xl border border-violet-500/20 space-y-3">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-violet-400 flex items-center gap-2">
                <FiRefreshCw className="animate-spin" size={14} />
                {syncStatus}
              </span>
              <span className="text-violet-300 font-mono">{syncProgress}%</span>
            </div>
            <div className="w-full bg-gray-800 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-violet-500 to-indigo-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${syncProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Core Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-card p-5 rounded-2xl">
            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Emails Scanned</p>
            <h2 className="text-3xl font-extrabold text-white mt-2">{summaryData.emails_scanned}</h2>
          </div>

          <div className="glass-card p-5 rounded-2xl">
            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider font-sans">Total Scanned Size</p>
            <h2 className="text-3xl font-extrabold text-white mt-2">
              {formatBytes(summaryData.total_size_bytes)}
            </h2>
          </div>

          <div className="glass-card p-5 rounded-2xl">
            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Smart Folders</p>
            <h2 className="text-3xl font-extrabold text-white mt-2">{folders.length}</h2>
          </div>
        </div>

        {/* Tab Controls (Gmail style) */}
        <div className="border-b border-gray-800 flex gap-6">
          <button
            onClick={() => setActiveTab("overview")}
            className={`pb-4 text-sm font-semibold border-b-2 transition-all ${
              activeTab === "overview"
                ? "border-violet-500 text-violet-400"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            Overview Charts
          </button>
          <button
            onClick={() => setActiveTab("folders")}
            className={`pb-4 text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "folders"
                ? "border-violet-500 text-violet-400"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <FiFolder size={14} />
            Smart App Folders
          </button>
          <button
            onClick={() => setActiveTab("otps")}
            className={`pb-4 text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "otps"
                ? "border-violet-500 text-violet-400"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <FiShield size={14} />
            OTP Cleaner
            {standardOTPs.length > 0 && (
              <span className="bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded text-[10px] font-bold">
                {standardOTPs.length}
              </span>
            )}
          </button>
        </div>

        {/* Overview Tab Content */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Recharts Pie Chart */}
            <div className="glass-panel p-6 rounded-2xl">
              <h3 className="text-base font-bold text-white mb-6">Storage Distribution (by Category)</h3>
              <div className="h-64">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={CATEGORY_COLORS[entry.name] || CATEGORY_COLORS.uncategorized}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1E293B", borderColor: "#475569" }}
                        formatter={(value) => `${value.toFixed(2)} MB`}
                      />
                      <Legend formatter={(value) => <span className="text-xs text-gray-300">{value}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                    No emails synchronized yet. Click "Scan Gmail" above.
                  </div>
                )}
              </div>
            </div>

            {/* Top 5 Biggest Emails */}
            <div className="glass-panel p-6 rounded-2xl">
              <h3 className="text-base font-bold text-white mb-6">Largest Inbox Clutter</h3>
              <div className="space-y-4">
                {summaryData.biggest_emails && summaryData.biggest_emails.length > 0 ? (
                  summaryData.biggest_emails.map((email) => (
                    <div
                      key={email.id}
                      className="glass-card p-4 rounded-xl flex items-center justify-between gap-4 cursor-pointer hover:border-violet-500/25 hover:bg-white/5 transition-all animate-fade-in"
                      onClick={() => handleOpenEmail(email.id)}
                    >
                      <div className="overflow-hidden flex-1">
                        <p className="text-sm font-semibold text-white truncate">{email.subject}</p>
                        <p className="text-xs text-gray-400 mt-1 truncate">{email.sender}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded font-bold font-mono">
                            {formatBytes(email.size_bytes)}
                          </span>
                          <span
                            className="text-[10px] border px-1.5 py-0.5 rounded font-bold"
                            style={{
                              borderColor: CATEGORY_COLORS[email.category] || CATEGORY_COLORS.uncategorized,
                              color: CATEGORY_COLORS[email.category] || CATEGORY_COLORS.uncategorized
                            }}
                          >
                            {email.category}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteEmail(email.id); }}
                        className="text-gray-400 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors shrink-0"
                        title="Delete immediately"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 text-gray-500 text-sm">
                    No matching emails found.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Smart Folders Tab Content */}
        {activeTab === "folders" && (
          <div className="space-y-6">
            {expandedFolder ? (
              <div className="glass-panel p-6 rounded-2xl space-y-6">
                {/* Folder Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-800 pb-4">
                  <div>
                    <button
                      onClick={() => setExpandedFolder(null)}
                      className="text-xs text-violet-400 hover:underline font-bold mb-1 block"
                    >
                      ← Back to Folders
                    </button>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      {expandedFolder.name} Folder
                      <span className="text-xs bg-violet-500/15 text-violet-400 border border-violet-500/25 px-2 py-0.5 rounded-full">
                        {expandedFolder.emails.length} emails
                      </span>
                    </h3>
                  </div>

                  <button
                    onClick={() => handleBulkDeleteFolder(expandedFolder.emails, expandedFolder.name)}
                    className="flex items-center gap-1.5 bg-red-600/90 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md shadow-red-600/10"
                  >
                    <FiTrash2 size={14} />
                    Delete All in Folder ({formatBytes(expandedFolder.size)})
                  </button>
                </div>

                {/* Emails list */}
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                  {expandedFolder.emails.map((email) => (
                    <div
                      key={email.id}
                      className="glass-card p-4 rounded-xl flex items-center justify-between gap-4 cursor-pointer hover:border-violet-500/25 hover:bg-white/5 transition-all"
                      onClick={() => handleOpenEmail(email.id)}
                    >
                      <div className="overflow-hidden flex-1">
                        <p className="text-sm font-semibold text-white truncate">{email.subject}</p>
                        <p className="text-xs text-gray-400 mt-1 truncate">{email.sender}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] text-gray-400 font-mono">{formatBytes(email.size_bytes)}</span>
                          <span className="text-[10px] text-gray-500">•</span>
                          <span className="text-[10px] text-gray-400">{email.date}</span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteEmail(email.id); }}
                        className="text-gray-400 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="responsive-grid">
                {folders.map((folder) => (
                  <div
                    key={folder.name}
                    className="glass-panel p-5 rounded-2xl border border-gray-800 flex flex-col justify-between hover:border-violet-500/30 transition-all cursor-pointer group"
                    onClick={() => setExpandedFolder(folder)}
                  >
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-violet-600/10 border border-violet-500/20 text-violet-400 flex items-center justify-center mb-4 group-hover:bg-violet-600 group-hover:text-white transition-all">
                        <FiFolder size={20} />
                      </div>
                      <h4 className="text-base font-bold text-white group-hover:text-violet-300 transition-colors">
                        {folder.name}
                      </h4>
                      <p className="text-xs text-gray-400 mt-1">{folder.emails.length} messages</p>
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-800/60 pt-4 mt-6">
                      <span className="text-xs font-semibold text-gray-300 font-mono">
                        {formatBytes(folder.size)}
                      </span>
                      <span className="text-xs text-violet-400 group-hover:underline">View emails →</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* OTP Cleaner Tab Content */}
        {activeTab === "otps" && (
          <div className="space-y-6">
            
            {/* Info Banner */}
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-2xl p-4 flex gap-3 text-xs leading-relaxed">
              <FiInfo className="shrink-0 text-amber-400" size={18} />
              <div>
                <span className="font-bold">How OTP Cleaning Works:</span> We separate OTPs into two sections. Standard OTPs (like bank logins or app sign-ups) expire in minutes and can be deleted. Delivery OTPs (Amazon, Flipkart, Myntra) are protected as exceptions because you might need them to verify parcel handovers.
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Standard OTPs */}
              <div className="glass-panel p-6 rounded-2xl flex flex-col">
                <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-4">
                  <div>
                    <h3 className="text-base font-bold text-white">Standard OTPs</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Expired logins & verification OTPs</p>
                  </div>

                  {standardOTPs.length > 0 && (
                    <button
                      onClick={handleBulkDeleteStandardOTPs}
                      className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all shadow-md shadow-red-650/15"
                    >
                      Delete All ({standardOTPs.length})
                    </button>
                  )}
                </div>

                <div className="space-y-3 overflow-y-auto max-h-[350px] pr-2 flex-1">
                  {standardOTPs.length > 0 ? (
                    standardOTPs.map((email) => (
                      <div
                        key={email.id}
                        className="glass-card p-3.5 rounded-xl flex items-center justify-between gap-3 cursor-pointer hover:border-violet-500/25 hover:bg-white/5 transition-all"
                        onClick={() => handleOpenEmail(email.id)}
                      >
                        <div className="overflow-hidden flex-1">
                          <p className="text-xs font-bold text-white truncate">{email.subject}</p>
                          <p className="text-[10px] text-gray-400 truncate mt-0.5">{email.sender}</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteEmail(email.id); }}
                          className="text-gray-400 hover:text-red-400 p-1.5 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-gray-500 text-xs">
                      No standard OTPs pending cleanup!
                    </div>
                  )}
                </div>
              </div>

              {/* Delivery OTP Exceptions */}
              <div className="glass-panel p-6 rounded-2xl flex flex-col">
                <div className="border-b border-gray-800 pb-4 mb-4">
                  <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                    <FiShield className="text-emerald-400" size={16} />
                    Delivery OTP Exceptions
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">Protected parcel handovers (Flipkart, Amazon, Myntra)</p>
                </div>

                <div className="space-y-3 overflow-y-auto max-h-[350px] pr-2 flex-1">
                  {deliveryOTPs.length > 0 ? (
                    deliveryOTPs.map((email) => (
                      <div
                        key={email.id}
                        className="glass-card p-3.5 rounded-xl border-l-2 border-emerald-500 flex items-center justify-between gap-3 bg-emerald-500/5 cursor-pointer hover:border-emerald-400/30 transition-all"
                        onClick={() => handleOpenEmail(email.id)}
                      >
                        <div className="overflow-hidden flex-1">
                          <p className="text-xs font-bold text-emerald-300 truncate">{email.subject}</p>
                          <p className="text-[10px] text-gray-400 truncate mt-0.5">{email.sender}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0">
                            Protected Exception
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteEmail(email.id); }}
                            className="text-gray-400 hover:text-red-400 p-1.5 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                            title="Force delete"
                          >
                            <FiTrash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-gray-500 text-xs">
                      No active parcel delivery OTPs found.
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Email Reader Modal (Gmail Clone View) */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="glass-panel w-full max-w-4xl rounded-3xl border border-gray-800 p-6 flex flex-col max-h-[90vh] overflow-hidden">
              
              {/* Modal Header */}
              <div className="flex justify-between items-start border-b border-gray-800 pb-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <FiMail className="text-violet-400" />
                    Gmail Reader
                  </h3>
                  {selectedEmail && (
                    <p className="text-xs text-gray-400 mt-1">
                      Folder Category: <span className="text-violet-400 font-bold">{selectedEmail.category}</span>
                    </p>
                  )}
                </div>
                <button
                  onClick={() => { setShowModal(false); setSelectedEmail(null); }}
                  className="bg-gray-800 hover:bg-gray-700 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm transition-all"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              {modalLoading ? (
                <div className="flex flex-col items-center justify-center py-24 text-gray-400 space-y-4">
                  <FiRefreshCw className="animate-spin text-violet-500" size={32} />
                  <p className="text-sm font-semibold">Decrypting & Loading Email Body from Gmail...</p>
                </div>
              ) : selectedEmail ? (
                <div className="space-y-6 overflow-y-auto flex-1 pr-2">
                  
                  {/* Sender Metadata details */}
                  <div className="glass-card p-4 rounded-xl border border-gray-800 space-y-2">
                    <h4 className="text-base font-extrabold text-white">{selectedEmail.subject}</h4>
                    <div className="flex justify-between text-xs text-gray-400 flex-wrap gap-2 pt-1">
                      <span>From: <strong className="text-gray-200">{selectedEmail.sender}</strong></span>
                      <span>{selectedEmail.date}</span>
                    </div>
                  </div>

                  {/* Main content display */}
                  <div className="space-y-2">
                    <span className="text-xs text-gray-400 font-bold block uppercase tracking-wider">Email Contents:</span>
                    {selectedEmail.body_html ? (
                      <iframe
                        srcDoc={`
                          <html>
                            <head>
                              <style>
                                body { 
                                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
                                  color: #1f2937; 
                                  background-color: #ffffff; 
                                  margin: 20px; 
                                  font-size: 14px; 
                                  line-height: 1.6; 
                                }
                                a { color: #4f46e5; text-decoration: underline; }
                                img { max-width: 100%; height: auto; }
                              </style>
                            </head>
                            <body>
                              ${selectedEmail.body_html}
                            </body>
                          </html>
                        `}
                        className="w-full h-[400px] border border-gray-800 rounded-xl bg-white"
                        title="gmail-body-content"
                      />
                    ) : (
                      <div className="w-full h-[400px] border border-gray-800 rounded-xl bg-white p-6 text-gray-800 overflow-auto whitespace-pre-wrap font-sans text-sm">
                        {selectedEmail.body_text || "(No text content found in email body)"}
                      </div>
                    )}
                  </div>

                  {/* File Downloads / Attachments */}
                  {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <span className="text-xs text-gray-400 font-bold block uppercase tracking-wider">Attachments to Download:</span>
                      <div className="flex flex-wrap gap-3">
                        {selectedEmail.attachments.map((att, index) => {
                          const downloadUrl = getAttachmentDownloadUrl(selectedEmail.id, att.attachment_id, userId, att.filename);
                          return (
                            <a
                              key={index}
                              href={downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 bg-[#1B2230] border border-gray-800 hover:border-violet-500/50 px-4 py-2.5 rounded-xl text-xs text-violet-400 hover:bg-violet-600 hover:text-white transition-all font-bold"
                            >
                              <FiMail className="shrink-0" />
                              <span>{att.filename}</span>
                              <span className="text-[10px] opacity-75 font-mono">({formatBytes(att.size_bytes)})</span>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Quick Action buttons */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-800/60">
                    <button
                      onClick={() => {
                        handleDeleteEmail(selectedEmail.id);
                        setShowModal(false);
                        setSelectedEmail(null);
                      }}
                      className="flex items-center gap-1.5 bg-red-600/90 hover:bg-red-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md"
                    >
                      <FiTrash2 />
                      Trash Email
                    </button>
                    <button
                      onClick={() => { setShowModal(false); setSelectedEmail(null); }}
                      className="bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all"
                    >
                      Close Reader
                    </button>
                  </div>

                </div>
              ) : (
                <div className="text-center py-24 text-gray-400 text-sm">Failed to load email details.</div>
              )}

            </div>
          </div>
        )}

        {/* Floating Compose Button */}
        <button
          onClick={() => setShowCompose(true)}
          className="fixed bottom-6 right-6 z-40 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-full p-4.5 shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer group"
          title="Compose New Email"
        >
          <FiEdit3 size={24} className="group-hover:rotate-12 transition-transform" />
        </button>

        {/* Docked Compose Box (Gmail style) */}
        {showCompose && (
          <div className="fixed bottom-6 right-6 z-50 w-full max-w-lg bg-[#0E1321] border border-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden glass-panel">
            {/* Header */}
            <div className="bg-[#171D2C] px-4 py-3 flex items-center justify-between border-b border-gray-800/60 flex">
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <FiMail className="text-violet-400" />
                New Message
              </span>
              <button
                onClick={() => setShowCompose(false)}
                className="text-gray-400 hover:text-white font-bold text-sm px-1.5"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSendEmail} className="p-4 space-y-4 flex flex-col flex-1">
              <div>
                <input
                  type="email"
                  placeholder="To (Recipient Email Address)"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  className="w-full bg-[#151A28]/40 border border-gray-800/60 rounded-xl py-2.5 px-4 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
                  required
                />
              </div>
              
              <div>
                <input
                  type="text"
                  placeholder="Subject"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  className="w-full bg-[#151A28]/40 border border-gray-800/60 rounded-xl py-2.5 px-4 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
                  required
                />
              </div>

              <div>
                <textarea
                  placeholder="Write your message here..."
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  className="w-full h-48 bg-[#151A28]/40 border border-gray-800/60 rounded-xl py-3 px-4 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 resize-none font-sans leading-relaxed"
                  required
                />
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCompose(false)}
                  className="bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-750 hover:to-indigo-750 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-md shadow-violet-600/10"
                >
                  {sending ? "Sending..." : "Send Message"}
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}