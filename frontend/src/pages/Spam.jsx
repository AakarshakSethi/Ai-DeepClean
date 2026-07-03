import { useState, useEffect } from "react";
import { listSpamEmails, getGmailMessageDetails, unspamEmail } from "../api/emails";
import DashboardLayout from "../layouts/DashboardLayout";
import {
  FiLoader,
  FiAlertOctagon,
  FiMail,
  FiClock,
  FiArrowLeft,
  FiPaperclip
} from "react-icons/fi";

export default function Spam() {
  const userId = localStorage.getItem("deepclean_user_id");
  const [spamEmails, setSpamEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const fetchSpam = async () => {
    setLoading(true);
    try {
      const data = await listSpamEmails(userId);
      setSpamEmails(data.emails || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpam();
  }, [userId]);

  const handleOpenEmail = async (gmailId) => {
    setModalLoading(true);
    setShowModal(true);
    try {
      const details = await getGmailMessageDetails(gmailId, userId);
      setSelectedEmail(details);
    } catch (e) {
      console.error(e);
      alert("Failed to load spam email details.");
    } finally {
      setModalLoading(false);
    }
  };
  const [rescueCategory, setRescueCategory] = useState("INBOX");
  const [customCategory, setCustomCategory] = useState("");
  const [rescuing, setRescuing] = useState(false);

  const handleRescue = async () => {
    if (!selectedEmail) return;
    const finalCategory = rescueCategory === "Other" ? customCategory : rescueCategory;
    if (!finalCategory.trim()) {
      alert("Please specify a category to rescue this email to.");
      return;
    }
    setRescuing(true);
    try {
      await unspamEmail(userId, selectedEmail.gmail_message_id, finalCategory);
      alert(`Email rescued to ${finalCategory}!`);
      setShowModal(false);
      setSpamEmails((prev) => prev.filter(e => e.gmail_message_id !== selectedEmail.gmail_message_id));
    } catch (e) {
      console.error(e);
      alert("Failed to rescue email.");
    } finally {
      setRescuing(false);
    }
  };
  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-white flex items-center gap-2">
            <FiAlertOctagon className="text-red-400 animate-pulse" />
            Spam Folder
            <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
              Gmail Sync
            </span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Real-time feed of messages classified as Spam by Gmail. Keep your inbox safe!
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-[40vh] text-gray-400">
            <FiLoader className="animate-spin text-violet-500 mb-4" size={28} />
            <p className="text-sm">Loading spam emails...</p>
          </div>
        ) : spamEmails.length === 0 ? (
          <div className="glass-panel p-12 text-center rounded-3xl border border-gray-800 space-y-4 max-w-xl mx-auto mt-6">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <FiMail size={24} />
            </div>
            <h3 className="text-base font-bold text-white">Spam Folder is Clean!</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              No spam emails found in your connected Gmail account. Great job keeping your mailbox clean!
            </p>
          </div>
        ) : (
          <div className="glass-panel rounded-2xl border border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-850 bg-gray-900/40 text-gray-400 uppercase tracking-wider select-none text-[10px] font-bold">
                    <th className="py-4 px-6">Sender</th>
                    <th className="py-4 px-6">Subject</th>
                    <th className="py-4 px-6">Snippet</th>
                    <th className="py-4 px-6">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-850/40">
                  {spamEmails.map((email) => (
                    <tr
                      key={email.id}
                      onClick={() => handleOpenEmail(email.id)}
                      className="hover:bg-white/5 transition-colors cursor-pointer text-gray-300"
                    >
                      <td className="py-4 px-6 font-semibold text-white max-w-[150px] truncate">
                        {email.sender}
                      </td>
                      <td className="py-4 px-6 font-medium text-red-300 max-w-[200px] truncate">
                        {email.subject}
                      </td>
                      <td className="py-4 px-6 text-gray-450 max-w-[300px] truncate">
                        {email.snippet || "(No preview available)"}
                      </td>
                      <td className="py-4 px-6 text-gray-500 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-mono">
                          <FiClock size={12} className="text-gray-600" />
                          {email.date}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Spam Email Details Modal (White/Clean layout like the dashboard modal) */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#FFFFFF] text-[#202124] w-full max-w-4xl rounded-2xl flex flex-col max-h-[92vh] overflow-hidden shadow-2xl border border-gray-300">
              
              {/* Top control bar */}
              <div className="bg-[#F2F6FC] px-6 py-3.5 flex justify-between items-center border-b border-gray-250 select-none">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setSelectedEmail(null);
                  }}
                  className="flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <FiArrowLeft size={14} />
                  Back to List
                </button>
                <div className="text-[10px] font-bold text-red-650 bg-red-100 px-2.5 py-0.5 rounded uppercase tracking-wider font-mono">
                  Spam Warning
                </div>
              </div>

              {/* Main Content Area */}
              <div className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1 bg-white">
                {modalLoading ? (
                  <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                    <FiLoader className="animate-spin text-violet-500 mb-3" size={24} />
                    <p className="text-xs">Loading email contents...</p>
                  </div>
                ) : selectedEmail ? (
                  <div className="space-y-6">
                    {/* Header Details */}
                    <div className="border-b border-gray-150 pb-5">
                      <h2 className="text-lg md:text-xl font-bold text-red-700 tracking-tight leading-snug">
                        {selectedEmail.subject}
                      </h2>
                      
                      <div className="flex justify-between items-start gap-4 mt-4 flex-wrap text-xs text-gray-650">
                        <div className="space-y-0.5">
                          <p>
                            <span className="font-bold text-[#202124]">From:</span> {selectedEmail.sender}
                          </p>
                          <p>
                            <span className="font-bold text-[#202124]">To:</span> {selectedEmail.recipient}
                          </p>
                        </div>
                        <p className="text-gray-500 font-mono text-[11px]">{selectedEmail.date}</p>
                      </div>
                    </div>

                    {/* Alert banner for spam */}
                    <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-4 flex gap-2.5 leading-relaxed">
                      <FiAlertOctagon className="shrink-0 text-red-500 mt-0.5" size={16} />
                      <div>
                        <span className="font-bold">Be cautious with this message:</span> This email has been flagged as Spam by Gmail. Do not click on any links, open attachments, or reply with personal details unless you are certain of its safety.
                      </div>
                    </div>

                    {/* Email HTML Body (Rendered in secure iframe) */}
                    <div className="bg-[#FFFFFF] border border-gray-200 rounded-xl p-4 md:p-6 min-h-[300px] shadow-inner">
                      {selectedEmail.body_html ? (
                        <iframe
                          title="Spam Email Content"
                          srcDoc={`
                            <!DOCTYPE html>
                            <html>
                              <head>
                                <style>
                                  body {
                                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                                    color: #202124;
                                    font-size: 14px;
                                    line-height: 1.5;
                                    margin: 0;
                                    padding: 8px;
                                  }
                                  img {
                                    max-width: 100%;
                                    height: auto;
                                  }
                                </style>
                              </head>
                              <body>
                                ${selectedEmail.body_html}
                              </body>
                            </html>
                          `}
                          className="w-full min-h-[300px] border-none"
                          sandbox="allow-popups"
                          style={{ height: "450px" }}
                        />
                      ) : (
                        <div className="text-xs text-gray-550 italic py-12 text-center">
                          (No message content)
                        </div>
                      )}
                    </div>

                    {/* Attachments Section if any */}
                    {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                      <div className="border-t border-gray-150 pt-5 space-y-2">
                        <h4 className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                          <FiPaperclip size={14} className="text-gray-500" />
                          Attachments ({selectedEmail.attachments.length})
                        </h4>
                        <div className="flex flex-wrap gap-2.5">
                          {selectedEmail.attachments.map((att, idx) => (
                            <div
                              key={idx}
                              className="bg-gray-100 hover:bg-gray-155 border border-gray-200 px-3.5 py-2 rounded-xl flex items-center gap-2 max-w-xs transition-colors"
                            >
                              <div className="overflow-hidden">
                                <p className="text-xs font-bold text-gray-800 truncate" title={att.filename}>
                                  {att.filename}
                                </p>
                                <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                                  {(att.size_bytes / 1024).toFixed(0)} KB
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-20 text-gray-500 text-xs">
                    Failed to render email details.
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-[#F2F6FC] px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-gray-250">
                
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs font-bold text-gray-600">Rescue to:</span>
                  <select
                    value={rescueCategory}
                    onChange={(e) => setRescueCategory(e.target.value)}
                    className="bg-white border border-gray-300 text-gray-700 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-violet-500"
                  >
                    <option value="INBOX">Primary Inbox</option>
                    <option value="Promotions">Promotions</option>
                    <option value="Receipts">Receipts</option>
                    <option value="Other">Custom Folder...</option>
                  </select>
                  
                  {rescueCategory === "Other" && (
                    <input
                      type="text"
                      placeholder="Folder name"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className="bg-white border border-gray-300 text-gray-700 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-violet-500 w-28"
                    />
                  )}
                  
                  <button
                    onClick={handleRescue}
                    disabled={rescuing}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-4 rounded-lg text-xs transition-colors shadow-sm disabled:opacity-50"
                  >
                    {rescuing ? "Rescuing..." : "Rescue"}
                  </button>
                </div>

                <button
                  onClick={() => setShowModal(false)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-1.5 px-5 rounded-lg text-xs transition-colors w-full sm:w-auto"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
