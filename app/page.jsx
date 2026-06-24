"use client";

import { useState, useEffect } from "react";
import { 
  FaSearch, 
  FaCheck, 
  FaExclamationTriangle, 
  FaGoogle, 
  FaExternalLinkAlt, 
  FaUser, 
  FaEnvelope, 
  FaTrash, 
  FaEdit, 
  FaFilter, 
  FaSpinner, 
  FaMagic, 
  FaBriefcase, 
  FaSave, 
  FaPhoneAlt, 
  FaFileAlt,
  FaPlay,
  FaStop,
  FaFire
} from "react-icons/fa";

function AuditPanel({ audit }) {
  if (!audit) return null;

  if (audit.error) {
    return (
      <div className="mt-3 p-3 bg-red-50 rounded-lg text-xs text-red-600">
        Audit failed: {audit.error}
      </div>
    );
  }

  const scoreColor = audit.auditScore >= 70
    ? "text-red-600 bg-red-50"
    : audit.auditScore >= 40
    ? "text-yellow-600 bg-yellow-50"
    : "text-green-600 bg-green-50";

  return (
    <div className="mt-3 border-t border-gray-100 pt-3 space-y-3">

      {/* Score */}
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${scoreColor}`}>
        🎯 Pain Score: {audit.auditScore}/100
        <span className="font-normal">
          {audit.auditScore >= 70 ? "— Hot lead" : audit.auditScore >= 40 ? "— Warm lead" : "— Cold lead"}
        </span>
      </div>

      {/* Website health */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Website health</p>
        <div className="flex flex-wrap gap-1.5">
          <span className={`text-xs px-2 py-0.5 rounded-full ${audit.website?.hasSSL ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            {audit.website?.hasSSL ? "🔒 Secure (HTTPS)" : "⚠️ No SSL"}
          </span>
          {audit.website?.mobileScore !== null && audit.website?.mobileScore !== undefined && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${audit.website.mobileScore >= 50 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              📱 Mobile: {audit.website.mobileScore}/100
            </span>
          )}
          {audit.website?.error && audit.website.error !== "No website" && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              Speed check unavailable
            </span>
          )}
        </div>
      </div>

      {/* Social presence */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Social presence</p>
        <div className="flex flex-wrap gap-1.5">
          <span className={`text-xs px-2 py-0.5 rounded-full ${audit.social?.hasFacebook ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
            {audit.social?.hasFacebook ? "✅ Facebook found" : "❌ No Facebook"}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${audit.social?.hasInstagram ? "bg-pink-100 text-pink-700" : "bg-gray-100 text-gray-500"}`}>
            {audit.social?.hasInstagram ? "✅ Instagram found" : "❌ No Instagram"}
          </span>
        </div>
      </div>

      {/* Pain points */}
      {audit.ai?.painPoints?.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">3 pain points</p>
          <ul className="space-y-1">
            {audit.ai.painPoints.map((point, i) => (
              <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                <span className="text-red-500 flex-shrink-0 mt-0.5">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Call opener */}
      {audit.ai?.callOpener && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Call opener script</p>
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-900 italic leading-relaxed">
            &ldquo;{audit.ai.callOpener}&rdquo;
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(audit.ai.callOpener)}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            Copy script
          </button>
        </div>
      )}

    </div>
  );
}

export default function Home() {
  // Navigation
  const [activeTab, setActiveTab] = useState("search"); // "search" or "crm"

  // Search Screen State
  const [prompt, setPrompt] = useState("");
  const [autoEnrich, setAutoEnrich] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveResult, setSaveResult] = useState(null);
  const [selectedLeads, setSelectedLeads] = useState(new Set());
  const [auditResults, setAuditResults] = useState({});
  const [auditLoading, setAuditLoading] = useState({});
  const [searchFilters, setSearchFilters] = useState({
    hideDuplicates: false,
    hideLowPriority: false
  });

  // CRM Dashboard State
  const [crmLeads, setCrmLeads] = useState([]);
  const [crmLoading, setCrmLoading] = useState(false);
  const [crmError, setCrmError] = useState(null);
  const [crmFilters, setCrmFilters] = useState({
    status: "all",
    priority: "all",
    search: ""
  });
  const [crmSaving, setCrmSaving] = useState(false);
  const [crmSaveSuccess, setCrmSaveSuccess] = useState(false);

  // Enrichment & Edit State
  const [enrichingLeadHash, setEnrichingLeadHash] = useState(null);
  const [editingHash, setEditingHash] = useState(null);
  const [editData, setEditData] = useState({
    ownerName: "",
    email: "",
    socialLink: "",
    phone: "",
    website: ""
  });

  // Email Campaigns State
  const [queue, setQueue] = useState([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState(null);
  const [activeDraftLead, setActiveDraftLead] = useState(null);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");
  const [draftGenerating, setDraftGenerating] = useState(false);
  const [emailSending, setEmailSending] = useState(false);

  // Warmup State
  const [warmupConfig, setWarmupConfig] = useState(null);
  const [warmupStats, setWarmupStats] = useState(null);
  const [warmupLoading, setWarmupLoading] = useState(false);
  const [warmupTriggering, setWarmupTriggering] = useState(false);
  const [warmupMode, setWarmupMode] = useState(null); // "vercel-cron" | "local-interval"
  const [warmupEnvInstructions, setWarmupEnvInstructions] = useState(null);

  // Fetch CRM leads on mount or when switching to CRM/Campaigns tabs
  useEffect(() => {
    if (activeTab === "crm" || activeTab === "campaigns") {
      fetchCrmLeads();
    }
    if (activeTab === "campaigns") {
      fetchEmailQueue();
      fetchWarmupConfig();
    }
  }, [activeTab]);

  const fetchCrmLeads = async () => {
    setCrmLoading(true);
    setCrmError(null);
    try {
      const res = await fetch("/api/leads");
      if (!res.ok) {
        throw new Error("Failed to load CRM leads.");
      }
      const data = await res.json();
      setCrmLeads(data.leads || []);
    } catch (err) {
      setCrmError(err.message);
    } finally {
      setCrmLoading(false);
    }
  };

  const fetchEmailQueue = async () => {
    setQueueLoading(true);
    setQueueError(null);
    try {
      const res = await fetch("/api/email/queue");
      if (!res.ok) {
        throw new Error("Failed to load email queue.");
      }
      const data = await res.json();
      setQueue(data.queue || []);
    } catch (err) {
      setQueueError(err.message);
    } finally {
      setQueueLoading(false);
    }
  };

  const fetchWarmupConfig = async () => {
    setWarmupLoading(true);
    try {
      const res = await fetch("/api/warmup/config");
      const data = await res.json();
      if (data.success) {
        setWarmupConfig(data.config);
        setWarmupStats(data.stats);
        setWarmupMode(data.mode || null);
      }
    } catch (err) {
      console.error("Failed to fetch warmup config:", err);
    } finally {
      setWarmupLoading(false);
    }
  };

  const handleToggleWarmup = async () => {
    setWarmupLoading(true);
    setWarmupEnvInstructions(null);
    try {
      const res = await fetch("/api/warmup/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !warmupConfig?.active })
      });
      const data = await res.json();
      if (data.success) {
        setWarmupConfig(data.config);
        setWarmupStats(data.stats);
        setWarmupMode(data.mode || null);
        // On Vercel, show env var instructions so the warmup persists after cold starts
        if (data.vercelEnvInstructions) {
          setWarmupEnvInstructions(data.vercelEnvInstructions);
        }
      } else {
        alert("Failed to update warmup settings: " + data.error);
      }
    } catch (err) {
      alert("Failed to toggle warmup: " + err.message);
    } finally {
      setWarmupLoading(false);
    }
  };

  const handleTriggerWarmupEmail = async () => {
    setWarmupTriggering(true);
    try {
      const res = await fetch("/api/warmup/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true })
      });
      const data = await res.json();
      if (data.success) {
        alert("✅ Warmup email sent successfully!");
        fetchWarmupConfig();
      } else if (data.skipped) {
        alert("ℹ️ Skipped: " + data.reason);
      } else {
        alert("❌ Failed to send warmup email: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setWarmupTriggering(false);
    }
  };

  const handleOpenDraftModal = async (lead) => {
    setActiveDraftLead(lead);
    setEditedSubject("");
    setEditedBody("");
    setDraftGenerating(true);

    try {
      let draft = null;
      if (lead.emailDraft) {
        try {
          draft = JSON.parse(lead.emailDraft);
        } catch (e) {
          console.warn("[UI] Failed to parse saved emailDraft, generating new draft.");
        }
      }

      if (!draft || !draft.subject || !draft.body) {
        const res = await fetch("/api/email/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hash: lead.hash })
        });
        if (!res.ok) {
          throw new Error("Failed to generate AI email draft.");
        }
        const data = await res.json();
        draft = data.draft;
      }

      setEditedSubject(draft.subject || "");
      setEditedBody(draft.body || "");
    } catch (err) {
      alert("Failed to draft email: " + err.message);
      setActiveDraftLead(null);
    } finally {
      setDraftGenerating(false);
    }
  };

  const handleSendEmail = async () => {
    if (!activeDraftLead) return;
    setEmailSending(true);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hash: activeDraftLead.hash,
          subject: editedSubject,
          body: editedBody
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to send email");
      }

      alert("Email sent successfully!");
      setActiveDraftLead(null);
      fetchEmailQueue();
      fetchCrmLeads(); // update stats
    } catch (err) {
      alert("Send failed: " + err.message);
    } finally {
      setEmailSending(false);
    }
  };

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults([]);
    setSelectedLeads(new Set());
    setMeta(null);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          prompt,
          enrich: autoEnrich
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch leads");
      }

      const data = await res.json();
      const sorted = (data.leads || []).sort((a, b) => {
        const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
        return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
      });
      setResults(sorted);
      // Auto-select all leads by default
      setSelectedLeads(new Set(sorted.map((_, i) => i)));
      setMeta(data.meta);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAudit = async (lead, index) => {
    setAuditLoading(prev => ({ ...prev, [index]: true }));
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Audit failed");
      setAuditResults(prev => ({ ...prev, [index]: data.audit }));
    } catch (err) {
      setAuditResults(prev => ({
        ...prev,
        [index]: { error: err.message }
      }));
    } finally {
      setAuditLoading(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleSaveToCrmAndSheets = async () => {
    if (!results.length || !meta) return;

    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const res = await fetch("/api/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leads: results.filter((_, i) => selectedLeads.has(i)),
          category: meta.category,
          location: meta.location,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save leads");
      }

      const data = await res.json();
      setSaveResult(data);
      setSaveSuccess(true);
      
      // Update local duplicate status for results so UI updates
      setResults(prev => prev.map(l => ({ ...l, isDuplicate: true, status: "not_contacted" })));
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExportCrmToSheets = async () => {
    if (!filteredCrmLeads.length) return;

    setCrmSaving(true);
    setCrmSaveSuccess(false);

    try {
      const res = await fetch("/api/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leads: filteredCrmLeads,
          category: "CRM Export",
          location: "Filtered View",
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to export CRM leads");
      }

      setCrmSaveSuccess(true);
      setTimeout(() => setCrmSaveSuccess(false), 3000);
    } catch (err) {
      alert("Failed to export: " + err.message);
    } finally {
      setCrmSaving(false);
    }
  };

  const handleEnrichSingle = async (leadIndex, isCrm = false) => {
    const lead = isCrm ? crmLeads[leadIndex] : results[leadIndex];
    setEnrichingLeadHash(lead.hash);

    try {
      const res = await fetch("/api/leads/enrich", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lead,
          location: lead.location || meta?.location || "Unknown"
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to enrich lead information.");
      }

      const data = await res.json();
      if (data.success && data.lead) {
        if (isCrm) {
          await handleUpdateLeadField(lead.hash, {
            ownerName: data.lead.ownerName,
            email: data.lead.email,
            socialLink: data.lead.socialLink
          });
        } else {
          const updatedResults = [...results];
          updatedResults[leadIndex] = {
            ...updatedResults[leadIndex],
            ownerName: data.lead.ownerName,
            email: data.lead.email,
            socialLink: data.lead.socialLink
          };
          setResults(updatedResults);
        }
      }
    } catch (err) {
      alert("Enrichment failed: " + err.message);
    } finally {
      setEnrichingLeadHash(null);
    }
  };

  const handleUpdateLeadField = async (hash, updates) => {
    try {
      const res = await fetch("/api/leads", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ hash, updates }),
      });

      if (!res.ok) {
        throw new Error("Failed to update lead details");
      }

      const data = await res.json();
      if (data.success) {
        setCrmLeads(prev => prev.map(lead => lead.hash === hash ? { ...lead, ...data.lead } : lead));
      }
    } catch (err) {
      alert("Failed to update lead: " + err.message);
    }
  };

  const handleDeleteLead = async (hash) => {
    if (!confirm("Are you sure you want to delete this lead?")) return;
    try {
      const res = await fetch(`/api/leads?hash=${hash}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete lead");
      }

      setCrmLeads(prev => prev.filter(lead => lead.hash !== hash));
    } catch (err) {
      alert("Failed to delete lead: " + err.message);
    }
  };

  const startEditing = (lead) => {
    setEditingHash(lead.hash);
    setEditData({
      ownerName: lead.ownerName,
      email: lead.email,
      socialLink: lead.socialLink,
      phone: lead.phone,
      website: lead.website
    });
  };

  const saveEditing = async (hash) => {
    await handleUpdateLeadField(hash, editData);
    setEditingHash(null);
  };

  // Filter Search results
  const filteredSearchLeads = results.filter(lead => {
    if (searchFilters.hideDuplicates && lead.isDuplicate) return false;
    if (searchFilters.hideLowPriority && lead.priority === "LOW") return false;
    return true;
  });

  // Filter CRM leads
  const filteredCrmLeads = crmLeads.filter(lead => {
    const matchesSearch = 
      lead.name?.toLowerCase().includes(crmFilters.search.toLowerCase()) ||
      lead.address?.toLowerCase().includes(crmFilters.search.toLowerCase()) ||
      lead.email?.toLowerCase().includes(crmFilters.search.toLowerCase()) ||
      lead.ownerName?.toLowerCase().includes(crmFilters.search.toLowerCase()) ||
      lead.category?.toLowerCase().includes(crmFilters.search.toLowerCase()) ||
      lead.location?.toLowerCase().includes(crmFilters.search.toLowerCase());

    const matchesStatus = crmFilters.status === "all" || lead.status === crmFilters.status;
    const matchesPriority = crmFilters.priority === "all" || lead.priority === crmFilters.priority;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Stats Calculator
  const totalCrm = crmLeads.length;
  const highPriorityCrm = crmLeads.filter(l => l.priority === "HIGH").length;
  const contactedCrm = crmLeads.filter(l => l.status !== "not_contacted").length;
  const mockupSentCrm = crmLeads.filter(l => l.status === "mockup_sent" || l.status === "mockup_followup").length;
  const wonCrm = crmLeads.filter(l => l.status === "closed_won").length;

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "HIGH": return "bg-green-100 text-green-800 border-green-200";
      case "MEDIUM": return "bg-amber-100 text-amber-800 border-amber-200";
      case "LOW": default: return "bg-gray-100 text-gray-600 border-gray-200";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "not_contacted": return "bg-gray-100 text-gray-800 border-gray-200";
      case "emailed": return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "replied_interested": return "bg-purple-100 text-purple-800 border-purple-200";
      case "mockup_sent": return "bg-blue-100 text-blue-800 border-blue-200";
      case "mockup_followup": return "bg-cyan-100 text-cyan-800 border-cyan-200";
      case "closed_won": return "bg-green-100 text-green-800 border-green-300 font-semibold";
      case "closed_lost": return "bg-red-100 text-red-800 border-red-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "not_contacted": return "Not Contacted";
      case "emailed": return "Emailed";
      case "replied_interested": return "Replied - Interested";
      case "mockup_sent": return "Mockup Sent";
      case "mockup_followup": return "Mockup Followup";
      case "closed_won": return "Closed Won 🎉";
      case "closed_lost": return "Closed Lost";
      default: return "Unknown";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <main className="max-w-6xl mx-auto p-4 md:p-8">
        
        {/* Header */}
        <header className="mb-8 text-center md:text-left flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-4xl font-extrabold text-indigo-700 tracking-tight flex items-center justify-center md:justify-start gap-2">
              LeadFinder AI <span className="text-2xl">🎯</span>
            </h1>
            <p className="text-slate-500 mt-1 text-sm md:text-base">
              Find local business leads and push them to Google Sheets for cold outreach.
            </p>
          </div>
          
          {/* Tab Navigation */}
          <div className="bg-white border border-slate-200 p-1 rounded-xl shadow-sm flex self-center md:self-auto">
            <button
              onClick={() => setActiveTab("search")}
              className={`flex items-center gap-2 py-2 px-5 text-sm font-semibold rounded-lg transition-all ${
                activeTab === "search"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FaSearch className="text-xs" />
              Find Leads
            </button>
            <button
              onClick={() => setActiveTab("crm")}
              className={`flex items-center gap-2 py-2 px-5 text-sm font-semibold rounded-lg transition-all ${
                activeTab === "crm"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FaBriefcase className="text-xs" />
              CRM & Lead Tracker
            </button>
            <button
              onClick={() => setActiveTab("campaigns")}
              className={`flex items-center gap-2 py-2 px-5 text-sm font-semibold rounded-lg transition-all ${
                activeTab === "campaigns"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FaEnvelope className="text-xs" />
              Email Campaigns
            </button>
          </div>
        </header>

        {/* Tab 1: Find Leads (Search) */}
        {activeTab === "search" && (
          <div className="space-y-6">
            
            {/* Search Input Form */}
            <section className="bg-white border border-slate-200 shadow-md rounded-2xl p-5 md:p-7">
              <form onSubmit={handleSearchSubmit} className="space-y-4">
                <div>
                  <label className="block text-slate-700 text-xs font-bold mb-2 uppercase tracking-wider" htmlFor="prompt">
                    AI Natural Language Search Prompt
                  </label>
                  <textarea
                    id="prompt"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block p-3.5 shadow-inner transition-all outline-none"
                    rows="3"
                    placeholder="e.g., plumbers in Austin TX — or — dentists in Manchester UK"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    required
                  ></textarea>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  {/* Auto-Enrichment Toggle */}
                  <label className="flex items-center gap-3 cursor-pointer group select-none">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={autoEnrich}
                      onChange={(e) => setAutoEnrich(e.target.checked)}
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 relative"></div>
                    <span className="text-xs font-semibold text-slate-700 group-hover:text-slate-900 flex items-center gap-1">
                      <FaMagic className="text-amber-500 text-[10px]" />
                      Auto-Enrich Top 10 Results (Owner Name, Email)
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={loading}
                    className={`sm:w-48 w-full flex items-center justify-center space-x-2 font-bold py-3 px-6 rounded-xl shadow-md transition-all duration-300 transform active:scale-95 ${
                      loading
                        ? "bg-slate-400 cursor-not-allowed text-slate-100"
                        : "bg-indigo-600 hover:bg-indigo-700 text-white"
                    }`}
                  >
                    {loading ? (
                      <>
                        <FaSpinner className="animate-spin text-sm" />
                        <span>Searching...</span>
                      </>
                    ) : (
                      <>
                        <FaSearch className="text-xs" />
                        <span>Search Leads</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </section>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl shadow-sm flex items-start space-x-3" role="alert">
                <FaExclamationTriangle className="mt-1 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {results.length > 0 && (
              <section className="space-y-6">
                
                {/* Search Results Action Bar */}
                <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200 gap-4">
                  <div className="flex items-center flex-wrap gap-2 text-center md:text-left">
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">
                        Found {results.length} results
                        {selectedLeads.size !== results.length && (
                          <span className="bg-green-100 text-green-800 text-xs font-semibold px-2 py-0.5 rounded ml-2">
                            {selectedLeads.size} selected
                          </span>
                        )}
                      </h2>
                      <div className="flex gap-2 mt-1">
                        <button
                          type="button"
                          className="text-[10px] text-indigo-600 underline hover:text-indigo-800 font-semibold"
                          onClick={() => setSelectedLeads(new Set(results.map((_, i) => i)))}
                        >
                          Select all
                        </button>
                        <span className="text-slate-300 text-[10px]">|</span>
                        <button
                          type="button"
                          className="text-[10px] text-red-500 underline hover:text-red-700 font-semibold"
                          onClick={() => setSelectedLeads(new Set())}
                        >
                          Deselect all
                        </button>
                      </div>
                    </div>
                    
                    {/* Inline Filter Controls */}
                    <div className="flex items-center gap-4 ml-0 md:ml-6 border-t md:border-t-0 md:border-l border-slate-200 pt-2 md:pt-0 pl-0 md:pl-6">
                      <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={searchFilters.hideDuplicates}
                          onChange={(e) => setSearchFilters(prev => ({ ...prev, hideDuplicates: e.target.checked }))}
                          className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 h-3.5 w-3.5"
                        />
                        Hide Saved
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={searchFilters.hideLowPriority}
                          onChange={(e) => setSearchFilters(prev => ({ ...prev, hideLowPriority: e.target.checked }))}
                          className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 h-3.5 w-3.5"
                        />
                        Hide Low Priority
                      </label>
                    </div>
                  </div>

                  <div className="w-full md:w-auto">
                    <button
                      onClick={handleSaveToCrmAndSheets}
                      disabled={saving || saveSuccess || selectedLeads.size === 0}
                      className={`w-full md:w-auto flex items-center justify-center space-x-2 font-bold py-2.5 px-6 rounded-xl shadow-sm transition-all duration-200 text-sm ${
                        saveSuccess
                          ? "bg-green-500 text-white cursor-default"
                          : (saving || selectedLeads.size === 0)
                          ? "bg-slate-400 cursor-not-allowed text-white"
                          : "bg-green-600 hover:bg-green-700 text-white"
                      }`}
                    >
                      {saving ? (
                        <>
                          <FaSpinner className="animate-spin" />
                          <span>Saving leads...</span>
                        </>
                      ) : saveSuccess ? (
                        <>
                          <FaCheck />
                          <span>Saved to CRM & Sheets!</span>
                        </>
                      ) : (
                        <>
                          <FaGoogle />
                          <span>Push {selectedLeads.size} to Sheets</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {saveError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl shadow-sm flex items-start space-x-3">
                    <FaExclamationTriangle className="mt-1 flex-shrink-0" />
                    <span className="text-sm">Error saving: {saveError}</span>
                  </div>
                )}

                {saveSuccess && (
                  <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl shadow-sm flex items-start space-x-3">
                    <FaCheck className="mt-1 flex-shrink-0" />
                    <span className="text-sm">
                      Saved {saveResult?.saved ?? results.length} leads to Google Sheets!
                      {saveResult?.skipped > 0 && ` (${saveResult.skipped} duplicate${saveResult.skipped > 1 ? "s" : ""} skipped)`}
                    </span>
                  </div>
                )}

                {/* Grid of Results */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {filteredSearchLeads.map((lead, index) => {
                    const originalIndex = results.indexOf(lead);
                    return (
                      <article
                        key={lead.hash}
                        onClick={() => {
                          setSelectedLeads(prev => {
                            const next = new Set(prev);
                            if (next.has(originalIndex)) {
                              next.delete(originalIndex);
                            } else {
                              next.add(originalIndex);
                            }
                            return next;
                          });
                        }}
                        className={`bg-white shadow-md rounded-2xl overflow-hidden border hover:shadow-lg transition-all duration-200 flex flex-col h-full cursor-pointer ${
                          selectedLeads.has(originalIndex)
                            ? "border-indigo-500 ring-2 ring-indigo-200"
                            : "border-slate-200"
                        }`}
                      >
                        
                        {/* Priority Tag at the top */}
                        <div className="p-4 flex-grow">
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                                selectedLeads.has(originalIndex) ? "bg-indigo-500 border-indigo-500 text-white" : "border-slate-300"
                              }`}>
                                {selectedLeads.has(originalIndex) && (
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getPriorityColor(lead.priority)}`}>
                                {lead.priority} PRIORITY
                              </span>
                            </div>

                            {lead.isDuplicate && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-indigo-600 border border-slate-200">
                                Saved ({getStatusLabel(lead.status)})
                              </span>
                            )}
                          </div>

                          {lead.priority && (
                            <div className={`inline-block text-xs font-bold px-2 py-0.5 rounded mb-2 ${
                              lead.priority === "HIGH"
                                ? "bg-red-100 text-red-700"
                                : lead.priority === "MEDIUM"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-gray-100 text-gray-500"
                            }`}>
                              {lead.priority === "HIGH" ? "🔴 HIGH PRIORITY" : lead.priority === "MEDIUM" ? "🟡 MEDIUM" : "🟢 LOW"}
                            </div>
                          )}
                          <h3 className="font-extrabold text-base text-slate-800 line-clamp-2 mb-2">{lead.name}</h3>
                          {lead.ownerName && lead.ownerName !== "N/A" && (
                            <p className="text-gray-500 text-xs mb-1">👤 {lead.ownerName}</p>
                          )}
                          {lead.email && lead.email !== "N/A" && (
                            <p className="text-green-700 text-xs font-mono bg-green-50 px-2 py-0.5 rounded mb-2">
                              ✉️ {lead.email}
                            </p>
                          )}
                          
                          <p className="text-slate-500 text-xs mb-3 flex items-start">
                            <span className="mr-1 mt-0.5">📍</span>
                            <span className="line-clamp-2">{lead.address}</span>
                          </p>

                          <div className="space-y-1.5 border-t border-slate-100 pt-3">
                            <div className="flex items-center justify-between text-xs text-slate-600">
                              <span className="flex items-center gap-1.5">
                                <FaPhoneAlt className="text-[10px] text-slate-400" />
                                Phone:
                              </span>
                              <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{lead.phone || "N/A"}</span>
                            </div>

                            <div className="flex items-center justify-between text-xs text-slate-600">
                              <span>⭐ Reviews:</span>
                              <span>{lead.rating !== "N/A" ? `${lead.rating} (${lead.reviews} reviews)` : "No ratings"}</span>
                            </div>
                          </div>

                          {/* Enrichment Info */}
                          <div className="mt-4 pt-3 border-t border-slate-100 bg-slate-50 p-2.5 rounded-xl space-y-2">
                            <div className="flex items-center justify-between text-xs text-slate-600">
                              <span className="flex items-center gap-1">
                                <FaUser className="text-[10px] text-slate-400" />
                                Contact:
                              </span>
                              <span className="font-semibold text-slate-700">{lead.ownerName || "N/A"}</span>
                            </div>

                            <div className="flex items-center justify-between text-xs text-slate-600">
                              <span className="flex items-center gap-1">
                                <FaEnvelope className="text-[10px] text-slate-400" />
                                Email:
                              </span>
                              <span className="font-semibold text-indigo-600 truncate max-w-[150px]">{lead.email || "N/A"}</span>
                            </div>

                            {/* Manual Enrich Trigger */}
                            {(lead.email === "N/A" || lead.ownerName === "N/A") && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEnrichSingle(originalIndex, false);
                                }}
                                disabled={enrichingLeadHash === lead.hash}
                                className="w-full mt-1.5 flex items-center justify-center gap-1 text-[11px] font-bold py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors"
                              >
                                {enrichingLeadHash === lead.hash ? (
                                  <>
                                    <FaSpinner className="animate-spin text-[9px]" />
                                    <span>Enriching details...</span>
                                  </>
                                ) : (
                                  <>
                                    <FaMagic className="text-[9px]" />
                                    <span>Lookup Owner & Email</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Card Actions Footer */}
                        <div className="bg-slate-50 px-4 py-3 border-t border-slate-100 mt-auto">
                          {/* Website link */}
                          {lead.website && lead.website.startsWith("http") ? (
                            <a
                              href={lead.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-indigo-600 text-xs font-bold flex items-center hover:underline mb-2"
                            >
                              <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                              Visit Website <FaExternalLinkAlt className="ml-1 text-[9px]" />
                            </a>
                          ) : (
                            <p className="text-red-500 text-xs font-bold flex items-center mb-2">
                              <span className="w-2 h-2 rounded-full bg-red-500 mr-2"></span>
                              {lead.website}
                            </p>
                          )}

                          {/* Run Audit button */}
                          {!auditResults[originalIndex] && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleAudit(lead, originalIndex); }}
                              disabled={auditLoading[originalIndex]}
                              className={`w-full text-xs font-semibold py-1.5 px-3 rounded-lg border transition-colors duration-200 ${
                                auditLoading[originalIndex]
                                  ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                  : "bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-400"
                              }`}
                            >
                              {auditLoading[originalIndex] ? (
                                <span className="flex items-center justify-center gap-1.5">
                                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                  </svg>
                                  Auditing...
                                </span>
                              ) : "🔍 Run Pre-Call Audit"}
                            </button>
                          )}

                          {/* Audit results panel */}
                          <AuditPanel audit={auditResults[originalIndex]} />

                          {/* Re-run button after audit completes */}
                          {auditResults[originalIndex] && !auditResults[originalIndex].error && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setAuditResults(prev => { const n = {...prev}; delete n[originalIndex]; return n; });
                              }}
                              className="mt-2 text-xs text-gray-400 hover:text-gray-600 underline"
                            >
                              Re-run audit
                            </button>
                          )}
                        </div>

                      </article>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Tab 2: CRM & Lead Tracker */}
        {activeTab === "crm" && (
          <div className="space-y-6">
            
            {/* Stats Panel */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Leads</span>
                <p className="text-2xl font-black text-slate-800 mt-1">{totalCrm}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                <span className="text-[10px] uppercase font-bold text-amber-500">High Priority</span>
                <p className="text-2xl font-black text-amber-600 mt-1">{highPriorityCrm}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                <span className="text-[10px] uppercase font-bold text-blue-500">Contacted</span>
                <p className="text-2xl font-black text-blue-600 mt-1">{contactedCrm}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                <span className="text-[10px] uppercase font-bold text-indigo-500">Mockups Sent</span>
                <p className="text-2xl font-black text-indigo-600 mt-1">{mockupSentCrm}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center col-span-2 md:col-span-1">
                <span className="text-[10px] uppercase font-bold text-green-500">Closed Won 🎉</span>
                <p className="text-2xl font-black text-green-600 mt-1">{wonCrm}</p>
              </div>
            </div>

            {/* Filters and Actions */}
            <section className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto flex-grow max-w-3xl">
                <div>
                  <input
                    type="text"
                    placeholder="Search by name, email, location..."
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-indigo-500"
                    value={crmFilters.search}
                    onChange={(e) => setCrmFilters(prev => ({ ...prev, search: e.target.value }))}
                  />
                </div>
                <div>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-lg p-2.5 outline-none cursor-pointer"
                    value={crmFilters.priority}
                    onChange={(e) => setCrmFilters(prev => ({ ...prev, priority: e.target.value }))}
                  >
                    <option value="all">All Priorities</option>
                    <option value="HIGH">High Priority</option>
                    <option value="MEDIUM">Medium Priority</option>
                    <option value="LOW">Low Priority</option>
                  </select>
                </div>
                <div>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-lg p-2.5 outline-none cursor-pointer"
                    value={crmFilters.status}
                    onChange={(e) => setCrmFilters(prev => ({ ...prev, status: e.target.value }))}
                  >
                    <option value="all">All Statuses</option>
                    <option value="not_contacted">Not Contacted</option>
                    <option value="emailed">Emailed</option>
                    <option value="replied_interested">Replied - Interested</option>
                    <option value="mockup_sent">Mockup Sent</option>
                    <option value="mockup_followup">Mockup Followup</option>
                    <option value="closed_won">Closed Won</option>
                    <option value="closed_lost">Closed Lost</option>
                  </select>
                </div>
              </div>

              <div>
                <button
                  onClick={handleExportCrmToSheets}
                  disabled={crmSaving || !filteredCrmLeads.length}
                  className={`w-full md:w-auto flex items-center justify-center space-x-2 font-bold py-2.5 px-5 rounded-xl shadow-sm text-xs transition-colors duration-200 ${
                    crmSaveSuccess
                      ? "bg-green-500 text-white"
                      : crmSaving
                      ? "bg-slate-400 cursor-not-allowed text-white"
                      : "bg-green-600 hover:bg-green-700 text-white"
                  }`}
                >
                  {crmSaving ? (
                    <>
                      <FaSpinner className="animate-spin" />
                      <span>Exporting...</span>
                    </>
                  ) : crmSaveSuccess ? (
                    <>
                      <FaCheck />
                      <span>Exported to Sheets!</span>
                    </>
                  ) : (
                    <>
                      <FaGoogle />
                      <span>Export Filtered ({filteredCrmLeads.length}) to Sheets</span>
                    </>
                  )}
                </button>
              </div>
            </section>

            {crmLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <FaSpinner className="animate-spin text-3xl text-indigo-600" />
                <span className="text-sm text-slate-500 mt-2 font-semibold">Loading CRM leads...</span>
              </div>
            ) : crmError ? (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl shadow-sm flex items-start space-x-3">
                <FaExclamationTriangle className="mt-1 flex-shrink-0" />
                <span className="text-sm">Error: {crmError}</span>
              </div>
            ) : filteredCrmLeads.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500">
                <FaFileAlt className="mx-auto text-4xl text-slate-300 mb-3" />
                <p className="text-base font-bold">No saved leads found matching these filters.</p>
                <p className="text-xs text-slate-400 mt-1">Try broadening your filters or scraping new leads under the Find Leads tab.</p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredCrmLeads.map((lead, idx) => (
                  <article key={lead.hash} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col h-full">
                    
                    {/* Card Header */}
                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-start gap-2">
                      <div>
                        <h3 className="font-extrabold text-slate-800 line-clamp-1">{lead.name}</h3>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase">{lead.category} &bull; {lead.location}</span>
                      </div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${getPriorityColor(lead.priority)}`}>
                        {lead.priority}
                      </span>
                    </div>

                    {/* Card Body */}
                    <div className="p-4 flex-grow space-y-3">
                      
                      {/* Interactive edit and read details */}
                      {editingHash === lead.hash ? (
                        <div className="space-y-2 border border-slate-200 p-2.5 rounded-xl bg-slate-50 text-xs">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-0.5">Contact Owner</label>
                            <input 
                              type="text" 
                              className="w-full bg-white border border-slate-300 rounded p-1"
                              value={editData.ownerName}
                              onChange={(e) => setEditData(prev => ({ ...prev, ownerName: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-0.5">Email Address</label>
                            <input 
                              type="email" 
                              className="w-full bg-white border border-slate-300 rounded p-1"
                              value={editData.email}
                              onChange={(e) => setEditData(prev => ({ ...prev, email: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-0.5">Social Page Link</label>
                            <input 
                              type="text" 
                              className="w-full bg-white border border-slate-300 rounded p-1"
                              value={editData.socialLink}
                              onChange={(e) => setEditData(prev => ({ ...prev, socialLink: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-0.5">Phone Number</label>
                            <input 
                              type="text" 
                              className="w-full bg-white border border-slate-300 rounded p-1"
                              value={editData.phone}
                              onChange={(e) => setEditData(prev => ({ ...prev, phone: e.target.value }))}
                            />
                          </div>
                          
                          <div className="flex gap-2 justify-end mt-2 pt-2 border-t border-slate-200">
                            <button 
                              onClick={() => setEditingHash(null)}
                              className="px-2.5 py-1 text-[10px] border border-slate-300 rounded bg-white hover:bg-slate-50 text-slate-600 font-bold"
                            >
                              Cancel
                            </button>
                            <button 
                              onClick={() => saveEditing(lead.hash)}
                              className="px-2.5 py-1 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold flex items-center gap-1"
                            >
                              <FaSave className="text-[9px]" />
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5 text-xs text-slate-600">
                          
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1 text-[10px] text-slate-400">👤 Owner Name:</span>
                            <span className="font-semibold text-slate-700">{lead.ownerName}</span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1 text-[10px] text-slate-400">✉️ Email:</span>
                            <span className="font-semibold text-slate-700 truncate max-w-[160px]">{lead.email}</span>
                          </div>

                          {lead.socialLink && lead.socialLink !== "N/A" && (
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1 text-[10px] text-slate-400">🌐 Social Page:</span>
                              <a href={lead.socialLink} target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-600 hover:underline flex items-center gap-0.5">
                                Visit Social <FaExternalLinkAlt className="text-[8px]" />
                              </a>
                            </div>
                          )}

                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1 text-[10px] text-slate-400">📞 Phone:</span>
                            <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-700">{lead.phone}</span>
                          </div>

                          <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                            <span className="text-[10px] text-slate-400">Website Status:</span>
                            {lead.website && lead.website.startsWith("http") ? (
                              <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline font-bold flex items-center gap-0.5">
                                Has Website <FaExternalLinkAlt className="text-[8px]" />
                              </a>
                            ) : (
                              <span className="text-red-500 font-bold">No Website Found</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Status Dropdown */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-400 uppercase font-bold flex-shrink-0">Outreach:</span>
                        <select
                          className={`text-xs rounded-lg px-2.5 py-1.5 border outline-none cursor-pointer flex-grow ${getStatusColor(lead.status)}`}
                          value={lead.status}
                          onChange={(e) => handleUpdateLeadField(lead.hash, { status: e.target.value })}
                        >
                          <option value="not_contacted">Not Contacted</option>
                          <option value="emailed">Emailed</option>
                          <option value="replied_interested">Replied - Interested</option>
                          <option value="mockup_sent">Mockup Sent</option>
                          <option value="mockup_followup">Mockup Followup</option>
                          <option value="closed_won">Closed Won 🎉</option>
                          <option value="closed_lost">Closed Lost</option>
                        </select>
                      </div>

                      {/* Lead Notes */}
                      <div className="pt-2">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">CRM Notes</label>
                        <textarea
                          placeholder="Add details about conversations, mockups, or followups..."
                          className="w-full bg-slate-50 border border-slate-200 text-xs rounded-lg p-2 outline-none focus:ring-1 focus:ring-indigo-500"
                          rows="2"
                          value={lead.notes}
                          onChange={(e) => {
                            // Find index and update locally immediately for responsiveness
                            const updatedLeads = [...crmLeads];
                            const idxInAll = updatedLeads.findIndex(l => l.hash === lead.hash);
                            if (idxInAll !== -1) {
                              updatedLeads[idxInAll].notes = e.target.value;
                              setCrmLeads(updatedLeads);
                            }
                          }}
                          onBlur={(e) => handleUpdateLeadField(lead.hash, { notes: e.target.value })}
                        ></textarea>
                      </div>

                    </div>

                    {/* Card Actions Footer */}
                    <div className="bg-slate-50 px-4 py-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      
                      {/* Left: Date or Enrich trigger */}
                      <div className="flex gap-2">
                        {(lead.email === "N/A" || lead.ownerName === "N/A") && (
                          <button
                            onClick={() => handleEnrichSingle(crmLeads.findIndex(l => l.hash === lead.hash), true)}
                            disabled={enrichingLeadHash === lead.hash}
                            className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-0.5 bg-indigo-50 px-2 py-1 rounded"
                          >
                            {enrichingLeadHash === lead.hash ? (
                              <FaSpinner className="animate-spin text-[8px]" />
                            ) : (
                              <>
                                <FaMagic className="text-[8px]" />
                                <span>Enrich</span>
                              </>
                            )}
                          </button>
                        )}
                        
                        <button
                          onClick={() => startEditing(lead)}
                          className="text-[10px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-0.5 bg-slate-100 px-2 py-1 rounded border border-slate-200"
                        >
                          <FaEdit className="text-[8px]" />
                          Edit
                        </button>
                      </div>

                      {/* Right: Delete */}
                      <button
                        onClick={() => handleDeleteLead(lead.hash)}
                        className="text-red-500 hover:text-red-700 font-bold flex items-center gap-0.5 bg-red-50 hover:bg-red-100 px-2 py-1 rounded transition-colors text-[10px]"
                      >
                        <FaTrash className="text-[8px]" />
                        Delete
                      </button>
                    </div>

                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Email Campaigns */}
        {activeTab === "campaigns" && (
          <div className="space-y-6 animate-fade-in">
            
            {/* Stats Panel */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Leads</span>
                <p className="text-2xl font-black text-slate-800 mt-1">{crmLeads.length}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                <span className="text-[10px] uppercase font-bold text-indigo-500">Ready to Send</span>
                <p className="text-2xl font-black text-indigo-600 mt-1">
                  {crmLeads.filter(l => (!l.emailStatus || l.emailStatus === "not_sent") && l.email && l.email !== "N/A").length}
                </p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                <span className="text-[10px] uppercase font-bold text-blue-500">Step 1 Sent</span>
                <p className="text-2xl font-black text-blue-600 mt-1">
                  {crmLeads.filter(l => l.emailStatus === "step1_sent").length}
                </p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                <span className="text-[10px] uppercase font-bold text-purple-500">Step 2 Sent</span>
                <p className="text-2xl font-black text-purple-600 mt-1">
                  {crmLeads.filter(l => l.emailStatus === "step2_sent").length}
                </p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                <span className="text-[10px] uppercase font-bold text-green-500 font-semibold">Replies ✅</span>
                <p className="text-2xl font-black text-green-600 mt-1">
                  {crmLeads.filter(l => l.emailStatus === "replied").length}
                </p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                <span className="text-[10px] uppercase font-bold text-red-500">Bounced ❌</span>
                <p className="text-2xl font-black text-red-600 mt-1">
                  {crmLeads.filter(l => l.emailStatus === "bounced").length}
                </p>
              </div>
            </div>

            {/* Campaign Controls */}
            <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Outreach Queue ({queue.length})</h2>
                  <p className="text-xs text-slate-500">Leads with valid emails ready for outreach or scheduled follow-ups.</p>
                </div>
                <button
                  onClick={fetchEmailQueue}
                  className="px-4 py-2 text-xs font-bold text-indigo-600 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  Refresh Queue
                </button>
              </div>

              {queueLoading ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <FaSpinner className="animate-spin text-2xl text-indigo-600" />
                  <span className="text-xs text-slate-500 mt-2 font-semibold">Checking queue...</span>
                </div>
              ) : queueError ? (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-xs">
                  Error loading queue: {queueError}
                </div>
              ) : queue.length === 0 ? (
                <div className="py-10 text-center text-slate-500 border border-dashed border-slate-200 rounded-xl">
                  <FaEnvelope className="mx-auto text-3xl text-slate-300 mb-2" />
                  <p className="text-sm font-bold">No emails in queue today.</p>
                  <p className="text-xs text-slate-400 mt-0.5">Scrape new leads, enrich emails, or wait for scheduled follow-ups.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                        <th className="py-3 px-4">Business</th>
                        <th className="py-3 px-4">Owner</th>
                        <th className="py-3 px-4">Email</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Priority</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {queue.map(lead => (
                        <tr key={lead.hash} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-bold text-slate-800">
                            <div>{lead.name}</div>
                            <div className="text-[10px] text-slate-400 font-normal">{lead.category} &bull; {lead.location}</div>
                          </td>
                          <td className="py-3 px-4 text-slate-600">{lead.ownerName || "N/A"}</td>
                          <td className="py-3 px-4 font-mono text-slate-600">{lead.email}</td>
                          <td className="py-3 px-4">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                              lead.emailStatus === "step1_sent"
                                ? "bg-blue-50 text-blue-700 border-blue-100"
                                : lead.emailStatus === "step2_sent"
                                ? "bg-purple-50 text-purple-700 border-purple-100"
                                : "bg-slate-50 text-slate-700 border-slate-100"
                            }`}>
                              {lead.emailStatus === "step1_sent" ? "Ready for Step 2" : lead.emailStatus === "step2_sent" ? "Ready for Step 3" : "Ready for Step 1"}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${getPriorityColor(lead.priority)}`}>
                              {lead.priority}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleOpenDraftModal(lead)}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg transition-colors inline-flex items-center gap-1 shadow-sm"
                            >
                              <FaMagic className="text-[9px]" />
                              Prepare AI Email
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Warmup Campaign Panel */}
            <section className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-xl space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg text-xs">
                      <FaFire className="animate-pulse" />
                    </span>
                    <h2 className="text-lg font-black tracking-tight text-slate-100">
                      Domain Warmup Playground
                    </h2>
                    {/* Show whether running via Vercel Cron or local interval */}
                    {warmupMode === "vercel-cron" ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-violet-500/20 text-violet-400 border border-violet-500/30">
                        ☁️ VERCEL CRON
                      </span>
                    ) : warmupMode === "local-interval" ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        💻 LOCAL DEV
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-400 mt-1 font-semibold text-slate-300">
                    Automated round-trip warmup: sends, opens &amp; replies via Brevo. Runs 24/7 on Vercel even when your laptop is off.
                  </p>
                </div>
                
                <div className="flex items-center gap-3">
                  {warmupConfig?.active ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping"></span>
                      WARMUP ACTIVE
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 text-xs font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
                      WARMUP INACTIVE
                    </div>
                  )}

                  <button
                    onClick={handleToggleWarmup}
                    disabled={warmupLoading}
                    className={`flex items-center gap-1.5 px-4 py-2 text-xs font-black rounded-xl shadow-md transition-all duration-200 ${
                      warmupConfig?.active
                        ? "bg-red-600 hover:bg-red-700 text-white"
                        : "bg-indigo-600 hover:bg-indigo-700 text-white"
                    }`}
                  >
                    {warmupLoading ? (
                      <FaSpinner className="animate-spin" />
                    ) : warmupConfig?.active ? (
                      <>
                        <FaStop />
                        <span>Stop Warmup</span>
                      </>
                    ) : (
                      <>
                        <FaPlay />
                        <span>Start Warmup</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Vercel env var instructions shown when warmup is toggled ON on Vercel */}
              {warmupEnvInstructions && (
                <div className="bg-violet-950/50 border border-violet-500/30 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-violet-400 text-sm">☁️</span>
                    <h3 className="text-sm font-bold text-violet-300">One-time Vercel Setup Required</h3>
                  </div>
                  <p className="text-xs text-violet-300/80">
                    To keep warmup running 24/7 (even after server restarts), add these 3 environment variables in your
                    {" "}<a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline text-violet-400">Vercel Dashboard → Settings → Environment Variables</a>:
                  </p>
                  <div className="space-y-1.5">
                    {Object.entries(warmupEnvInstructions).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2 bg-slate-950 rounded-lg px-3 py-2 border border-slate-800">
                        <code className="text-amber-400 text-xs font-mono font-bold">{key}</code>
                        <span className="text-slate-600">=</span>
                        <code className="text-emerald-400 text-xs font-mono">{value}</code>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-violet-400/70">
                    ⚡ After adding these, redeploy your app. Vercel Cron will call <code className="font-mono">/api/warmup/trigger</code> every 30 minutes automatically — no laptop needed!
                  </p>
                  <button
                    onClick={() => setWarmupEnvInstructions(null)}
                    className="text-[11px] text-slate-500 hover:text-slate-400 underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Stats & Current limits */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Daily Volume Today</span>
                  <p className="text-2xl font-black text-slate-100 mt-1 font-mono">
                    {warmupConfig?.sentToday ?? 0} / {warmupConfig?.currentLimit ?? 5}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Limit increases weekly
                  </p>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Total Sent</span>
                  <p className="text-2xl font-black text-indigo-400 mt-1 font-mono">
                    {warmupStats?.totalSent ?? 0}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Initial messages initiated
                  </p>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Opens &amp; Replies</span>
                  <p className="text-2xl font-black text-emerald-400 mt-1 font-mono">
                    {warmupStats?.totalOpened ?? 0} / {warmupStats?.totalReplied ?? 0}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Simulated back-and-forth
                  </p>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Campaign Status</span>
                  <p className="text-lg font-black text-slate-100 mt-1.5">
                    {warmupConfig?.active ? (
                      <span className="text-green-400">{warmupConfig.daysLeft} Days Left</span>
                    ) : (
                      <span className="text-slate-400">Ready to Start</span>
                    )}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Duration: {warmupConfig?.durationDays ?? 14} days
                  </p>
                </div>
              </div>

              {/* Interactive Sandbox tools */}
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800/80 space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-200">Sandbox Controls</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {warmupMode === "vercel-cron"
                        ? "Running on Vercel Cron — fires every 30 min automatically. Use \"Send Test\" to trigger manually."
                        : "Running locally — stops when dev server stops. Deploy to Vercel for 24/7 warmup."
                      }
                    </p>
                  </div>
                  <button
                    onClick={handleTriggerWarmupEmail}
                    disabled={warmupTriggering}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-bold rounded-xl border border-indigo-500/30 transition-all cursor-pointer"
                  >
                    {warmupTriggering ? (
                      <>
                        <FaSpinner className="animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <FaEnvelope />
                        <span>Send Test Warmup Email</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="text-xs text-slate-400 border-t border-slate-800/80 pt-4 space-y-2">
                  <h4 className="font-bold text-slate-300">Required Configuration Checklist (Brevo Inbound):</h4>
                  <ul className="list-disc pl-5 space-y-1 text-slate-400 text-[11px]">
                    <li>
                      Create a subdomain MX record for <code className="text-indigo-400 font-mono">reply.supaautomation.agency</code> pointing to:
                      <br />
                      <span className="font-mono text-slate-300">10 inbound1.sendinblue.com</span> and <span className="font-mono text-slate-300">20 inbound2.sendinblue.com</span>
                    </li>
                    <li>
                      In Brevo Dashboard, go to <strong className="text-slate-300 font-bold">Transactional &gt; Settings &gt; Webhooks</strong> and add a webhook:<br />
                      <span className="font-mono text-slate-300">URL: https://your-app.vercel.app/api/warmup/inbound</span>
                    </li>
                    <li>
                      Enable the <strong className="text-slate-300 font-bold">Inbound Event Webhook</strong> (trigger on incoming emails).
                    </li>
                    <li className="text-violet-400">
                      <strong>For 24/7 warmup on Vercel:</strong> Add <code className="font-mono">WARMUP_ACTIVE=true</code>, <code className="font-mono">WARMUP_START_DATE</code>, and <code className="font-mono">WARMUP_DURATION_DAYS=14</code> in Vercel env vars. The cron job handles the rest!
                    </li>
                  </ul>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Email Draft Preview & Edit Modal */}
      {activeDraftLead && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Prepare AI Outreach: {activeDraftLead.name}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Sending to <span className="font-mono">{activeDraftLead.email}</span> &bull; Current Status: <span className="font-semibold uppercase">{activeDraftLead.emailStatus || "Not Sent"}</span>
                </p>
              </div>
              <button
                onClick={() => setActiveDraftLead(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-grow space-y-4">
              {draftGenerating ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <FaSpinner className="animate-spin text-3xl text-indigo-600" />
                  <span className="text-xs text-slate-500 mt-3 font-semibold">AI is drafting a personalized pitch...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Email Subject
                    </label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-800"
                      value={editedSubject}
                      onChange={(e) => setEditedSubject(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Email Body (Plain Text)
                    </label>
                    <textarea
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-slate-700"
                      rows="12"
                      value={editedBody}
                      onChange={(e) => setEditedBody(e.target.value)}
                    ></textarea>
                  </div>
                  
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
                    <FaExclamationTriangle className="text-amber-500 mt-0.5 text-xs flex-shrink-0" />
                    <div className="text-[10px] text-amber-800 leading-relaxed">
                      <strong>Deliverability Tip:</strong> Keep emails concise, plain text, and avoid marketing buzzwords. Each email generated by this app is unique to prevent spam filters from grouping your outreach.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {!draftGenerating && (
              <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50 rounded-b-2xl">
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setDraftGenerating(true);
                      try {
                        const res = await fetch("/api/email/generate", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ hash: activeDraftLead.hash })
                        });
                        if (!res.ok) throw new Error("Regeneration failed.");
                        const data = await res.json();
                        setEditedSubject(data.draft.subject || "");
                        setEditedBody(data.draft.body || "");
                      } catch (err) {
                        alert("Failed: " + err.message);
                      } finally {
                        setDraftGenerating(false);
                      }
                    }}
                    className="px-3.5 py-2 text-xs font-bold text-indigo-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl flex items-center gap-1 transition-colors"
                  >
                    <FaMagic className="text-[9px]" />
                    Regenerate
                  </button>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveDraftLead(null)}
                    className="px-4 py-2 text-xs border border-slate-300 rounded-xl bg-white hover:bg-slate-50 text-slate-600 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendEmail}
                    disabled={emailSending}
                    className="px-5 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    {emailSending ? (
                      <>
                        <FaSpinner className="animate-spin text-[10px]" />
                        <span>Sending Email...</span>
                      </>
                    ) : (
                      <>
                        <FaEnvelope className="text-[10px]" />
                        <span>Send Email Now</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-20 py-8 bg-white border-t border-slate-200 text-center text-slate-400 text-xs">
        <p>&copy; {new Date().getFullYear()} LeadFinder AI. All rights reserved.</p>
        <p className="mt-1 font-semibold text-slate-400 uppercase tracking-widest text-[9px] flex items-center justify-center gap-1">
          CRM &amp; Lead Enrichment Engine Active
        </p>
      </footer>
    </div>
  );
}
