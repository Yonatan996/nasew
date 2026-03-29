import { Divider } from "antd";
import { useState, useEffect, useMemo } from "react";
import { getAuth } from "firebase/auth";
import { EditOutlined, DownloadOutlined } from '@ant-design/icons';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { collection, getDocs, query, where, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from '../Sales/Components/firebase';

// Debounce hook for search input
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// Searchable Dropdown Component
function SearchableDropdown({ options, value, onChange, placeholder, name }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const filteredOptions = useMemo(() => {
    return options.filter(option =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, options]);

  const handleSelect = (optionValue, optionLabel) => {
    onChange({ target: { name, value: optionValue } });
    setSearchTerm("");
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#117960] focus:border-[#117960] transition-colors"
      />
      {searchTerm && (
        <button
          onClick={() => setSearchTerm("")}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      )}
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <div
                key={option.value}
                onClick={() => handleSelect(option.value, option.label)}
                className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
              >
                {option.label}
              </div>
            ))
          ) : (
            <div className="px-4 py-2 text-gray-500">No results found</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function OfficeSiteVisit() {
  const [supervisor, setSupervisor] = useState(null);
  const [salesAgents, setSalesAgents] = useState([]);
  const [prospects, setProspects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [prospectFilters, setProspectFilters] = useState([]);
  const [supervisorId, setSupervisorId] = useState("");
  const [editingVisitId, setEditingVisitId] = useState(null);
  const [visitsData, setVisitsData] = useState([]);
  const [editVisitFormData, setEditVisitFormData] = useState({});
  const [animationStatus, setAnimationStatus] = useState("");
  const [filteredVisitsData, setFilteredVisitsData] = useState([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchPhone, setSearchPhone] = useState("");
  const debouncedSearchPhone = useDebounce(searchPhone, 500);
  const [currentPage, setCurrentPage] = useState(1);
  const [visitTypeFilter, setVisitTypeFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [siteFilter, setSiteFilter] = useState("");
  const rowsPerPage = 5;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    clientId: "",
    clientName: "",
    phoneNumber: "",
    foundThrough: "",
    visitDate: "",
    visitDetails: "",
    salesAgent: "",
    clientFeedback: "",
    site: "",
    siteVisit: false,
    officeVisit: false,
    remark: "",
    supervisor: ""
  });

  useEffect(() => {
    setFormData((prevFormData) => ({
      ...prevFormData,
      supervisor: supervisorId,
    }));
  }, [supervisorId]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const auth = getAuth();
        const currentUser = auth.currentUser;
        const userQuery = query(
          collection(db, "teamMembers"),
          where("userId", "==", currentUser.uid)
        );
        const userSnapshot = await getDocs(userQuery);
        if (userSnapshot.empty) {
          throw new Error("No user found in the database");
        }
        const userData = userSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        const userDocId = userData[0].id;

        const supervisorQuery = query(
          collection(db, "teamMembers"),
          where("role", "==", "Supervisor"),
          where("userId", "==", currentUser.uid)
        );
        const supervisorSnapshot = await getDocs(supervisorQuery);
        if (supervisorSnapshot.empty) {
          throw new Error("No supervisor found in the database");
        }
        const supervisorData = supervisorSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        const supervisor = supervisorData[0];
        setSupervisor(supervisor);
        setSupervisorId(supervisor.id);

        const salesAgentQuery = query(
          collection(db, "teamMembers"),
          where("role", "==", "Sales Agent"),
          where("supervisor", "==", userDocId)
        );
        const supAgentQuery = query(
          collection(db, "teamMembers"),
          where("userId", "==", currentUser.uid)
        );
        const prospectQuery = query(collection(db, "Prospect"));
        const visitsQuery = query(
          collection(db, "visits"),
          where("supervisor", "==", userDocId)
        );

        const [
          salesAgentSnapshot,
          supAgentSnapshot,
          prospectSnapshot,
          visitsSnapshot
        ] = await Promise.all([
          getDocs(salesAgentQuery),
          getDocs(supAgentQuery),
          getDocs(prospectQuery),
          getDocs(visitsQuery)
        ]);

        const agentsData = salesAgentSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        const supAgentData = supAgentSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        const allAgentsData = [...supAgentData, ...agentsData];
        setSalesAgents(allAgentsData);

        const prospectsData = prospectSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setProspects(prospectsData);

        const visitsData = visitsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          visitDate: doc.data().visitDate || new Date().toISOString()
        })).sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate));
        setVisitsData(visitsData);
        setFilteredVisitsData(visitsData);
      } catch (error) {
        console.error("Error fetching dashboard data:", error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [supervisorId]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleDownloadReport = () => {
    const csvContent = [
      ["Client", "Visit Date", "Sales Agent", "Client Feedback", "Site", "Site Visit", "Office Visit", "Remark"],
      ...filteredVisitsData.map((visit) => [
        `${visit.clientName} - ${visit.phoneNumber || prospects.find(p => p.id === visit.clientId)?.["Phone number"] || "N/A"}`,
        new Date(visit.visitDate).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        salesAgents.find((agent) => agent.id === visit.salesAgent)?.name || supervisor?.name || visit.salesAgent,
        visit.clientFeedback,
        visit.site,
        visit.siteVisit ? "Yes" : "No",
        visit.officeVisit ? "Yes" : "No",
        visit.remark || "",
      ]),
    ]
      .map((e) => e.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    const dateRangeStr = dateFrom && dateTo
      ? `from_${new Date(dateFrom).toLocaleDateString("en-GB")}_to_${new Date(dateTo).toLocaleDateString("en-GB")}`
      : "all_dates";
    link.setAttribute("download", `visits_report_${dateRangeStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setAnimationStatus("");
    try {
      const submissionData = {
        ...formData,
        visitDate: formData.visitDate ? new Date(formData.visitDate).toISOString() : new Date().toISOString()
      };
      await addDoc(collection(db, "visits"), submissionData);
      setAnimationStatus("success");
      setTimeout(async () => {
        setAnimationStatus("");
        setFormData({
          clientId: "",
          clientName: "",
          phoneNumber: "",
          foundThrough: "",
          visitDate: "",
          visitDetails: "",
          salesAgent: "",
          clientFeedback: "",
          site: "",
          siteVisit: false,
          officeVisit: false,
          remark: "",
          supervisor: supervisorId
        });
        setProspectFilters([]);
        setIsSubmitting(false);
        const visitsQuery = query(collection(db, "visits"), where("supervisor", "==", supervisorId));
        const visitsSnapshot = await getDocs(visitsQuery);
        const updatedVisits = visitsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          visitDate: doc.data().visitDate || new Date().toISOString()
        })).sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate));
        setVisitsData(updatedVisits);
        setFilteredVisitsData(updatedVisits);
      }, 1500);
    } catch (e) {
      console.error("Error adding document: ", e);
      setAnimationStatus("error");
      setIsSubmitting(false);
    }
  };

  const handleVisitEdit = (visit) => {
    setEditingVisitId(visit.id);
    setEditVisitFormData({
      ...visit,
      visitDate: visit.visitDate instanceof Date
        ? visit.visitDate.toISOString().split('T')[0]
        : new Date(visit.visitDate).toISOString().split('T')[0]
    });
  };

  const handleVisitInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditVisitFormData((prevFormData) => ({
      ...prevFormData,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSaveVisitEdit = async () => {
    try {
      const visitRef = doc(db, "visits", editingVisitId);
      const updatedData = {
        ...editVisitFormData,
        visitDate: new Date(editVisitFormData.visitDate).toISOString()
      };
      await updateDoc(visitRef, updatedData);
      setVisitsData((prevVisitsData) =>
        prevVisitsData.map((visit) =>
          visit.id === editingVisitId ? { ...visit, ...updatedData } : visit
        )
      );
      setEditingVisitId(null);
      setAnimationStatus("success");
      setTimeout(() => setAnimationStatus(""), 1500);
    } catch (error) {
      console.error("Error updating visit:", error);
      setAnimationStatus("error");
    }
  };

  useEffect(() => {
    let filtered = visitsData;

    // Date filter
    filtered = filtered.filter((visit) => {
      const visitDate = visit.visitDate?.seconds
        ? new Date(visit.visitDate.seconds * 1000)
        : new Date(visit.visitDate);
      const fromDate = dateFrom ? new Date(dateFrom) : null;
      const toDate = dateTo ? new Date(dateTo) : null;

      if (fromDate && toDate) {
        return visitDate >= fromDate && visitDate <= toDate;
      } else if (fromDate) {
        return visitDate >= fromDate;
      } else if (toDate) {
        return visitDate <= toDate;
      }
      return true;
    });

    // Phone number filter
    filtered = filtered.filter((visit) => {
      const phone = visit.clientId === "Others"
        ? visit.phoneNumber?.toString().toLowerCase()
        : prospects.find(p => p.id === visit.clientId)?.["Phone number"]?.toString().toLowerCase();
      return !debouncedSearchPhone || (phone && phone.includes(debouncedSearchPhone.toLowerCase()));
    });

    // Agent filter
    if (agentFilter) {
      filtered = filtered.filter((visit) => visit.salesAgent === agentFilter);
    }

    // Site filter
    if (siteFilter) {
      filtered = filtered.filter((visit) => visit.site === siteFilter);
    }

    // Visit type filter
    if (visitTypeFilter === "site") {
      filtered = filtered.filter((visit) => visit.siteVisit === true);
    } else if (visitTypeFilter === "office") {
      filtered = filtered.filter((visit) => visit.officeVisit === true);
    }

    setFilteredVisitsData(filtered);
    setCurrentPage(1);
  }, [dateFrom, dateTo, debouncedSearchPhone, agentFilter, siteFilter, visitTypeFilter, visitsData, prospects]);

  // Unique sites for filter dropdown
  const uniqueSites = [...new Set(visitsData.map(visit => visit.site).filter(site => site))];

  // Dropdown options
  const agentOptions = [
    { value: "", label: "All Agents" },
    { value: "digital_marketing", label: "Digital Marketing" },
    { value: "freelance", label: "Freelance" },
    ...salesAgents.map(agent => ({ value: agent.id, label: agent.name }))
  ];

  const siteOptions = [
    { value: "", label: "All Sites" },
    { value: "Yebe Real Estate", label: "Yebe Real Estate" },
    { value: "Addis Empire Real Estate", label: "Addis Empire Real Estate" },
    { value: "Sunshine Real Estate", label: "Sunshine Real Estate" },
    ...uniqueSites
      .filter(site => !["Yebe Real Estate", "Addis Empire Real Estate", "Sunshine Real Estate"].includes(site))
      .map(site => ({ value: site, label: site }))
  ];

  const visitTypeOptions = [
    { value: "", label: "All Types" },
    { value: "site", label: "Site Visit" },
    { value: "office", label: "Office Visit" }
  ];

  // Pagination
  const totalPages = Math.ceil(filteredVisitsData.length / rowsPerPage);
  const paginatedData = filteredVisitsData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Check if visit is editable (within 24 hours)
  const isWithin24Hours = (visitDate) => {
    const visitTime = visitDate?.seconds
      ? new Date(visitDate.seconds * 1000)
      : new Date(visitDate);
    const now = new Date();
    const diffHours = (now - visitTime) / (1000 * 60 * 60);
    return diffHours <= 24;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-[#117960]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h2 className="text-3xl font-bold mb-2 mt-3" style={{ fontFamily: 'Noto Sans, sans-serif' }}>
        Office and Site Visits
      </h2>
      <Divider className="bg-gray-300" />

      {/* Visits Table */}
      <div className="max-w-full mx-auto bg-white p-6 rounded-xl shadow-lg mt-5" style={{ fontFamily: 'Noto Sans, sans-serif' }}>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-6 mb-6">
          <div>
            <label className="block mb-2 font-semibold text-gray-700">Search by Phone Number</label>
            <input
              type="text"
              value={searchPhone}
              onChange={(e) => setSearchPhone(e.target.value)}
              placeholder="Enter phone number"
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#117960] focus:border-[#117960] transition-colors"
            />
          </div>
          <div>
            <label className="block mb-2 font-semibold text-gray-700">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#117960] focus:border-[#117960] transition-colors"
            />
          </div>
          <div>
            <label className="block mb-2 font-semibold text-gray-700">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#117960] focus:border-[#117960] transition-colors"
            />
          </div>
          <div>
            {/* <label className="block mb-2 font-semibold text-gray-700">Sales Agent</label> */}
            {/* <SearchableDropdown
              options={agentOptions}
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              placeholder="Select Agent"
              name="agentFilter"
            />
          </div>
          <div>
            <label className="block mb-2 font-semibold text-gray-700">Site</label>
            <SearchableDropdown
              options={siteOptions}
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              placeholder="Select Site"
              name="siteFilter"
            />
          </div>
          <div>
            <label className="block mb-2 font-semibold text-gray-700">Visit Type</label>
            <SearchableDropdown
              options={visitTypeOptions}
              value={visitTypeFilter}
              onChange={(e) => setVisitTypeFilter(e.target.value)}
              placeholder="Select Type"
              name="visitTypeFilter"
            /> */}
          </div>
        </div>
        <div className="flex justify-end mb-4">
          {/* <button
            onClick={handleDownloadReport}
            className="inline-flex items-center justify-center py-2 px-4 rounded-full text-white font-medium transition-all duration-300 bg-gradient-to-r from-[#34d399] to-[#059669] hover:from-[#10b981] hover:to-[#047857] shadow-md hover:shadow-lg"
          >
            <DownloadOutlined className="mr-2" /> Download Report
          </button> */}
        </div>
        <div className="mb-6 bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-xl shadow-lg transform transition-all duration-300 hover:shadow-xl">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
            <svg className="w-6 h-6 mr-2 text-[#117960]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-6h6v6m-6 0h6m4 0h-4m-6 0H5m4-14h6v4H9v-4z"></path>
            </svg>
            Visit Summary
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg shadow-md hover:bg-gray-50 transition-colors duration-200">
              <p className="text-sm font-medium text-gray-600">Time Period</p>
              <p className="text-lg font-semibold text-[#117960] mt-1">
                {dateFrom || dateTo
                  ? `${dateFrom ? new Date(dateFrom).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Start"} to ${dateTo ? new Date(dateTo).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "End"}`
                  : "All Visits"}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md hover:bg-gray-50 transition-colors duration-200">
              <p className="text-sm font-medium text-gray-600">Office Visits</p>
              <p className="text-lg font-semibold text-[#34d399] mt-1">
                {visitTypeFilter === "site" ? "-" : filteredVisitsData.filter((visit) => visit.officeVisit).length}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md hover:bg-gray-50 transition-colors duration-200">
              <p className="text-sm font-medium text-gray-600">Site Visits</p>
              <p className="text-lg font-semibold text-[#059669] mt-1">
                {visitTypeFilter === "office" ? "-" : filteredVisitsData.filter((visit) => visit.siteVisit).length}
              </p>
            </div>
          </div>
        </div>

        <div className="relative">
          {animationStatus === "success" && editingVisitId && (
            <div className="absolute top-0 left-0 w-full h-full flex justify-center items-center bg-white bg-opacity-50 z-10">
              <DotLottieReact
                src="https://lottie.host/2cc98f5a-e22e-46d3-b73f-fb1b40fd9364/E8mJpbWQYS.lottie"
                loop
                autoplay
                style={{ width: 100, height: 100 }}
              />
            </div>
          )}
          {animationStatus === "error" && editingVisitId && (
            <div className="absolute top-0 left-0 w-full h-full flex justify-center items-center bg-white bg-opacity-80 z-10">
              <p className="text-red-500 text-center font-semibold">Error updating the visit. Please try again.</p>
            </div>
          )}
          {/* {editingVisitId && !isWithin24Hours(visitsData.find(v => v.id === editingVisitId)?.visitDate) && (
            <div className="absolute top-0 left-0 w-full h-full flex justify-center items-center bg-white bg-opacity-80 z-10">
              <p className="text-red-500 text-center font-semibold text-lg">
                You can only edit the remark field after 24 hours.
              </p>
            </div>
          )} */}
          <div className="overflow-x-auto">
            <table className="w-full table-auto text-left border-separate border-spacing-0 rounded-lg">
              <thead className="bg-[#117960] text-white">
                <tr>
                  <th className="py-3 px-4 rounded-tl-lg">Client</th>
                  <th className="py-3 px-4">Visit Date</th>
                  <th className="py-3 px-4">Sales Agent</th>
                  <th className="py-3 px-4">Client Feedback</th>
                  <th className="py-3 px-4">Site</th>
                  <th className="py-3 px-4">Site Visit</th>
                  <th className="py-3 px-4">Office Visit</th>
                  <th className="py-3 px-4">Remark</th>
                  <th className="py-3 px-4 rounded-tr-lg">Actions</th>
                </tr>
              </thead>
              <tbody className="text-gray-600">
                {paginatedData.map((visit) => {
                  const agent = salesAgents.find((agent) => agent.id === visit.salesAgent) || supervisor;
                  const isEditing = editingVisitId === visit.id;
                  const canEditAll = isWithin24Hours(visit.visitDate);

                  return (
                    <tr key={visit.id} className="hover:bg-gray-100 transition-colors">
                      {isEditing ? (
                        <>
                          <td className="py-3 px-4 border-b">
                            {canEditAll ? (
                              <>
                                <input
                                  type="text"
                                  placeholder="Search by phone number"
                                  onChange={(e) => {
                                    const searchTerm = e.target.value.toLowerCase();
                                    setProspectFilters(searchTerm
                                      ? prospects.filter((prospect) =>
                                          prospect["Phone number"].toLowerCase().includes(searchTerm)
                                        )
                                      : []);
                                  }}
                                  className="w-full p-3 border rounded-lg mb-2 focus:ring-2 focus:ring-[#117960]"
                                />
                                <select
                                  name="clientId"
                                  value={editVisitFormData.clientId}
                                  onChange={(e) => {
                                    const selectedProspect = prospects.find((p) => p.id === e.target.value);
                                    setEditVisitFormData((prev) => ({
                                      ...prev,
                                      clientId: e.target.value,
                                      clientName: selectedProspect?.Name || "",
                                      phoneNumber: selectedProspect?.["Phone number"] || ""
                                    }));
                                  }}
                                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#117960]"
                                  required
                                >
                                  <option value="">Select Prospect</option>
                                  {prospectFilters.map((prospect) => (
                                    <option key={prospect.id} value={prospect.id}>
                                      {prospect.Name} - {prospect["Phone number"]}
                                    </option>
                                  ))}
                                  <option value="Others">Others</option>
                                </select>
                                {editVisitFormData.clientId === "Others" && (
                                  <>
                                    <input
                                      type="text"
                                      name="clientName"
                                      value={editVisitFormData.clientName}
                                      onChange={handleVisitInputChange}
                                      className="w-full p-3 border rounded-lg mt-2 focus:ring-2 focus:ring-[#117960]"
                                      placeholder="Enter client name"
                                    />
                                    <input
                                      type="text"
                                      name="phoneNumber"
                                      value={editVisitFormData.phoneNumber}
                                      onChange={handleVisitInputChange}
                                      className="w-full p-3 border rounded-lg mt-2 focus:ring-2 focus:ring-[#117960]"
                                      placeholder="Enter phone number"
                                    />
                                  </>
                                )}
                              </>
                            ) : (
                              <span>{visit.clientName} - {visit.phoneNumber || prospects.find(p => p.id === visit.clientId)?.["Phone number"] || "N/A"}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 border-b">
                            {canEditAll ? (
                              <input
                                type="date"
                                name="visitDate"
                                value={editVisitFormData.visitDate instanceof Date
                                  ? editVisitFormData.visitDate.toISOString().split('T')[0]
                                  : editVisitFormData.visitDate}
                                onChange={handleVisitInputChange}
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#117960]"
                                required
                              />
                            ) : (
                              <span>
                                {new Date(visit.visitDate).toLocaleDateString("en-GB", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 border-b">
                            {canEditAll ? (
                              <select
                                name="salesAgent"
                                value={editVisitFormData.salesAgent}
                                onChange={handleVisitInputChange}
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#117960]"
                                required
                              >
                                <option value="">Select Agent</option>
                                <option value="digital_marketing">Digital Marketing</option>
                                <option value="freelance">Freelance</option>
                                {salesAgents.map((agent) => (
                                  <option key={agent.id} value={agent.id}>
                                    {agent.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span>{agent?.name || visit.salesAgent}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 border-b">
                            {canEditAll ? (
                              <input
                                type="text"
                                name="clientFeedback"
                                value={editVisitFormData.clientFeedback}
                                onChange={handleVisitInputChange}
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#117960]"
                                required
                              />
                            ) : (
                              <span>{visit.clientFeedback}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 border-b">
                            {canEditAll ? (
                              <>
                                <select
                                  name="site"
                                  value={editVisitFormData.site}
                                  onChange={handleVisitInputChange}
                                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#117960]"
                                  required
                                >
                                  <option value="" disabled>Select Site</option>
                                  <option value="Yebe Real Estate">Yebe Real Estate</option>
                                  <option value="Addis Empire Real Estate">Addis Empire Real Estate</option>
                                  <option value="Sunshine Real Estate">Sunshine Real Estate</option>
                                  <option value="Other">Other</option>
                                </select>
                                {editVisitFormData.site === "Other" && (
                                  <input
                                    type="text"
                                    name="otherSite"
                                    value={editVisitFormData.otherSite || ""}
                                    onChange={handleVisitInputChange}
                                    className="w-full p-3 border rounded-lg mt-2 focus:ring-2 focus:ring-[#117960]"
                                    placeholder="Please specify other site"
                                    required
                                  />
                                )}
                              </>
                            ) : (
                              <span>{visit.site || ""}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 border-b">
                            {canEditAll ? (
                              <input
                                type="checkbox"
                                name="siteVisit"
                                checked={editVisitFormData.siteVisit}
                                onChange={handleVisitInputChange}
                                className="h-5 w-5 text-[#117960] focus:ring-[#117960]"
                              />
                            ) : (
                              <span>{visit.siteVisit ? "Yes" : "No"}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 border-b">
                            {canEditAll ? (
                              <input
                                type="checkbox"
                                name="officeVisit"
                                checked={editVisitFormData.officeVisit}
                                onChange={handleVisitInputChange}
                                className="h-5 w-5 text-[#117960] focus:ring-[#117960]"
                              />
                            ) : (
                              <span>{visit.officeVisit ? "Yes" : "No"}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 border-b">
                            <input
                              type="text"
                              name="remark"
                              value={editVisitFormData.remark || ""}
                              onChange={handleVisitInputChange}
                              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#117960]"
                            />
                          </td>
                          <td className="py-3 px-4 border-b flex flex-col sm:flex-row items-center justify-between gap-2">
                            <button
                              onClick={handleSaveVisitEdit}
                              className="w-full sm:w-auto inline-flex items-center justify-center py-2 px-4 rounded-full text-white font-medium transition-all duration-300 bg-gradient-to-r from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 shadow-md hover:shadow-lg"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingVisitId(null)}
                              className="w-full sm:w-auto inline-flex items-center justify-center py-2 px-4 rounded-full text-white font-medium transition-all duration-300 bg-gradient-to-r from-gray-400 to-gray-600 hover:from-gray-500 hover:to-gray-700 shadow-md hover:shadow-lg"
                            >
                              Cancel
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-3 px-4 border-b">{visit.clientName} - {visit.phoneNumber || prospects.find(p => p.id === visit.clientId)?.["Phone number"] || "N/A"}</td>
                          <td className="py-3 px-4 border-b">
                            {new Date(visit.visitDate).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className="py-3 px-4 border-b">{agent?.name || visit.salesAgent}</td>
                          <td className="py-3 px-4 border-b">{visit.clientFeedback}</td>
                          <td className="py-3 px-4 border-b">{visit.site || ""}</td>
                          <td className="py-3 px-4 border-b">{visit.siteVisit ? "Yes" : "No"}</td>
                          <td className="py-3 px-4 border-b">{visit.officeVisit ? "Yes" : "No"}</td>
                          <td className="py-3 px-4 border-b">{visit.remark || ""}</td>
                          <td className="py-3 px-4 border-b flex flex-col sm:flex-row items-center justify-between gap-2">
                            <button
                              onClick={() => handleVisitEdit(visit)}
                              className="w-full sm:w-auto inline-flex items-center justify-center py-2 px-4 rounded-full text-white font-medium transition-all duration-300 bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 shadow-md hover:shadow-lg"
                            >
                              <EditOutlined className="mr-2" /> Edit
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-4">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className={`py-2 px-4 rounded-full text-white font-medium transition-all duration-300 ${currentPage === 1 ? 'bg-gray-300 cursor-not-allowed' : 'bg-gradient-to-r from-[#117960] to-[#059669] hover:from-[#10b981] hover:to-[#047857] shadow-md hover:shadow-lg'}`}
            >
              Previous
            </button>
            <span className="text-gray-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={`py-2 px-4 rounded-full text-white font-medium transition-all duration-300 ${currentPage === totalPages ? 'bg-gray-300 cursor-not-allowed' : 'bg-gradient-to-r from-[#117960] to-[#059669] hover:from-[#10b981] hover:to-[#047857] shadow-md hover:shadow-lg'}`}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Registration Form */}
      <div className="max-w-2xl mx-auto bg-white p-6 rounded-xl shadow-lg mt-10" style={{ fontFamily: 'Noto Sans, sans-serif' }}>
        <h2 className="text-3xl font-bold mb-4 text-gray-800">Register Office/Site Visit</h2>
        <Divider className="bg-gray-300" />
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <label className="text-xl font-semibold block mb-2 text-gray-800">Client Contact</label>
            <input
              type="text"
              placeholder="Search by phone number"
              onChange={(e) => {
                const searchTerm = e.target.value.toLowerCase();
                setProspectFilters(searchTerm
                  ? prospects.filter(prospect =>
                      prospect["Phone number"].toLowerCase().includes(searchTerm)
                    )
                  : []);
              }}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#117960] transition-colors"
            />
            <select
              name="clientId"
              value={formData.clientId}
              onChange={(e) => {
                const selectedProspect = prospects.find(prospect => prospect.id === e.target.value);
                setFormData(prevData => ({
                  ...prevData,
                  clientId: e.target.value,
                  clientName: selectedProspect?.Name || "",
                  phoneNumber: selectedProspect?.["Phone number"] || ""
                }));
              }}
              className="w-full p-3 border rounded-lg mt-2 focus:ring-2 focus:ring-[#117960]"
              required
            >
              <option value="">Select Prospect</option>
              {prospectFilters.map((prospect) => (
                <option key={prospect.id} value={prospect.id}>
                  {prospect.Name} - {prospect["Phone number"]}
                </option>
              ))}
              <option value="Others">Others</option>
            </select>
            {formData.clientId === "Others" && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-gray-700 mb-2 font-medium">Client Name</label>
                  <input
                    type="text"
                    name="clientName"
                    value={formData.clientName}
                    onChange={handleChange}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#117960]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2 font-medium">Client Phone Number</label>
                  <input
                    type="text"
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleChange}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#117960]"
                    required
                  />
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="block text-gray-700 mb-2 font-medium">Visit Date</label>
            <input
              type="date"
              name="visitDate"
              value={formData.visitDate}
              onChange={handleChange}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#117960]"
              required
              max={new Date().toISOString().split("T")[0]}
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-2 font-medium">Sales Agent</label>
            <select
              name="salesAgent"
              value={formData.salesAgent}
              onChange={handleChange}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#117960]"
              required
            >
              <option value="">Select Agent</option>
              <option value="digital_marketing" style={{ fontStyle: 'italic' }}>Digital Marketing</option>
              <option value="freelance" style={{ fontStyle: 'italic' }}>Freelance</option>
              {salesAgents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-700 mb-2 font-medium">Site</label>
            <select
              name="site"
              value={formData.site}
              onChange={handleChange}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#117960]"
              required
            >
              <option value="" disabled>Select Site</option>
              <option value="Yebe Real Estate">Yebe Real Estate</option>
              <option value="Addis Empire Real Estate">Addis Empire Real Estate</option>
              <option value="Sunshine Real Estate">Sunshine Real Estate</option>
              <option value="Other">Other</option>
            </select>
            {formData.site === "Other" && (
              <input
                type="text"
                name="otherSite"
                value={formData.otherSite || ""}
                onChange={handleChange}
                className="w-full p-3 border rounded-lg mt-2 focus:ring-2 focus:ring-[#117960]"
                placeholder="Please specify other site"
                required
              />
            )}
          </div>
          <div>
            <label className="block text-gray-700 mb-2 font-medium">Client Feedback</label>
            <input
              type="text"
              name="clientFeedback"
              value={formData.clientFeedback}
              onChange={handleChange}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#117960]"
              required
            />
          </div>
          <div className="flex items-center space-x-6">
            <div className="flex items-center">
              <input
                type="checkbox"
                name="siteVisit"
                checked={formData.siteVisit}
                onChange={handleChange}
                className="h-5 w-5 text-[#117960] focus:ring-[#117960]"
              />
              <label className="ml-2 text-gray-700 font-medium">Site Visit</label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                name="officeVisit"
                checked={formData.officeVisit}
                onChange={handleChange}
                className="h-5 w-5 text-[#117960] focus:ring-[#117960]"
              />
              <label className="ml-2 text-gray-700 font-medium">Office Visit</label>
            </div>
          </div>
          <div>
            <label className="block text-gray-700 mb-2 font-medium">Remark</label>
            <input
              type="text"
              name="remark"
              value={formData.remark}
              onChange={handleChange}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#117960]"
            />
          </div>
          {animationStatus === "success" && !editingVisitId ? (
            <div className="flex justify-center">
              <DotLottieReact
                src="https://lottie.host/2cc98f5a-e22e-46d3-b73f-fb1b40fd9364/E8mJpbWQYS.lottie"
                loop
                autoplay
                style={{ width: 120, height: 120 }}
              />
            </div>
          ) : animationStatus === "error" && !editingVisitId ? (
            <div className="text-red-500 text-center font-medium">
              Error registering the visit. Please try again.
            </div>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full inline-flex items-center justify-center py-3 px-6 rounded-full text-white font-medium transition-all duration-300 ease-in-out transform hover:scale-105 shadow-md hover:shadow-lg ${
                isSubmitting
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#34d399] to-[#059669] hover:from-[#10b981] hover:to-[#047857]'
              }`}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-5 w-5 mr-2 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8h8a8 8 0 01-8 8 8 8 0 01-8-8z" />
                  </svg>
                  Registering...
                </>
              ) : (
                'Register Visit'
              )}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}