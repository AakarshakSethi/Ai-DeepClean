import { useState, useEffect, useMemo } from "react";
import { useStorageSummary } from "../hooks/useEmails";
import { listEmails, getEmailDetails, getAttachmentDownloadUrl, sendEmail, aiComposeEmail } from "../api/emails";
import { runSync, runDeepSync } from "../api/sync";
import { approveAction, approveActions } from "../api/cleanup";
import { submitSurvey } from "../api/survey";
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
  FiEdit3,
  FiMaximize2,
  FiMinimize2,
  FiMinus,
  FiPaperclip,
  FiZap,
  FiHardDrive
} from "react-icons/fi";

const CATEGORY_COLORS = {
  Promotions: "#8B5CF6",   // Violet
  Social: "#EC4899",       // Pink
  Updates: "#3B82F6",      // Blue
  Receipts: "#10B981",     // Emerald
  OTP: "#F59E0B",          // Amber
  Important: "#EF4444",    // Red
  Other: "#06B6D4",        // Cyan
  Uncategorized: "#6B7280", // Gray
  uncategorized: "#6B7280" // Gray fallback
};

const getCategoryColor = (categoryName) => {
  if (!categoryName) return CATEGORY_COLORS.uncategorized;
  if (CATEGORY_COLORS[categoryName]) return CATEGORY_COLORS[categoryName];
  if (CATEGORY_COLORS[categoryName.toLowerCase()]) return CATEGORY_COLORS[categoryName.toLowerCase()];
  
  // Generate distinct color using a simple hash
  let hash = 0;
  for (let i = 0; i < categoryName.length; i++) {
    hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 70%, 60%)`;
};

function formatBytes(bytes) {
  if (!bytes) return "0.00 MB";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${mb.toFixed(2)} MB`;
}

function extractMainDomain(sender) {
  const emailMatch = sender.match(/<([^>]+)>/);
  const email = emailMatch ? emailMatch[1] : sender;
  
  const parts = email.split("@");
  if (parts.length < 2) return null;
  
  const host = parts[1].toLowerCase().trim();
  const hostParts = host.split(".");
  if (hostParts.length < 2) return null;
  
  const len = hostParts.length;
  if (len >= 3) {
    const lastTwo = hostParts[len - 2] + "." + hostParts[len - 1];
    const doubleSuffixes = [
      "co.uk", "org.uk", "me.uk", "net.uk", 
      "co.in", "firm.in", "gen.in", "ind.in", 
      "net.in", "org.in", "gov.in", "ac.in", 
      "edu.in", "res.in", "com.co", "net.co", "org.co"
    ];
    if (doubleSuffixes.includes(lastTwo)) {
      return hostParts[len - 3];
    }
  }
  
  return hostParts[len - 2];
}

export default function Dashboard() {
  const userId = localStorage.getItem("deepclean_user_id");
  const userPlan = localStorage.getItem("deepclean_user_plan") || "free";
  const { data: summaryData, loading: summaryLoading, error: summaryError, refetch } = useStorageSummary(userId);

  const [activeTab, setActiveTab] = useState("folders"); // folders | overview | otps
  const [allEmails, setAllEmails] = useState([]);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [deepSyncing, setDeepSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");
  const [syncProgress, setSyncProgress] = useState(0);
  const [scanLimit, setScanLimit] = useState(() => Number(localStorage.getItem("deepclean_default_scan")) || 500);
  const [autoSynced, setAutoSynced] = useState(false);
  const [expandedFolder, setExpandedFolder] = useState(null);
  const [selectedEmailIds, setSelectedEmailIds] = useState([]);

  // Email Reader Modal states
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);

  // Smart folders configuration
  const [smartFolders, setSmartFolders] = useState(() => {
    const saved = localStorage.getItem("deepclean_smart_folders");
    return saved ? JSON.parse(saved) : [
      { id: "linkedin", name: "LinkedIn", keywords: ["linkedin"] },
      { id: "facebook", name: "Facebook", keywords: ["facebook"] },
      { id: "instagram", name: "Instagram", keywords: ["instagram"] },
      { id: "pinterest", name: "Pinterest", keywords: ["pinterest"] },
      { id: "myntra", name: "Myntra", keywords: ["myntra"] },
      { id: "amazon", name: "Amazon", keywords: ["amazon"] },
      { id: "flipkart", name: "Flipkart", keywords: ["flipkart"] },
      { id: "netflix", name: "Netflix", keywords: ["netflix"] },
      { id: "spotify", name: "Spotify", keywords: ["spotify"] },
      { id: "github", name: "GitHub", keywords: ["github"] },
      { id: "google", name: "Google", keywords: ["google", "gmail"] }
    ];
  });
  const [showManageFolders, setShowManageFolders] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderKeywords, setNewFolderKeywords] = useState("");
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [editingFolderName, setEditingFolderName] = useState("");

  // Compose Email states
  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [sending, setSending] = useState(false);
  const [composeSize, setComposeSize] = useState("normal"); // normal | minimized | maximized
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiPrompt, setAIPrompt] = useState("");
  const [aiTone, setAITone] = useState("professional");
  const [aiGenerating, setAIGenerating] = useState(false);
  const [composeAttachments, setComposeAttachments] = useState([]);

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

  const handleLogin = (e) => {
    e.preventDefault();
    if (!email) {
      alert("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    // Redirect to the backend login endpoint to start the Web OAuth flow
    const backendUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
    window.location.href = `${backendUrl}/auth/google/login?user_email=${encodeURIComponent(email)}`;
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
      const res = await sendEmail(userId, composeTo, composeSubject, composeBody, composeAttachments);
      if (res.error) {
        // Save to outbox as Failed
        const outboxEntry = {
          id: `outbox-${Date.now()}`,
          recipient: composeTo,
          subject: composeSubject,
          body: composeBody,
          date: new Date().toLocaleString(),
          attachmentsCount: composeAttachments.length,
          status: "Failed"
        };
        const currentOutbox = JSON.parse(localStorage.getItem("deepclean_outbox_history") || "[]");
        localStorage.setItem("deepclean_outbox_history", JSON.stringify([outboxEntry, ...currentOutbox]));
        alert(res.error);
      } else {
        // Save to outbox as Sent
        const outboxEntry = {
          id: `outbox-${Date.now()}`,
          recipient: composeTo,
          subject: composeSubject,
          body: composeBody,
          date: new Date().toLocaleString(),
          attachmentsCount: composeAttachments.length,
          status: "Sent"
        };
        const currentOutbox = JSON.parse(localStorage.getItem("deepclean_outbox_history") || "[]");
        localStorage.setItem("deepclean_outbox_history", JSON.stringify([outboxEntry, ...currentOutbox]));

        alert("Email sent successfully via Gmail API!");
        setShowCompose(false);
        setComposeTo("");
        setComposeSubject("");
        setComposeBody("");
        setComposeAttachments([]);
        setComposeSize("normal");
        setShowAIPanel(false);
      }
    } catch (err) {
      console.error(err);
      // Save to outbox as Failed
      const outboxEntry = {
        id: `outbox-${Date.now()}`,
        recipient: composeTo,
        subject: composeSubject,
        body: composeBody,
        date: new Date().toLocaleString(),
        attachmentsCount: composeAttachments.length,
        status: "Failed"
      };
      const currentOutbox = JSON.parse(localStorage.getItem("deepclean_outbox_history") || "[]");
      localStorage.setItem("deepclean_outbox_history", JSON.stringify([outboxEntry, ...currentOutbox]));
      alert("Failed to send email. Make sure your Gmail account has been successfully authenticated.");
    } finally {
      setSending(false);
    }
  };

  // File attachments change handler
  const handleComposeFileChange = (e) => {
    const files = Array.from(e.target.files);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setComposeAttachments((prev) => [
          ...prev,
          {
            filename: file.name,
            content: reader.result,
            sizeBytes: file.size,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  // AI draft generator handler
  const handleAIGenerateDraft = async () => {
    if (!aiPrompt.trim()) {
      alert("Please describe what you want the AI to write.");
      return;
    }
    setAIGenerating(true);
    try {
      const res = await aiComposeEmail(aiPrompt, aiTone, composeTo);
      if (res.draft) {
        setComposeBody(res.draft);
        setShowAIPanel(false);
        setAIPrompt("");
      } else {
        alert("Failed to generate AI draft.");
      }
    } catch (err) {
      console.error(err);
      alert("Error occurred while generating AI draft.");
    } finally {
      setAIGenerating(false);
    }
  };

  const handleDeepSync = async () => {
    if (!userId) return;
    try {
      setDeepSyncing(true);
      await runDeepSync(userId);
      alert("Deep scan started! It will process up to 10,000 emails securely in the background. You can continue using the app.");
    } catch (e) {
      console.error(e);
      alert("Failed to start deep scan.");
    } finally {
      setDeepSyncing(false);
    }
  };

  // Sync handler with animated progress bar
  const handleSync = async (isSilent = false) => {
    if (!isSilent) {
      setSyncing(true);
      setSyncProgress(0);
      setSyncStatus("Connecting to Gmail API...");
    }
    
    // Smooth progress bar simulation
    let interval;
    if (!isSilent) {
      interval = setInterval(() => {
        setSyncProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + 10;
        });
      }, 600);
    }

    try {
      if (!isSilent) {
        setSyncStatus(`Syncing your inbox...`);
      }
      
      // If syncing silently in the background, fetch a quick 50 emails.
      // If it's a visible first-time scan, fetch the full scanLimit depth.
      const limitToUse = isSilent ? 50 : scanLimit;
      const res = await runSync(userId, limitToUse);
      
      // Trigger Web Notification for new emails imported
      if (res && res.new_emails && res.new_emails.length > 0) {
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          if (res.new_emails.length <= 3) {
            res.new_emails.forEach((email) => {
              const displayName = email.sender.split("<")[0].trim().replace(/"/g, "") || email.sender;
              new Notification(displayName, {
                body: `${email.subject}\n${email.snippet || ""}`,
                icon: "/favicon.ico"
              });
            });
          } else {
            new Notification("DeepClean Inbox Sync", {
              body: `Synced ${res.synced_new_emails} new emails from your Gmail account!`,
              icon: "/favicon.ico"
            });
          }
        }
      }

      if (!isSilent) {
        clearInterval(interval);
        setSyncProgress(100);
        setSyncStatus(`Sync complete! Synced ${res.synced_new_emails} new emails.`);
        
        setTimeout(() => {
          setSyncing(false);
          refetch();
          fetchAllEmails();
        }, 1500);
      } else {
        refetch();
        fetchAllEmails();
      }
    } catch (e) {
      if (!isSilent) {
        clearInterval(interval);
        setSyncing(false);
        alert("Failed to sync inbox. Make sure Google credentials are valid.");
      } else {
        console.error("Silent background sync failed:", e);
      }
    }
  };

  // Trigger background scan automatically once on dashboard mount
  useEffect(() => {
    // Request permission for HTML5 Web Notifications on mount
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }

    if (userId && !autoSynced) {
      (async () => {
        const emails = await fetchAllEmails();
        const hasLocalEmails = emails && emails.length > 0;
        // If we already have emails in our DB, sync silently in background.
        // If DB is empty, run visible first-time sync.
        await handleSync(hasLocalEmails);
        setAutoSynced(true);
      })();
    }
  }, [userId, autoSynced]);

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

  // Batch delete selected emails
  const handleDeleteSelectedEmails = async () => {
    if (selectedEmailIds.length === 0) return;
    if (
      !window.confirm(
        `Are you sure you want to delete the ${selectedEmailIds.length} selected emails?`
      )
    )
      return;

    try {
      await approveActions(userId, selectedEmailIds, "delete");
      setAllEmails((prev) => prev.filter((e) => !selectedEmailIds.includes(e.id)));
      
      // Update expanded folder emails if in folder view
      setExpandedFolder((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          emails: prev.emails.filter((e) => !selectedEmailIds.includes(e.id)),
        };
      });
      
      setSelectedEmailIds([]);
      refetch();
    } catch (e) {
      console.error(e);
    }
  };

  // Quick categorize handler for uncategorized recent emails
  const handleCategorizeEmail = async (emailId, category) => {
    try {
      await submitSurvey(userId, emailId, null, category, "keep");
      alert(`Email successfully categorized as "${category}" and moved to Gmail label!`);
      refetch();
      fetchAllEmails();
    } catch (e) {
      console.error(e);
      alert("Failed to categorize email. Try again.");
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
      const emailIds = folderEmails.map((e) => e.id);
      await approveActions(userId, emailIds, "delete");
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
      const emailIds = cleanable.map((e) => e.id);
      await approveActions(userId, emailIds, "delete");
      setAllEmails((prev) => prev.filter((e) => !cleanable.some((c) => c.id === e.id)));
      refetch();
    } catch (e) {
      console.error(e);
    }
  };

  // Grouping logic for smart folders
  const getBrandFolders = () => {
    const groups = {};
    
    // Always initialize Large Emails folder
    groups["Large Emails"] = { name: "Large Emails", emails: [], size: 0, isLargeFiles: true };

    allEmails.forEach((email) => {
      let brand = email.category;
      if (!brand || brand.toLowerCase() === "uncategorized") {
        const mainDom = extractMainDomain(email.sender);
        brand = mainDom ? mainDom.charAt(0).toUpperCase() + mainDom.slice(1) : "Other";
      }

      if (!groups[brand]) {
        groups[brand] = { name: brand, emails: [], size: 0 };
      }
      
      // Prevent duplicates if bulk actions triggered multiple updates
      if (!groups[brand].emails.some(e => e.id === email.id)) {
        groups[brand].emails.push(email);
        groups[brand].size += email.size_bytes;
      }

      // Add to Large Emails if size > 1MB
      if (email.size_bytes > 1024 * 1024) {
        if (!groups["Large Emails"].emails.some(e => e.id === email.id)) {
          groups["Large Emails"].emails.push(email);
          groups["Large Emails"].size += email.size_bytes;
        }
      }
    });

    if (groups["Large Emails"].emails.length === 0) {
      delete groups["Large Emails"];
    }

    const sorted = Object.values(groups).sort((a, b) => b.size - a.size);
    const largeFolder = sorted.find(g => g.isLargeFiles);
    
    if (largeFolder) {
      return [largeFolder, ...sorted.filter(g => !g.isLargeFiles)];
    }
    
    return sorted;
  };

  // Memoize heavy calculations to prevent mobile UI freezing on re-renders
  const { folders, standardOTPs, deliveryOTPs } = useMemo(() => {
    const f = getBrandFolders();
    const sOTPs = allEmails.filter((e) => e.category === "OTP" && !e.is_order_otp_exception);
    const dOTPs = allEmails.filter((e) => e.category === "OTP" && e.is_order_otp_exception);
    return { folders: f, standardOTPs: sOTPs, deliveryOTPs: dOTPs };
  }, [allEmails]);

  const handleChartClick = (entry) => {
    if (!entry || !entry.name) return;
    const folder = folders.find(f => f.name === entry.name);
    if (folder) {
      setActiveTab("folders");
      setExpandedFolder(folder);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
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

  // Prepping pie chart data - filter out zero/negligible categories (< 10 KB) and sort largest first
  let pieData = Object.entries(summaryData.size_by_category || {})
    .map(([name, value]) => ({
      name,
      value: value / (1024 * 1024) // in MB
    }))
    .filter((item) => item.value > 0.01)
    .sort((a, b) => b.value - a.value);

  if (pieData.length > 6) {
    const top5 = pieData.slice(0, 5);
    const otherValue = pieData.slice(5).reduce((acc, curr) => acc + curr.value, 0);
    pieData = [...top5, { name: "Other", value: otherValue }];
  }

  let limitBytes = (summaryData.real_limit_bytes !== undefined && summaryData.real_limit_bytes !== null) ? summaryData.real_limit_bytes : (15 * 1024 * 1024 * 1024);
  const isUnlimited = limitBytes === -1;
  
  const usageBytes = summaryData.real_usage_bytes !== null && summaryData.real_usage_bytes !== undefined 
    ? summaryData.real_usage_bytes 
    : (summaryData.total_size_bytes || 0);
    
  const usagePercent = isUnlimited ? 0 : Math.max(Math.round((usageBytes / limitBytes) * 100), 1);
  
  const limitGB = isUnlimited ? "Unlimited" : (limitBytes / (1024 * 1024 * 1024)).toFixed(0);
  const usageGB = (usageBytes / (1024 * 1024 * 1024)).toFixed(1);
  const isHighUsage = !isUnlimited && usagePercent >= 80;

  const renderComposeWindow = () => {
    if (!showCompose) return null;
    
    // 1. Minimized View Capsule
    if (composeSize === "minimized") {
      return (
        <div className="fixed bottom-6 right-6 z-50 w-72 bg-[#0E1321] border border-gray-800 rounded-xl shadow-2xl overflow-hidden glass-panel animate-fade-in">
          <div className="bg-[#171D2C] px-4 py-3 flex items-center justify-between select-none">
            <span
              className="text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer hover:text-violet-400 truncate max-w-[180px]"
              onClick={() => setComposeSize("normal")}
            >
              <FiMail className="text-violet-400 animate-pulse shrink-0" />
              {composeSubject || "New Message"}
            </span>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setComposeSize("normal")}
                className="text-gray-400 hover:text-white transition-colors"
                title="Restore"
              >
                <FiMaximize2 size={12} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCompose(false);
                  setComposeSize("normal");
                  setComposeAttachments([]);
                  setShowAIPanel(false);
                }}
                className="text-gray-400 hover:text-white text-xs font-bold px-1"
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      );
    }

    // 2. Normal & Maximized Views
    const isMax = composeSize === "maximized";
    
    const composeContent = (
      <div className={`bg-[#0E1321] border border-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden glass-panel ${
        isMax ? "w-full max-w-4xl h-[85vh] animate-fade-in" : "w-full max-w-lg animate-fade-in"
      }`}>
        {/* Header */}
        <div className="bg-[#171D2C] px-4 py-3 flex items-center justify-between border-b border-gray-800/60 select-none">
          <span className="text-sm font-bold text-white flex items-center gap-2">
            <FiMail className="text-violet-400" />
            New Message
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setComposeSize("minimized")}
              className="text-gray-400 hover:text-white transition-colors"
              title="Minimize"
            >
              <FiMinus size={14} />
            </button>
            <button
              type="button"
              onClick={() => setComposeSize(isMax ? "normal" : "maximized")}
              className="text-gray-400 hover:text-white transition-colors"
              title={isMax ? "Restore Size" : "Fullscreen"}
            >
              {isMax ? <FiMinimize2 size={14} /> : <FiMaximize2 size={14} />}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCompose(false);
                setComposeSize("normal");
                setComposeAttachments([]);
                setShowAIPanel(false);
              }}
              className="text-gray-400 hover:text-white font-bold text-sm px-1.5"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSendEmail} className="p-4 space-y-4 flex flex-col flex-1 overflow-y-auto">
          {/* To Field */}
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
          
          {/* Subject Field */}
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

          {/* AI Toggle Bar */}
          <div className="flex items-center justify-between border-b border-gray-850 pb-2">
            <span className="text-[11px] text-gray-500 font-medium">Compose Tools</span>
            <button
              type="button"
              onClick={() => setShowAIPanel(!showAIPanel)}
              className={`flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all ${
                showAIPanel
                  ? "bg-violet-600/20 text-violet-300 border-violet-500/50 shadow-md shadow-violet-500/10"
                  : "bg-violet-600/10 text-violet-400 border-violet-500/25 hover:bg-violet-600/20"
              }`}
            >
              <FiZap size={11} className={aiGenerating ? "animate-pulse" : ""} />
              ✨ Write with Gemini AI
            </button>
          </div>

          {/* AI Panel Block */}
          {showAIPanel && (
            <div className="bg-[#151A28]/85 border border-violet-500/25 rounded-xl p-4 space-y-3 animate-fade-in shadow-inner">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-violet-400 flex items-center gap-1">
                  <FiZap size={13} />
                  AI Writing Assistant
                </span>
                <button
                  type="button"
                  onClick={() => setShowAIPanel(false)}
                  className="text-gray-500 hover:text-white text-xs px-1"
                >
                  ✕
                </button>
              </div>
              
              <textarea
                placeholder="Describe what you want the AI to write... (e.g. 'Ask for sick leave tomorrow due to back pain')"
                value={aiPrompt}
                onChange={(e) => setAIPrompt(e.target.value)}
                className="w-full bg-[#0E1321] border border-gray-800 rounded-lg p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 resize-none h-16 leading-relaxed"
              />
              
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 font-semibold">Tone:</span>
                  <select
                    value={aiTone}
                    onChange={(e) => setAITone(e.target.value)}
                    className="bg-[#0E1321] border border-gray-800 text-[10px] text-violet-400 font-bold px-2 py-0.5 rounded cursor-pointer"
                  >
                    <option value="professional">Professional</option>
                    <option value="casual">Casual</option>
                    <option value="urgent">Urgent</option>
                    <option value="apologetic">Apologetic</option>
                  </select>
                </div>
                
                <button
                  type="button"
                  disabled={aiGenerating}
                  onClick={handleAIGenerateDraft}
                  className="bg-violet-600 hover:bg-violet-750 text-white text-[10px] font-bold px-4 py-1.5 rounded-lg transition-all flex items-center gap-1.5"
                >
                  {aiGenerating ? (
                    <>
                      <FiRefreshCw size={10} className="animate-spin" />
                      Writing...
                    </>
                  ) : (
                    <>
                      <FiZap size={10} />
                      Generate Draft
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Email Body textarea */}
          <div className="flex-1 flex flex-col min-h-[150px]">
            <textarea
              placeholder="Write your message here..."
              value={composeBody}
              onChange={(e) => setComposeBody(e.target.value)}
              className={`w-full bg-[#151A28]/40 border border-gray-800/60 rounded-xl py-3 px-4 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 resize-none font-sans leading-relaxed flex-1 ${
                isMax ? "h-[300px]" : "h-48"
              }`}
              required
            />
          </div>

          {/* Attachment list view */}
          {composeAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2 py-1 max-h-24 overflow-y-auto border-t border-gray-850 pt-2">
              {composeAttachments.map((att, idx) => (
                <div key={idx} className="flex items-center gap-1.5 bg-[#1B2230] border border-gray-800 px-2.5 py-1 rounded-lg text-[10px] text-gray-300">
                  <FiPaperclip size={10} className="text-gray-400 shrink-0" />
                  <span className="truncate max-w-[150px] font-semibold">{att.filename}</span>
                  <span className="text-gray-505 font-mono">({formatBytes(att.sizeBytes)})</span>
                  <button
                    type="button"
                    onClick={() => setComposeAttachments(prev => prev.filter((_, i) => i !== idx))}
                    className="text-red-400 hover:text-red-500 font-bold ml-1.5"
                    title="Remove attachment"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Footer Controls (Send, Attachments, Formatting) */}
          <div className="flex items-center justify-between border-t border-gray-800/60 pt-4 mt-2 select-none flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              {/* File upload clicker */}
              <button
                type="button"
                onClick={() => document.getElementById("compose-file-input").click()}
                className="p-2.5 rounded-xl hover:bg-white/5 border border-gray-800 hover:border-gray-700 text-gray-400 hover:text-white transition-all"
                title="Attach Files"
              >
                <FiPaperclip size={14} />
              </button>
              <input
                type="file"
                multiple
                id="compose-file-input"
                onChange={handleComposeFileChange}
                style={{ display: "none" }}
              />
              
              {/* Formatting Toolbar */}
              <div className="flex items-center bg-[#151A28] border border-gray-850 px-2.5 py-1 rounded-xl text-xs font-bold text-gray-400 gap-3 font-mono">
                <button type="button" className="hover:text-white px-0.5" title="Bold">B</button>
                <button type="button" className="hover:text-white px-0.5" title="Italic">I</button>
                <button type="button" className="hover:text-white px-0.5" title="Underline">U</button>
                <button type="button" className="hover:text-white px-0.5" title="Insert Link">🔗</button>
              </div>
            </div>
            
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowCompose(false);
                  setComposeAttachments([]);
                  setComposeSize("normal");
                  setShowAIPanel(false);
                }}
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
          </div>
        </form>
      </div>
    );

    if (isMax) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          {composeContent}
        </div>
      );
    }

    return (
      <div className="fixed bottom-6 right-6 z-50 w-full max-w-lg">
        {composeContent}
      </div>
    );
  };

  const senderName = selectedEmail?.sender || "(unknown sender)";
  const cleanSenderName = senderName.split("<")[0].trim() || senderName;
  const senderEmailAddress = senderName.includes("<") ? `<${senderName.split("<")[1].replace(">", "")}>` : "";

  return (
    <DashboardLayout>
      <div className="space-y-8 relative">
        
        {/* Storage Quota Warning Card (Google-style Alert) */}
        <div className={`glass-panel p-6 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-6 ${
          isHighUsage ? "border-red-500/25 bg-red-500/5" : "border-violet-500/25 bg-violet-500/5"
        }`}>
          <div className="space-y-1 text-center md:text-left">
            <h3 className="text-base font-bold text-white flex items-center gap-2 justify-center md:justify-start">
              {isHighUsage ? (
                <FiAlertTriangle className="text-red-400 animate-pulse" size={20} />
              ) : (
                <FiHardDrive className="text-violet-400" size={20} />
              )}
              Gmail Storage Quota ({usagePercent}% Full)
            </h3>
            <p className="text-xs text-gray-400 max-w-lg leading-relaxed">
              {isHighUsage 
                ? `Your Google Account is using ${formatBytes(usageBytes)} of your ${isUnlimited ? "Unlimited" : limitGB + " GB"} shared storage. If you reach 100%, you will not be able to receive new emails. Use DeepClean below to clear space!`
                : `Your Google Account is using ${formatBytes(usageBytes)} of your ${isUnlimited ? "Unlimited" : limitGB + " GB"} shared storage. Keep your inbox clean to stay far below your storage limit.`}
            </p>

          </div>
          <div className="w-full md:w-64 space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-gray-300">{formatBytes(usageBytes)} used</span>
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
            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Total Inbox Emails</p>
            <h2 className="text-3xl font-extrabold text-white mt-2">
              {summaryData.total_gmail_emails ? summaryData.total_gmail_emails.toLocaleString() : summaryData.emails_scanned}
            </h2>
          </div>

          <div className="glass-card p-5 rounded-2xl">
            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider font-sans">Gmail Storage Used</p>
            <h2 className="text-3xl font-extrabold text-white mt-2">
              {summaryData.real_usage_bytes !== null && summaryData.real_usage_bytes !== undefined
                ? formatBytes(summaryData.real_usage_bytes)
                : formatBytes(summaryData.total_size_bytes)}
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
          <div className="space-y-8 animate-fade-in">
            
            {/* Recent Emails Section (ON TOP!) */}
            <div className="glass-panel p-6 rounded-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FiMail className="text-violet-400" />
                  Recent Inbox Emails (Last 15)
                </h3>
                <span className="text-xs text-gray-550 font-bold bg-[#151A28] border border-gray-850 px-3 py-1 rounded-full select-none">
                  {summaryData && summaryData.total_gmail_emails !== undefined && summaryData.total_gmail_emails !== null
                    ? `${summaryData.total_gmail_emails.toLocaleString()} total emails`
                    : `${allEmails.length} synced`}
                </span>
              </div>
              
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {allEmails.length > 0 ? (
                  [...allEmails]
                    .sort((a, b) => {
                      const dateA = new Date(a.date);
                      const dateB = new Date(b.date);
                      const timeA = isNaN(dateA.getTime()) ? 0 : dateA.getTime();
                      const timeB = isNaN(dateB.getTime()) ? 0 : dateB.getTime();
                      return timeB - timeA;
                    })
                    .slice(0, 15)
                    .map((email) => (
                      <div
                        key={email.id}
                        className="glass-card p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:border-violet-500/25 hover:bg-white/5 transition-all"
                        onClick={() => handleOpenEmail(email.id)}
                      >
                        <div className="overflow-hidden flex-1">
                          <div className="flex items-start sm:items-center gap-2 flex-col sm:flex-row flex-wrap">
                            <span className="text-sm font-semibold text-white truncate max-w-xs md:max-w-md block">
                              {email.subject}
                            </span>
                            
                            {email.category === "uncategorized" ? (
                              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider block shrink-0">
                                  Uncategorized
                                </span>
                                <select
                                  onChange={(e) => {
                                    const cat = e.target.value;
                                    if (cat) handleCategorizeEmail(email.id, cat);
                                  }}
                                  className="bg-[#151A28] border border-gray-850 text-[9px] text-violet-400 font-bold px-2 py-0.5 rounded focus:outline-none focus:border-violet-500 cursor-pointer"
                                  defaultValue=""
                                >
                                  <option value="" disabled>Categorize (Train AI)...</option>
                                  <option value="Promotions">Promotions</option>
                                  <option value="Social">Social</option>
                                  <option value="Updates">Updates</option>
                                  <option value="Receipts">Receipts</option>
                                  <option value="OTP">OTP</option>
                                </select>
                              </div>
                            ) : (
                              <span
                                className="text-[9px] border px-1.5 py-0.5 rounded font-bold uppercase tracking-wider block w-fit shrink-0"
                                style={{
                                  borderColor: getCategoryColor(email.category),
                                  color: getCategoryColor(email.category)
                                }}
                              >
                                {email.category}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-1 truncate">{email.sender}</p>
                          <p className="text-[10px] text-gray-500 mt-1">{email.date}</p>
                        </div>
                        
                        <div className="flex items-center gap-4 justify-between sm:justify-end shrink-0 border-t border-gray-800/40 sm:border-0 pt-3 sm:pt-0">
                          <span className="text-[10px] bg-gray-800 border border-gray-700 text-gray-350 px-2 py-0.5 rounded font-bold font-mono">
                            {formatBytes(email.size_bytes)}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteEmail(email.id); }}
                            className="text-gray-400 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                            title="Delete immediately"
                          >
                            <FiTrash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="text-center py-12 text-gray-500 text-sm">
                    No emails synchronized yet. Click "Scan Gmail" above.
                  </div>
                )}
              </div>
            </div>

            {/* Charts & Largest Clutter Grid (ON BOTTOM!) */}
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
                          onClick={handleChartClick}
                        >
                          {pieData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={getCategoryColor(entry.name)}
                              className="cursor-pointer hover:opacity-80 transition-opacity outline-none"
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
                        className="glass-card p-4 rounded-xl flex items-center justify-between gap-4 cursor-pointer hover:border-violet-500/25 hover:bg-white/5 transition-all"
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
                                borderColor: getCategoryColor(email.category),
                                color: getCategoryColor(email.category)
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

          </div>
        )}

        {/* Smart Folders Tab Content */}
        {activeTab === "folders" && (
          <div className="space-y-6">
            {!expandedFolder && (
              <div className="flex justify-between items-center bg-[#151A28]/45 border border-gray-800 p-4 rounded-2xl flex-wrap gap-4 select-none">
                <div>
                  <h3 className="text-base font-bold text-white">Smart Brand Folders</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Define your own matching rules to categorize emails automatically</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleDeepSync}
                    disabled={deepSyncing}
                    className={`bg-blue-600/10 text-blue-400 border border-blue-500/25 hover:bg-blue-600/20 text-xs font-bold px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${deepSyncing ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {deepSyncing ? "🔄 Deep Scanning..." : "🔍 Full Inbox Deep Scan"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowManageFolders(true)}
                    className="bg-violet-600/10 text-violet-400 border border-violet-500/25 hover:bg-violet-600/20 text-xs font-bold px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    ⚙️ Manage Folders & Rules
                  </button>
                </div>
              </div>
            )}
            {expandedFolder ? (
               <div className="glass-panel p-6 rounded-2xl space-y-6">
                {/* Folder Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-800 pb-4">
                  <div>
                    <button
                      onClick={() => {
                        setExpandedFolder(null);
                        setSelectedEmailIds([]);
                      }}
                      className="text-xs text-violet-400 hover:underline font-bold mb-1 block"
                    >
                      ← Back to Folders
                    </button>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2 flex-wrap">
                      <span>{expandedFolder.name} Folder</span>
                      <button
                        type="button"
                        onClick={() => {
                          const name = prompt(`Enter new name for "${expandedFolder.name}" folder:`);
                          if (!name || !name.trim()) return;
                          const trimmedName = name.trim();
                          const id = expandedFolder.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
                          
                          setSmartFolders((prev) => {
                            const updated = prev.map((f) => {
                              if (f.name.toLowerCase() === expandedFolder.name.toLowerCase() || f.id === id) {
                                return { ...f, name: trimmedName };
                              }
                              return f;
                            });
                            
                            const folderExists = prev.some(f => f.name.toLowerCase() === expandedFolder.name.toLowerCase() || f.id === id);
                            let finalUpdated = updated;
                            if (!folderExists) {
                              const newId = trimmedName.toLowerCase().replace(/[^a-z0-9]/g, "-");
                              finalUpdated = [...prev, { id: newId, name: trimmedName, keywords: [newId] }];
                            }
                            
                            localStorage.setItem("deepclean_smart_folders", JSON.stringify(finalUpdated));
                            setExpandedFolder((prevEx) => ({ ...prevEx, name: trimmedName }));
                            return finalUpdated;
                          });
                          alert(`Folder successfully renamed to "${trimmedName}"!`);
                        }}
                        className="text-[10px] text-violet-400 hover:text-violet-300 font-bold bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-lg transition-all cursor-pointer flex items-center gap-0.5"
                        title="Rename this smart folder"
                      >
                        ✏️ Rename
                      </button>
                      <span className="text-xs bg-violet-500/15 text-violet-400 border border-violet-500/25 px-2 py-0.5 rounded-full">
                        {expandedFolder.emails.length} emails
                      </span>
                    </h3>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    {selectedEmailIds.length > 0 && (
                      <button
                        onClick={handleDeleteSelectedEmails}
                        className="flex items-center justify-center gap-1.5 bg-red-650/20 hover:bg-red-600 border border-red-500/25 text-red-400 hover:text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md"
                      >
                        <FiTrash2 size={14} />
                        Delete Selected ({selectedEmailIds.length})
                      </button>
                    )}
                    
                    <button
                      onClick={() => handleBulkDeleteFolder(expandedFolder.emails, expandedFolder.name)}
                      className="flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md shadow-red-600/10"
                    >
                      <FiTrash2 size={14} />
                      Delete All in Folder ({formatBytes(expandedFolder.size)})
                    </button>
                  </div>
                </div>

                {/* Select All Toggle */}
                {expandedFolder.emails.length > 0 && (
                  <div className="flex items-center px-2 py-1">
                    <label className="flex items-center gap-2.5 cursor-pointer text-xs text-gray-400 hover:text-white">
                      <input
                        type="checkbox"
                        checked={
                          selectedEmailIds.length === expandedFolder.emails.length &&
                          expandedFolder.emails.length > 0
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEmailIds(expandedFolder.emails.map((email) => email.id));
                          } else {
                            setSelectedEmailIds([]);
                          }
                        }}
                        className="rounded bg-[#151A28] border-gray-850 text-violet-600 w-4 h-4 cursor-pointer focus:ring-violet-500 focus:ring-offset-0"
                      />
                      <span className="font-semibold">Select All Emails</span>
                    </label>
                  </div>
                )}

                {/* Emails list */}
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                  {expandedFolder.emails.map((email) => {
                    const isSelected = selectedEmailIds.includes(email.id);
                    
                    return (
                      <div
                        key={email.id}
                        className={`glass-card p-4 rounded-xl flex items-center justify-between gap-4 cursor-pointer hover:border-violet-500/25 hover:bg-white/5 transition-all ${
                          isSelected ? "border-violet-500/40 bg-violet-500/5" : ""
                        }`}
                        onClick={() => handleOpenEmail(email.id)}
                      >
                        <div className="flex items-center flex-1 overflow-hidden">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedEmailIds([...selectedEmailIds, email.id]);
                              } else {
                                setSelectedEmailIds(selectedEmailIds.filter((id) => id !== email.id));
                              }
                            }}
                            className="rounded bg-[#151A28] border-gray-850 text-violet-600 w-4 h-4 cursor-pointer focus:ring-violet-500 focus:ring-offset-0 mr-4 shrink-0"
                          />
                          
                          <div className="overflow-hidden">
                            <p className="text-sm font-semibold text-white truncate">{email.subject}</p>
                            <p className="text-xs text-gray-400 mt-1 truncate">{email.sender}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-[10px] text-gray-400 font-mono">{formatBytes(email.size_bytes)}</span>
                              <span className="text-[10px] text-gray-500">•</span>
                              <span className="text-[10px] text-gray-400">{email.date}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteEmail(email.id); }}
                          className="text-gray-400 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors shrink-0"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#FFFFFF] text-[#202124] w-full max-w-4xl rounded-2xl flex flex-col max-h-[92vh] overflow-hidden shadow-2xl border border-gray-300">
              
              {/* Gmail top control bar */}
              <div className="bg-[#F2F6FC] px-6 py-3 flex justify-between items-center border-b border-gray-250 select-none">
                <div className="flex items-center gap-4 relative">
                  {selectedEmail && (
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setShowCategoryMenu(!showCategoryMenu)}
                        className="text-xs font-bold text-gray-700 bg-gray-200 hover:bg-gray-300 border border-gray-350 rounded-lg px-3.5 py-1.8 uppercase tracking-wider flex items-center gap-1.5 cursor-pointer font-mono shadow-sm transition-all"
                      >
                        Folder: {selectedEmail.category || "Uncategorized"}
                        <span className="text-[10px] text-gray-500">▼</span>
                      </button>
                      
                      {showCategoryMenu && (
                        <div className="absolute left-0 mt-1.5 w-56 bg-white border border-gray-250 rounded-xl shadow-2xl z-50 overflow-hidden font-sans text-xs animate-fade-in py-1">
                          <div className="text-[9px] text-gray-400 font-bold px-3 py-1.5 uppercase border-b border-gray-100 select-none">
                            Move to Smart Folder
                          </div>
                          <div className="max-h-[280px] overflow-y-auto">
                            {[
                              "Uncategorized", 
                              ...smartFolders.map((f) => f.name),
                              "Receipts", 
                              "OTP", 
                              "Promotions", 
                              "Updates"
                            ].map((cat) => {
                              const isSelected = selectedEmail.category && selectedEmail.category.toLowerCase() === cat.toLowerCase();
                              return (
                                <button
                                  key={cat}
                                  type="button"
                                  onClick={async () => {
                                    setShowCategoryMenu(false);
                                    try {
                                      await submitSurvey(userId, selectedEmail.id, null, cat, "keep");
                                      setSelectedEmail((prev) => ({ ...prev, category: cat }));
                                      alert(`Email categorized as "${cat}" and moved successfully!`);
                                      refetch();
                                      fetchAllEmails();
                                    } catch (err) {
                                      console.error(err);
                                      alert("Failed to categorize email.");
                                    }
                                  }}
                                  className={`w-full text-left px-3.5 py-2 hover:bg-violet-50 transition-colors flex items-center justify-between ${
                                    isSelected ? "text-violet-600 font-bold bg-violet-50/70" : "text-[#202124]"
                                  }`}
                                >
                                  <span>{cat}</span>
                                  {isSelected && <span className="text-[10px] text-violet-600">✓</span>}
                                </button>
                              );
                            })}
                          </div>
                          
                          <div className="border-t border-gray-150 mt-1 pt-1 bg-gray-50/50">
                            <button
                              type="button"
                              onClick={async () => {
                                const name = prompt("Enter name for new Smart Folder:");
                                if (!name || !name.trim()) return;
                                const trimmedName = name.trim();
                                const id = trimmedName.toLowerCase().replace(/[^a-z0-9]/g, "-");
                                
                                if (smartFolders.some((f) => f.id === id)) {
                                  alert("A smart folder with this name already exists.");
                                  return;
                                }
                                
                                const newFolder = { id, name: trimmedName, keywords: [id] };
                                const updated = [...smartFolders, newFolder];
                                setSmartFolders(updated);
                                localStorage.setItem("deepclean_smart_folders", JSON.stringify(updated));
                                
                                // Immediately categorize and move the email to this new folder
                                setShowCategoryMenu(false);
                                try {
                                  await submitSurvey(userId, selectedEmail.id, null, trimmedName, "keep");
                                  setSelectedEmail((prev) => ({ ...prev, category: trimmedName }));
                                  alert(`Smart Folder "${trimmedName}" created and email moved successfully!`);
                                  refetch();
                                  fetchAllEmails();
                                } catch (err) {
                                  console.error(err);
                                  alert("Folder created, but failed to move email.");
                                }
                              }}
                              className="w-full text-left px-3.5 py-2 text-violet-600 hover:bg-violet-50 transition-colors flex items-center gap-1 font-bold cursor-pointer text-xs"
                            >
                              ➕ Create Smart Folder...
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <span className="text-[11px] text-gray-500 hidden sm:inline">
                    DeepClean Smart Reader
                  </span>
                </div>
                
                <div className="flex items-center gap-3">
                  {selectedEmail && (
                    <button
                      onClick={() => {
                        handleDeleteEmail(selectedEmail.id);
                        setShowModal(false);
                        setSelectedEmail(null);
                      }}
                      title="Move to Bin"
                      className="p-1.5 rounded-full hover:bg-gray-200 text-gray-600 transition-colors"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => { setShowModal(false); setSelectedEmail(null); }}
                    className="p-1 rounded-full hover:bg-gray-200 text-gray-700 transition-colors font-bold text-sm w-7 h-7 flex items-center justify-center"
                    title="Close"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              {modalLoading ? (
                <div className="flex flex-col items-center justify-center py-28 text-gray-500 space-y-4">
                  <FiRefreshCw className="animate-spin text-violet-600" size={32} />
                  <p className="text-sm font-semibold">Fetching raw message body from Google servers...</p>
                </div>
              ) : selectedEmail ? (
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-white">
                  
                  {/* Email Subject Header */}
                  <div className="border-b border-gray-150 pb-4">
                    <h2 className="text-lg md:text-xl font-medium text-[#202124] leading-snug">
                      {selectedEmail.subject}
                    </h2>
                  </div>

                  {/* Sender Metadata (Gmail Thread Header style) */}
                  <div className="flex items-start gap-4">
                    {/* Circle Avatar */}
                    <div className="w-10 h-10 rounded-full bg-violet-600 text-white flex items-center justify-center font-bold text-base shrink-0 select-none">
                      {(cleanSenderName || "U")[0].toUpperCase()}
                    </div>
                    
                    {/* Sender text details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <p className="text-xs md:text-sm text-[#202124] truncate">
                          <strong className="font-semibold">{cleanSenderName}</strong>
                          <span className="text-gray-500 font-normal ml-1">
                            {senderEmailAddress}
                          </span>
                        </p>
                        <span className="text-[11px] text-gray-500 shrink-0 font-normal">
                          {selectedEmail.date}
                        </span>
                      </div>
                      
                      <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1 select-none">
                        to me 
                        <span className="text-[9px]">▼</span>
                      </p>
                    </div>
                  </div>

                  {/* Main Content Display Area */}
                  <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                    {selectedEmail.body_html ? (
                      <iframe
                        srcDoc={`
                          <!DOCTYPE html>
                          <html>
                            <head>
                              <style>
                                body { 
                                  font-family: Roboto, RobotoDraft, Helvetica, Arial, sans-serif; 
                                  color: #202124; 
                                  background-color: #ffffff; 
                                  margin: 24px; 
                                  font-size: 14px; 
                                  line-height: 1.5; 
                                }
                                a { color: #1a73e8; text-decoration: none; }
                                a:hover { text-decoration: underline; }
                                img { max-width: 100%; height: auto; }
                              </style>
                            </head>
                            <body>
                              ${selectedEmail.body_html}
                            </body>
                          </html>
                        `}
                        className="w-full h-[380px] border-0 bg-white"
                        title="gmail-body-content"
                      />
                    ) : (
                      <div className="w-full h-[380px] p-6 text-[#202124] overflow-auto whitespace-pre-wrap font-sans text-xs leading-relaxed">
                        {selectedEmail.body_text || "(No text content found in email body)"}
                      </div>
                    )}
                  </div>

                  {/* Gmail Attachment Chips */}
                  {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-gray-150">
                      <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider block">Attachments:</span>
                      <div className="flex flex-wrap gap-3">
                        {selectedEmail.attachments.map((att, index) => {
                          const downloadUrl = getAttachmentDownloadUrl(selectedEmail.id, att.attachment_id, userId, att.filename);
                          return (
                            <a
                              key={index}
                              href={downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 bg-[#F2F6FC] hover:bg-[#EAF1FB] border border-gray-250 hover:border-gray-400 px-4 py-2.5 rounded-lg text-xs text-[#1a73e8] hover:text-[#0b57d0] transition-all font-semibold"
                            >
                              <FiMail className="shrink-0 text-gray-500" />
                              <span className="truncate max-w-xs">{att.filename}</span>
                              <span className="text-[9px] text-gray-500 font-mono">({formatBytes(att.size_bytes)})</span>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Gmail Thread footer (Reply / Forward options) */}
                  <div className="flex justify-start gap-3 pt-6 border-t border-gray-150">
                    <button
                      onClick={() => {
                        // Extract email from "Name <email@address.com>" if formatted that way
                        const emailMatch = selectedEmail.sender.match(/<([^>]+)>/);
                        const recipient = emailMatch ? emailMatch[1] : selectedEmail.sender;
                        
                        setComposeTo(recipient);
                        setComposeSubject(`Re: ${selectedEmail.subject}`);
                        setComposeBody(`\n\nOn ${selectedEmail.date}, ${selectedEmail.sender} wrote:\n> `);
                        setShowCompose(true);
                        setShowModal(false);
                        setSelectedEmail(null);
                      }}
                      className="flex items-center gap-1.5 border border-gray-350 hover:border-gray-500 hover:bg-gray-50 text-gray-700 text-xs font-semibold px-5 py-2.5 rounded-full transition-all"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-500 shrink-0">
                        <path d="M9 14L4 9l5-5" />
                        <path d="M4 9h10c3.87 0 7 3.13 7 7s-3.13 7-7 7" />
                      </svg>
                      Reply
                    </button>
                    
                    <button
                      onClick={() => {
                        setComposeTo("");
                        setComposeSubject(`Fwd: ${selectedEmail.subject}`);
                        setComposeBody(`\n\n---------- Forwarded message ---------\nFrom: ${selectedEmail.sender}\nDate: ${selectedEmail.date}\nSubject: ${selectedEmail.subject}\n\n`);
                        setShowCompose(true);
                        setShowModal(false);
                        setSelectedEmail(null);
                      }}
                      className="flex items-center gap-1.5 border border-gray-350 hover:border-gray-500 hover:bg-gray-50 text-gray-700 text-xs font-semibold px-5 py-2.5 rounded-full transition-all"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-500 shrink-0">
                        <path d="M15 14l5-5-5-5" />
                        <path d="M20 9H10c-3.87 0-7 3.13-7 7s3.13 7 7 7" />
                      </svg>
                      Forward
                    </button>
                  </div>

                </div>
              ) : (
                <div className="text-center py-28 text-gray-500 text-sm">Failed to load email details.</div>
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
        {renderComposeWindow()}

        {/* Manage Smart Folders Modal */}
        {showManageFolders && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#0E1321] border border-gray-805 text-white w-full max-w-2xl rounded-2xl flex flex-col max-h-[85vh] overflow-hidden shadow-2xl">
              {/* Header */}
              <div className="bg-[#171D2C] px-6 py-4 flex justify-between items-center border-b border-gray-800 select-none">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>⚙️ Manage Smart Folders & Classification Rules</span>
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowManageFolders(false);
                    setEditingFolderId(null);
                    setNewFolderName("");
                    setNewFolderKeywords("");
                  }}
                  className="text-gray-400 hover:text-white font-bold text-sm px-2 py-1"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {/* Add new smart folder form */}
                <div className="bg-[#151A28]/50 border border-gray-800 p-4 rounded-xl space-y-4">
                  <h4 className="text-xs font-bold text-violet-400 uppercase tracking-wider">
                    {editingFolderId ? "✏️ Edit Smart Folder" : "➕ Create New Smart Folder"}
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-semibold text-gray-400">Folder Name:</label>
                      <input
                        type="text"
                        placeholder="e.g. Pinterest, Work, School"
                        value={editingFolderId ? editingFolderName : newFolderName}
                        onChange={(e) => {
                          if (editingFolderId) {
                            setEditingFolderName(e.target.value);
                          } else {
                            setNewFolderName(e.target.value);
                          }
                        }}
                        className="w-full bg-[#0E1321] border border-gray-850 rounded-xl py-2 px-3.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-violet-500"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-semibold text-gray-400">Sender Address Keywords (comma-separated):</label>
                      <input
                        type="text"
                        placeholder="e.g. pinterest, pntrst"
                        value={newFolderKeywords}
                        onChange={(e) => setNewFolderKeywords(e.target.value)}
                        className="w-full bg-[#0E1321] border border-gray-850 rounded-xl py-2 px-3.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-violet-500"
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-2.5">
                    {editingFolderId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingFolderId(null);
                          setEditingFolderName("");
                          setNewFolderKeywords("");
                        }}
                        className="bg-gray-800 hover:bg-gray-700 text-white text-[11px] font-bold px-4 py-2 rounded-lg transition-all"
                      >
                        Cancel Edit
                      </button>
                    )}
                    
                    <button
                      type="button"
                      onClick={() => {
                        const name = editingFolderId ? editingFolderName.trim() : newFolderName.trim();
                        const kws = newFolderKeywords.split(",").map(k => k.trim().toLowerCase()).filter(Boolean);
                        
                        if (!name) {
                          alert("Please specify a folder name.");
                          return;
                        }
                        
                        if (editingFolderId) {
                          // Rename folder and update keywords
                          setSmartFolders((prev) => {
                            const updated = prev.map((f) => {
                              if (f.id === editingFolderId) {
                                return { 
                                  ...f, 
                                  name, 
                                  keywords: kws.length > 0 ? kws : f.keywords 
                                };
                              }
                              return f;
                            });
                            localStorage.setItem("deepclean_smart_folders", JSON.stringify(updated));
                            return updated;
                          });
                          setEditingFolderId(null);
                          setEditingFolderName("");
                          setNewFolderKeywords("");
                          alert("Folder updated successfully!");
                        } else {
                          // Add folder
                          const id = name.toLowerCase().replace(/[^a-z0-9]/g, "-");
                          if (smartFolders.some(f => f.id === id)) {
                            alert("A folder with this name already exists.");
                            return;
                          }
                          
                          const newFolder = { id, name, keywords: kws.length > 0 ? kws : [id] };
                          setSmartFolders((prev) => {
                            const updated = [...prev, newFolder];
                            localStorage.setItem("deepclean_smart_folders", JSON.stringify(updated));
                            return updated;
                          });
                          setNewFolderName("");
                          setNewFolderKeywords("");
                          alert(`Folder "${name}" created successfully!`);
                        }
                      }}
                      className="bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-bold px-4 py-2 rounded-lg transition-all"
                    >
                      {editingFolderId ? "Save Changes" : "Create Folder"}
                    </button>
                  </div>
                </div>

                {/* List of current custom folders */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider select-none">
                    Active Folders & Keywords
                  </h4>
                  
                  <div className="space-y-2">
                    {smartFolders.map((folder) => (
                      <div key={folder.id} className="flex items-center justify-between bg-[#151A28]/35 border border-gray-850 p-3.5 rounded-xl gap-4">
                        <div className="overflow-hidden">
                          <p className="text-sm font-bold text-white">{folder.name}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {folder.keywords.map((kw, i) => (
                              <span key={i} className="text-[10px] bg-violet-600/10 text-violet-400 border border-violet-500/15 px-2 py-0.5 rounded-md font-mono">
                                *{kw}*
                              </span>
                            ))}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingFolderId(folder.id);
                              setEditingFolderName(folder.name);
                              setNewFolderKeywords(folder.keywords.join(", "));
                            }}
                            className="bg-gray-800 hover:bg-gray-700 text-white text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all"
                          >
                            Edit
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => {
                              if (!window.confirm(`Are you sure you want to delete the "${folder.name}" folder rules? This won't delete the emails, but they will be grouped into other folders.`)) return;
                              setSmartFolders((prev) => {
                                const updated = prev.filter(f => f.id !== folder.id);
                                localStorage.setItem("deepclean_smart_folders", JSON.stringify(updated));
                                return updated;
                              });
                            }}
                            className="bg-red-950/20 hover:bg-red-750 border border-red-500/20 text-red-400 hover:text-white text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-[#171D2C] px-6 py-3 flex justify-end border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowManageFolders(false)}
                  className="bg-violet-600 hover:bg-violet-750 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}