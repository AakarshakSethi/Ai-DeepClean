import { useState, useEffect } from "react";
import { getSubscriptions, bulkUnsubscribe } from "../api/emails";
import DashboardLayout from "../layouts/DashboardLayout";
import {
  FiLoader,
  FiMail,
  FiTrash2,
  FiAlertCircle,
  FiCheckCircle,
  FiExternalLink,
  FiSearch
} from "react-icons/fi";

export default function Unsubscribe() {
  const userId = localStorage.getItem("deepclean_user_id");
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cleaningSender, setCleaningSender] = useState(null);

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const data = await getSubscriptions(userId);
      setSubscriptions(data.subscriptions || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, [userId]);

  const handleBulkDelete = async (sender) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to bulk-delete all emails from "${sender}"? This will move them to your Gmail Trash in real-time.`
    );
    if (!confirmDelete) return;

    setCleaningSender(sender);
    try {
      const res = await bulkUnsubscribe(userId, sender);
      alert(`Success! Bulk-deleted ${res.emails_deleted} emails. Freed ${(res.freed_bytes / (1024 * 1024)).toFixed(1)} MB of storage.`);
      // Refresh list
      await fetchSubscriptions();
    } catch (e) {
      console.error(e);
      alert("Failed to bulk delete emails. Please try again.");
    } finally {
      setCleaningSender(null);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return "0 KB";
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  // Helper to open Gmail search for the sender so user can click their unsubscribe footer links
  const openGmailSearch = (sender) => {
    // Extract email from "Name <email@address.com>" if formatted that way
    const emailMatch = sender.match(/<([^>]+)>/);
    const email = emailMatch ? emailMatch[1] : sender;
    window.open(`https://mail.google.com/mail/u/0/#search/from%3A${encodeURIComponent(email)}+unsubscribe`, "_blank");
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-white flex items-center gap-2">
            Unsubscribe Assistant
            <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider animate-pulse">
              Manage Subscriptions
            </span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Identify repeat promotional lists, view the space they waste, and bulk-trash them with one click.
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-[50vh] text-gray-400">
            <FiLoader className="animate-spin text-violet-500 mb-4" size={28} />
            <p className="text-sm">Scanning Promotions database for newsletter lists...</p>
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="glass-panel p-12 text-center rounded-3xl border border-gray-800 space-y-4 max-w-xl mx-auto mt-6">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <FiCheckCircle size={24} />
            </div>
            <h3 className="text-base font-bold text-white">Inbox Clean of Newsletters!</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              We couldn't detect any active promotional senders in your database. Click "Scan Gmail" on the dashboard to import more emails and run the scanner.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            
            {/* Explanatory Banner */}
            <div className="bg-violet-600/5 border border-violet-500/15 p-4 rounded-2xl flex items-start gap-3">
              <FiAlertCircle className="text-violet-400 shrink-0 mt-0.5" size={16} />
              <div className="text-[11px] text-gray-450 leading-relaxed">
                <span className="font-bold text-white">How it works:</span> Under Gmail guidelines, newsletters contain an unsubscribe link inside their headers or footer content. Click the <span className="text-violet-400 font-bold">Unsubscribe Link</span> icon to locate the unsubscribe button directly in Gmail, then click <span className="text-red-400 font-bold">Bulk Delete</span> to instantly wipe all historical clutter from that sender!
              </div>
            </div>

            {/* Subscriptions Grid */}
            <div className="glass-panel rounded-2xl border border-gray-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#151A28] border-b border-gray-850 text-gray-400 font-bold">
                      <th className="p-4 w-1/2">Sender List</th>
                      <th className="p-4 text-center">Total Emails</th>
                      <th className="p-4 text-center">Storage Wasted</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-850">
                    {subscriptions.map((sub, i) => {
                      const isCleaning = cleaningSender === sub.sender;
                      
                      return (
                        <tr key={i} className="hover:bg-gray-800/35 transition-colors">
                          <td className="p-4 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-violet-600/15 border border-violet-500/20 text-violet-400 flex items-center justify-center shrink-0 font-bold">
                              {sub.sender[0].toUpperCase()}
                            </div>
                            <span className="font-bold text-white truncate max-w-xs md:max-w-md">
                              {sub.sender}
                            </span>
                          </td>
                          <td className="p-4 text-center text-gray-300 font-semibold">
                            {sub.email_count}
                          </td>
                          <td className="p-4 text-center text-red-300 font-semibold">
                            {formatSize(sub.total_size_bytes)}
                          </td>
                          <td className="p-4 text-right flex justify-end items-center gap-3">
                            <button
                              onClick={() => openGmailSearch(sub.sender)}
                              title="Search in Gmail to Unsubscribe"
                              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-350 hover:text-white border border-gray-700 transition-all flex items-center gap-1.5"
                            >
                              <FiExternalLink size={14} />
                              <span className="hidden sm:inline text-[10px]">Unsubscribe Link</span>
                            </button>
                            <button
                              onClick={() => handleBulkDelete(sub.sender)}
                              disabled={isCleaning}
                              className="p-2 rounded-lg bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/25 transition-all flex items-center gap-1.5"
                            >
                              <FiTrash2 size={14} />
                              <span className="hidden sm:inline text-[10px]">
                                {isCleaning ? "Trashing..." : "Bulk Delete"}
                              </span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
