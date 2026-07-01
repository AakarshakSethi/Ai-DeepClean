import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FiMenu,
  FiSearch,
  FiSettings,
  FiUser,
  FiPower
} from "react-icons/fi";

export default function Topbar({ onMenuClick }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchVal, setSearchVal] = useState("");

  const getPageTitle = () => {
    switch (location.pathname) {
      case "/dashboard":
        return "Dashboard";
      case "/review":
        return "Review Candidates";
      case "/search":
        return "AI Search";
      case "/survey":
        return "Micro-Surveys";
      case "/settings":
        return "Account Settings";
      default:
        return "AI Inbox DeepClean";
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchVal.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchVal.trim())}`);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("deepclean_user_id");
    localStorage.removeItem("deepclean_user_email");
    localStorage.removeItem("deepclean_user_plan");
    navigate("/login");
  };

  return (
    <header className="h-16 bg-[#0F172A]/85 backdrop-blur-md border-b border-[#2A3042] flex items-center justify-between px-4 md:px-6 z-20">
      
      {/* Left section: Hamburger & Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 md:hidden transition-colors"
          aria-label="Open Sidebar"
        >
          <FiMenu size={22} />
        </button>

        <h2 className="text-lg font-bold text-white tracking-wide hidden sm:block">
          {getPageTitle()}
        </h2>
      </div>

      {/* Middle section: Gmail-style Search Bar */}
      <form
        onSubmit={handleSearchSubmit}
        className="flex-1 max-w-xl mx-4 md:mx-8"
      >
        <div className="relative w-full">
          <button
            type="submit"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
          >
            <FiSearch size={18} />
          </button>

          <input
            type="text"
            placeholder="Search emails or ask AI in plain English..."
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            className="w-full bg-[#1E293B] border border-[#2E3B52] rounded-xl py-2 pl-12 pr-4 text-sm text-white placeholder:text-gray-400 outline-none focus:border-violet-500 focus:bg-[#1E293B] transition-all"
          />
        </div>
      </form>

      {/* Right section: Settings & Profile Actions */}
      <div className="flex items-center gap-2 md:gap-3">
        <button
          onClick={() => navigate("/settings")}
          className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 transition-colors hidden xs:block"
          title="Settings"
        >
          <FiSettings size={18} />
        </button>

        <button
          onClick={handleLogout}
          className="text-gray-400 hover:text-red-400 p-2 rounded-lg hover:bg-gray-800 transition-colors"
          title="Logout"
        >
          <FiPower size={18} />
        </button>

        <div className="w-8 h-8 rounded-full bg-violet-600/90 border border-violet-500/30 flex items-center justify-center cursor-pointer" onClick={() => navigate("/settings")}>
          <FiUser size={16} className="text-white" />
        </div>
      </div>

    </header>
  );
}