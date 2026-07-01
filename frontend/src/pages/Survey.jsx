import { useState, useEffect } from "react";
import { getPendingSurveys, submitSurvey } from "../api/survey";
import { getEmailDetails, getAttachmentDownloadUrl } from "../api/emails";
import DashboardLayout from "../layouts/DashboardLayout";
import {
  FiCheckCircle,
  FiActivity,
  FiFileText,
  FiSliders,
  FiZap,
  FiShield,
  FiMail,
  FiTrash2,
  FiInfo
} from "react-icons/fi";

function formatBytes(bytes) {
  if (!bytes) return "0.00 MB";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

export default function Survey() {
  const userId = localStorage.getItem("deepclean_user_id");

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Survey steps: 0 = Priority, 1 = Category, 2 = Action
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedPriority, setSelectedPriority] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Custom folder input states
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customCategory, setCustomCategory] = useState("");

  // Email Reader Modal states
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const fetchSurveys = async () => {
    setLoading(true);
    setError("");
    setCurrentStep(0);
    setShowCustomInput(false);
    setCustomCategory("");
    try {
      const res = await getPendingSurveys(userId, 10);
      setItems(res.items || []);
    } catch (e) {
      console.error(e);
      setError("Failed to load surveys. Make sure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSurveys();
  }, [userId]);

  const activeEmail = items[0]; // Survey the first email in the queue

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

  const handlePrioritySelect = (priority) => {
    setSelectedPriority(priority);
    setCurrentStep(1); // Auto-advance to category selection
  };

  const handleCategorySelect = (category) => {
    if (category === "Other") {
      setShowCustomInput(true);
    } else {
      setSelectedCategory(category);
      setCurrentStep(2); // Auto-advance to keep/delete action
      setShowCustomInput(false);
    }
  };

  const handleActionSelect = async (actionType) => {
    if (!activeEmail || submitting) return;
    setSubmitting(true);

    try {
      const willNeedAgain = actionType === "keep" ? "yes" : "no";
      
      // Submit response to backend
      await submitSurvey(
        userId,
        activeEmail.id,
        selectedPriority,
        selectedCategory,
        actionType,
        willNeedAgain
      );

      // Pop the answered email out of the list
      setItems((prev) => prev.slice(1));
      
      // Reset survey state for the next item
      setCurrentStep(0);
      setSelectedPriority("");
      setSelectedCategory("");
      setCustomCategory("");
      setShowCustomInput(false);
    } catch (e) {
      console.error(e);
      alert("Failed to submit response. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] text-gray-400 space-y-4">
          <FiActivity className="animate-spin text-violet-500" size={32} />
          <p className="text-sm font-semibold font-mono">Loading pending surveys...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl max-w-xl mx-auto mt-10">
          <h3 className="font-bold text-lg mb-2">Error</h3>
          <p className="text-sm">{error}</p>
          <button
            onClick={fetchSurveys}
            className="mt-4 bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-red-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-white">Micro-Surveys</h1>
          <p className="text-xs text-gray-400 mt-1">
            Spend 5 seconds per email to train the ML categorization model on your personal preferences.
          </p>
        </div>

        {items.length > 0 && activeEmail ? (
          <div className="glass-panel p-6 md:p-8 rounded-3xl border border-gray-800 shadow-xl relative overflow-hidden">
            
            {/* Delivery OTP Indicator Exception */}
            {activeEmail.is_order_otp_exception && (
              <div className="bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full w-fit mb-4 flex items-center gap-1.5 animate-pulse">
                <FiShield size={12} />
                Protected: Delivery OTP
              </div>
            )}

            {/* Email Card Subject & Details - Click to open Reader */}
            <div 
              className="bg-[#151A28] border border-gray-850 p-5 rounded-2xl mb-8 space-y-2 cursor-pointer hover:border-violet-500/25 hover:bg-white/5 transition-all group"
              onClick={() => handleOpenEmail(activeEmail.id)}
              title="Click to view full email content"
            >
              <div className="flex justify-between items-center">
                <span className="text-[10px] bg-violet-500/15 text-violet-400 border border-violet-500/25 px-2 py-0.5 rounded font-bold uppercase">
                  {activeEmail.category}
                </span>
                <span className="text-[10px] text-violet-400 font-bold group-hover:underline flex items-center gap-1">
                  View Content →
                </span>
              </div>
              <h3 className="text-base md:text-lg font-bold text-white leading-snug group-hover:text-violet-300 transition-colors">
                {activeEmail.subject}
              </h3>
              <p className="text-xs text-gray-400 truncate">{activeEmail.sender}</p>
            </div>

            {/* Stepper Progress Bar */}
            <div className="grid grid-cols-3 gap-2 mb-8">
              <div className={`h-1.5 rounded-full transition-all ${currentStep >= 0 ? "bg-violet-500" : "bg-gray-800"}`} />
              <div className={`h-1.5 rounded-full transition-all ${currentStep >= 1 ? "bg-violet-500" : "bg-gray-800"}`} />
              <div className={`h-1.5 rounded-full transition-all ${currentStep >= 2 ? "bg-violet-500" : "bg-gray-800"}`} />
            </div>

            {/* Survey Step Content */}
            <div className="min-h-[160px] flex flex-col justify-center">
              
              {currentStep === 0 && (
                <div className="space-y-5 text-center">
                  <p className="text-sm font-semibold text-gray-300">How important is this email sender to you?</p>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => handlePrioritySelect("high")}
                      className="bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 font-bold py-3.5 rounded-2xl text-xs sm:text-sm transition-all hover:scale-[1.01]"
                    >
                      🔥 High
                    </button>
                    <button
                      onClick={() => handlePrioritySelect("normal")}
                      className="bg-violet-500/10 hover:bg-violet-500 text-violet-400 hover:text-white border border-violet-500/20 font-bold py-3.5 rounded-2xl text-xs sm:text-sm transition-all hover:scale-[1.01]"
                    >
                      ⚡ Normal
                    </button>
                    <button
                      onClick={() => handlePrioritySelect("low")}
                      className="bg-slate-700/30 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-650/20 font-bold py-3.5 rounded-2xl text-xs sm:text-sm transition-all hover:scale-[1.01]"
                    >
                      💤 Low
                    </button>
                  </div>
                </div>
              )}

              {currentStep === 1 && (
                <div className="space-y-5 text-center">
                  {!showCustomInput ? (
                    <>
                      <p className="text-sm font-semibold text-gray-300">Classify the email category:</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {["Promotions", "Social", "Updates", "Receipts", "OTP", "Other"].map((cat) => (
                          <button
                            key={cat}
                            onClick={() => handleCategorySelect(cat)}
                            className="bg-violet-600/10 hover:bg-violet-600 border border-violet-500/20 hover:border-violet-500 text-violet-300 hover:text-white py-3 rounded-xl text-xs font-semibold transition-all hover:scale-[1.01]"
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="space-y-4 max-w-sm mx-auto">
                      <p className="text-sm font-semibold text-gray-300">Enter custom folder name:</p>
                      <input
                        type="text"
                        placeholder="e.g. Work, Bank, Travel"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        className="w-full bg-[#151A28] border border-gray-800 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-violet-500"
                        autoFocus
                      />
                      <div className="flex gap-3 justify-center">
                        <button
                          onClick={() => setShowCustomInput(false)}
                          className="bg-gray-800 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-xl text-xs"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            if (!customCategory.trim()) {
                              alert("Please enter a category name.");
                              return;
                            }
                            setSelectedCategory(customCategory.trim());
                            setCurrentStep(2);
                            setShowCustomInput(false);
                          }}
                          className="bg-violet-600 hover:bg-violet-700 text-white font-semibold py-2 px-5 rounded-xl text-xs"
                        >
                          Continue
                        </button>
                      </div>
                    </div>
                  )}

                  {!showCustomInput && (
                    <button
                      onClick={() => setCurrentStep(0)}
                      className="text-xs text-gray-500 hover:text-white underline block mx-auto mt-2"
                    >
                      ← Change Importance
                    </button>
                  )}
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-5 text-center">
                  <p className="text-sm font-semibold text-gray-300">Do you want to keep or delete this email?</p>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => handleActionSelect("keep")}
                      disabled={submitting}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl text-sm transition-all shadow-md shadow-emerald-600/20 hover:scale-[1.01]"
                    >
                      Keep Email
                    </button>
                    <button
                      onClick={() => handleActionSelect("delete")}
                      disabled={submitting}
                      className="bg-red-650 hover:bg-red-700 text-white font-bold py-4 rounded-2xl text-sm transition-all shadow-md shadow-red-650/20 hover:scale-[1.01]"
                    >
                      Delete Email
                    </button>
                  </div>
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="text-xs text-gray-500 hover:text-white underline block mx-auto mt-2"
                  >
                    ← Change Category
                  </button>
                </div>
              )}

            </div>
          </div>
        ) : (
          <div className="glass-panel p-8 rounded-3xl border border-gray-800 text-center shadow-xl py-12">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-6">
              <FiCheckCircle size={28} />
            </div>
            <h2 className="text-xl font-bold text-white">All Surveys Filled!</h2>
            <p className="text-xs text-gray-400 mt-2 max-w-sm mx-auto leading-relaxed">
              You have completed all pending surveys. Sync your inbox to load new emails or return to your Dashboard.
            </p>
            <button
              onClick={() => window.location.href = "/dashboard"}
              className="mt-6 bg-violet-600 hover:bg-violet-700 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-all"
            >
              Dashboard
            </button>
          </div>
        )}

        {/* Email Reader Modal (Surveys Integration) */}
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

                  {/* Actions footer */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-800/60">
                    <button
                      onClick={() => { setShowModal(false); setSelectedEmail(null); }}
                      className="bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all"
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

      </div>
    </DashboardLayout>
  );
}