import { Divider } from "antd";
import { useState, useEffect, useMemo, useRef } from "react";
import { getAuth } from "firebase/auth";
import { EditOutlined } from '@ant-design/icons';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { collection, getDocs, query, where, addDoc, updateDoc, doc, getDoc } from "firebase/firestore";
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
function SearchableDropdown({ options, value, onChange, placeholder, name, disabled }) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const dropdownRef = useRef(null);

    const filteredOptions = useMemo(() => {
        return options.filter(option =>
            option.label.toLowerCase().includes(search.toLowerCase())
        );
    }, [search, options]);

    const handleSelect = (optionValue) => {
        onChange({ target: { name, value: optionValue } });
        setSearch("");
        setIsOpen(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && filteredOptions.length > 0) {
            handleSelect(filteredOptions[0].value);
        } else if (e.key === "Escape") {
            setIsOpen(false);
        }
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setIsOpen(true)}
                placeholder={placeholder}
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#117960] transition-colors ${disabled ? 'bg-gray-200 cursor-not-allowed' : ''}`}
                onKeyDown={handleKeyDown}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                disabled={disabled}
            />
            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">▼</span>
            {isOpen && !disabled && (
                <ul
                    className="absolute z-10 w-full bg-white border rounded-lg mt-1 max-h-60 overflow-y-auto shadow-lg"
                    role="listbox"
                >
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((option) => (
                            <li
                                key={option.value}
                                onClick={() => handleSelect(option.value)}
                                className="p-2 hover:bg-gray-100 cursor-pointer"
                                role="option"
                                aria-selected={value === option.value}
                            >
                                {option.label}
                            </li>
                        ))
                    ) : (
                        <li className="p-2 text-gray-500">No options found</li>
                    )}
                </ul>
            )}
        </div>
    );
}

export default function RegisterSalesAgent() {
    const [supervisor, setSupervisor] = useState(null);
    const [salesAgents, setSalesAgents] = useState([]);
    const [prospects, setProspects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [prospectFilters, setProspectFilters] = useState([]);
    const [supervisorId, setSupervisorId] = useState("");
    const [editingSaleId, setEditingSaleId] = useState(null);
    const [salesData, setSalesData] = useState([]);
    const [editSaleFormData, setEditSaleFormData] = useState({});
    const [animationStatus, setAnimationStatus] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [searchPhone, setSearchPhone] = useState("");
    const debouncedSearchPhone = useDebounce(searchPhone, 500);
    const [filteredSalesData, setFilteredSalesData] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 10;
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        salesAmount: "",
        salesAgent: "",
        type: "",
        areaInSQM: "",
        area: "",
        supervisor: supervisorId,
        houseNumber: "",
        agreementNumber: "",
        dateOfRecording: "",
        soldTo: "",
        prospectName: "",
        prospectPhoneNumber: "",
        site: "",
        remark: ""
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
                const supervisorData = supervisorSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

                if (supervisorData.length === 0) {
                    console.error("No supervisor found!");
                    setLoading(false);
                    return;
                }

                setSupervisor(supervisorData[0]);
                setSupervisorId(userDocId);

                const salesAgentQuery = query(
                    collection(db, "teamMembers"),
                    where("role", "==", "Sales Agent"),
                    where("supervisor", "==", userDocId)
                );
                const supAgentQuery = query(
                    collection(db, "teamMembers"),
                    where("userId", "==", currentUser.uid)
                );
                const [salesAgentSnapshot, supAgentSnapshot] = await Promise.all([
                    getDocs(salesAgentQuery),
                    getDocs(supAgentQuery)
                ]);
                const agentsData = salesAgentSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
                const supAgentData = supAgentSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
                const allAgentsData = [...supAgentData, ...agentsData];

                setSalesAgents(allAgentsData);

                const prospectQuery = query(collection(db, "Prospect"));
                const prospectSnapshot = await getDocs(prospectQuery);
                const prospectsData = prospectSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
                setProspects(prospectsData);

                const salesQuery = query(
                    collection(db, "sales"),
                    where("supervisor", "==", userDocId)
                );
                const salesSnapshot = await getDocs(salesQuery);
                const salesData = salesSnapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                    dateOfRecording: doc.data().dateOfRecording || Date.now()
                }));
                salesData.sort((a, b) => b.dateOfRecording - a.dateOfRecording);
                setSalesData(salesData);
                setFilteredSalesData(salesData);
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [supervisorId]);

    useEffect(() => {
        const filteredByDateAndPhone = salesData.filter((sale) => {
            const saleDate = sale.dateOfRecording?.seconds
                ? new Date(sale.dateOfRecording.seconds * 1000)
                : new Date(sale.dateOfRecording);

            const fromDate = dateFrom ? new Date(dateFrom) : null;
            const toDate = dateTo ? new Date(dateTo) : null;

            const passesDateFilter = () => {
                if (saleDate && fromDate && toDate) {
                    return saleDate >= fromDate && saleDate <= toDate;
                } else if (saleDate && fromDate) {
                    return saleDate >= fromDate;
                } else if (saleDate && toDate) {
                    return saleDate <= toDate;
                }
                return true;
            };

            const phone = sale.soldTo === "Others"
                ? sale.prospectPhoneNumber?.toString().toLowerCase()
                : prospects.find(p => p.id === sale.soldTo)?.["Phone number"]?.toString().toLowerCase();

            const passesPhoneFilter = !debouncedSearchPhone || (phone && phone.includes(debouncedSearchPhone.toLowerCase()));

            return passesDateFilter() && passesPhoneFilter;
        });

        setFilteredSalesData(filteredByDateAndPhone);
        setCurrentPage(1);
    }, [dateFrom, dateTo, debouncedSearchPhone, salesData, prospects]);

    const isSaleOlderThan24Hours = (sale) => {
        if (!sale || !sale.dateOfRecording) return true;
        const saleTime = sale.dateOfRecording?.seconds
            ? sale.dateOfRecording.seconds * 1000
            : sale.dateOfRecording;
        const currentTime = Date.now();
        const hoursDiff = (currentTime - saleTime) / (1000 * 60 * 60);
        return hoursDiff > 24;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prevData) => ({
            ...prevData,
            [name]: value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setAnimationStatus("");
        try {
            const submissionData = {
                ...formData,
                dateOfRecording: formData.dateOfRecording ? new Date(formData.dateOfRecording).getTime() : Date.now()
            };
            await addDoc(collection(db, "sales"), submissionData);
            setAnimationStatus("success");
            setTimeout(async () => {
                setAnimationStatus("");
                setFormData({
                    salesAmount: "",
                    salesAgent: "",
                    type: "",
                    areaInSQM: "",
                    area: "",
                    supervisor: supervisorId,
                    houseNumber: "",
                    agreementNumber: "",
                    dateOfRecording: "",
                    soldTo: "",
                    prospectName: "",
                    prospectPhoneNumber: "",
                    site: "",
                    remark: ""
                });
                setProspectFilters([]);
                setIsSubmitting(false);

                const salesQuery = query(collection(db, "sales"), where("supervisor", "==", supervisorId));
                const salesSnapshot = await getDocs(salesQuery);
                const updatedSales = salesSnapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                    dateOfRecording: doc.data().dateOfRecording || Date.now()
                }));
                updatedSales.sort((a, b) => b.dateOfRecording - a.dateOfRecording);
                setSalesData(updatedSales);
                setFilteredSalesData(updatedSales);
            }, 1500);
        } catch (e) {
            console.error("Error adding document: ", e);
            setAnimationStatus("error");
            setIsSubmitting(false);
        }
    };

    const handleSaleEdit = (sale) => {
        setEditingSaleId(sale.id);
        setEditSaleFormData({
            salesAmount: sale.salesAmount || "",
            salesAgent: sale.salesAgent || "",
            type: sale.type || "",
            areaInSQM: sale.areaInSQM || "",
            agreementNumber: sale.agreementNumber || "",
            houseNumber: sale.houseNumber || "",
            dateOfRecording: sale.dateOfRecording
                ? new Date(sale.dateOfRecording).toISOString().split('T')[0]
                : "",
            area: sale.area || "",
            soldTo: sale.soldTo || "",
            prospectName: sale.prospectName || "",
            prospectPhoneNumber: sale.prospectPhoneNumber || "",
            site: sale.site || "",
            remark: sale.remark || ""
        });
    };

    const handleSaleInputChange = (e) => {
        const { name, value } = e.target;
        setEditSaleFormData((prevFormData) => ({
            ...prevFormData,
            [name]: value,
        }));
    };

    const handleSaveSaleEdit = async () => {
        try {
            const saleRef = doc(db, "sales", editingSaleId);
            const saleDoc = await getDoc(saleRef);
            const saleData = saleDoc.data();

            if (!saleData) {
                throw new Error("Sale not found.");
            }

            const updatedData = {
                remark: editSaleFormData.remark
            };

            if (!isSaleOlderThan24Hours(saleData)) {
                updatedData.salesAmount = editSaleFormData.salesAmount;
                updatedData.salesAgent = editSaleFormData.salesAgent;
                updatedData.type = editSaleFormData.type;
                updatedData.areaInSQM = editSaleFormData.areaInSQM;
                updatedData.agreementNumber = editSaleFormData.agreementNumber;
                updatedData.houseNumber = editSaleFormData.houseNumber;
                updatedData.dateOfRecording = new Date(editSaleFormData.dateOfRecording).getTime();
                updatedData.area = editSaleFormData.area;
                updatedData.soldTo = editSaleFormData.soldTo;
                updatedData.prospectName = editSaleFormData.prospectName;
                updatedData.prospectPhoneNumber = editSaleFormData.prospectPhoneNumber;
                updatedData.site = editSaleFormData.site;
            }

            await updateDoc(saleRef, updatedData);
            setSalesData((prevSalesData) =>
                prevSalesData.map((sale) =>
                    sale.id === editingSaleId ? { ...sale, ...updatedData } : sale
                )
            );
            setEditingSaleId(null);
            setAnimationStatus("success");
            setTimeout(() => setAnimationStatus(""), 1500);
        } catch (error) {
            console.error("Error updating sale:", error);
            setAnimationStatus("error");
        }
    };

    const totalSalesAmount = filteredSalesData.reduce((total, sale) =>
        total + parseFloat(sale.salesAmount || 0), 0
    );

    const totalPages = Math.ceil(filteredSalesData.length / rowsPerPage);
    const paginatedData = filteredSalesData.slice(
        (currentPage - 1) * rowsPerPage,
        currentPage * rowsPerPage
    );

    const handlePageChange = (page) => {
        setCurrentPage(page);
    };

    // Dropdown options
    const agentOptions = useMemo(() => [
        { value: "", label: "Select Sales Agent" },
        { value: "Digital Department", label: "Digital Department" },
        { value: "Freelance", label: "Freelance" },
        ...salesAgents.map(agent => ({ value: agent.id, label: agent.name }))
    ], [salesAgents]);

    const typeOptions = useMemo(() => [
        { value: "", label: "Select Type" },
        { value: "Apartment", label: "Apartment" },
        { value: "Shop", label: "Shop" }
    ], []);

    const siteOptions = useMemo(() => [
        { value: "", label: "Select Site" },
        { value: "Yebe Real Estate", label: "Yebe Real Estate" },
        { value: "Addis Empire Real Estate", label: "Addis Empire Real Estate" },
        { value: "Sunshine Real Estate", label: "Sunshine Real Estate" },
        { value: "Other", label: "Other" }
    ], []);

    const prospectOptions = useMemo(() => [
        { value: "", label: "Select Prospect" },
        ...prospectFilters.map(prospect => ({
            value: prospect.id,
            label: `${prospect.Name} - ${prospect["Phone number"]}`
        })),
        { value: "Others", label: "Others" }
    ], [prospectFilters]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-[#117960]"></div>
                <span className="ml-3 text-gray-600">Loading sales data...</span>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 p-6">
            <h2 className="text-3xl font-bold mb-2 mt-3" style={{ fontFamily: 'Noto Sans, sans-serif' }}>
                Register Sales Data
            </h2>
            <Divider className="bg-gray-300" />

            <div className="max-w-full mx-auto bg-white p-6 rounded-xl shadow-lg mt-5" style={{ fontFamily: 'Noto Sans, sans-serif' }}>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                    <div>
                        <label className="block mb-2 font-semibold text-gray-700">Search by Phone Number</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={searchPhone}
                                onChange={(e) => setSearchPhone(e.target.value)}
                                placeholder="Enter phone number"
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#117960] transition-colors"
                            />
                            {searchPhone && (
                                <button
                                    onClick={() => setSearchPhone("")}
                                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="block mb-2 font-semibold text-gray-700">Date From</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#117960] transition-colors"
                        />
                    </div>
                    <div>
                        <label className="block mb-2 font-semibold text-gray-700">Date To</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#117960] transition-colors"
                        />
                    </div>
                    {/* <div>
                        <label className="block mb-2 font-semibold text-gray-700">Sales Agent</label>
                        <SearchableDropdown
                            options={agentOptions}
                            value={formData.salesAgent}
                            onChange={handleChange}
                            placeholder="Select Sales Agent"
                            name="salesAgent"
                        />
                    </div> */}
                </div>

                <div className="mb-6 bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-xl shadow-lg">
                    <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                        <svg className="w-6 h-6 mr-2 text-[#117960]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-6h6v6m-6 0h6m4 0h-4m-6 0H5m4-14h6v4H9v-4z"></path>
                        </svg>
                        Sales Summary
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-lg shadow-md hover:bg-gray-50 transition-colors duration-200">
                            <p className="text-sm font-medium text-gray-600">Time Period</p>
                            <p className="text-lg font-semibold text-[#117960] mt-1">
                                {dateFrom || dateTo
                                    ? `${dateFrom ? new Date(dateFrom).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Start"} to ${dateTo ? new Date(dateTo).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "End"}`
                                    : "All Sales"}
                            </p>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-md hover:bg-gray-50 transition-colors duration-200">
                            <p className="text-sm font-medium text-gray-600">Total Sales</p>
                            <p className="text-lg font-semibold text-[#117960] mt-1">
                                {filteredSalesData.length}
                            </p>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-md hover:bg-gray-50 transition-colors duration-200">
                            <p className="text-sm font-medium text-gray-600">Total Amount</p>
                            <p className="text-lg font-semibold text-[#117960] mt-1">
                                {totalSalesAmount.toLocaleString()} ETB
                            </p>
                        </div>
                    </div>
                </div>

                <div className="relative">
                    {animationStatus === "success" && editingSaleId && (
                        <div className="absolute top-0 left-0 w-full h-full flex justify-center items-center bg-white bg-opacity-50 z-10">
                            <DotLottieReact
                                src="https://lottie.host/2cc98f5a-e22e-46d3-b73f-fb1b40fd9364/E8mJpbWQYS.lottie"
                                loop
                                autoplay
                                style={{ width: 100, height: 100 }}
                            />
                        </div>
                    )}
                    {animationStatus === "error" && editingSaleId && (
                        <div className="absolute top-0 left-0 w-full h-full flex justify-center items-center bg-white bg-opacity-80 z-10">
                            <p className="text-red-500 text-center font-semibold">Error updating the sale. Please try again.</p>
                        </div>
                    )}
                    {/* {editingSaleId && salesData.find(s => s.id === editingSaleId) && isSaleOlderThan24Hours(salesData.find(s => s.id === editingSaleId)) && (
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
                                    <th className="py-3 px-4 rounded-tl-lg">Amount (ETB)</th>
                                    <th className="py-3 px-4">Agent</th>
                                    <th className="py-3 px-4">Type</th>
                                    <th className="py-3 px-4">Site</th>
                                    <th className="py-3 px-4">Area (SQM)</th>
                                    <th className="py-3 px-4">Location</th>
                                    <th className="py-3 px-4">Date</th>
                                    <th className="py-3 px-4">Sold To</th>
                                    <th className="py-3 px-4">House No.</th>
                                    <th className="py-3 px-4">Remark</th>
                                    <th className="py-3 px-4 rounded-tr-lg">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="text-gray-600">
                                {paginatedData.map((sale) => {
                                    const agent = salesAgents.find((agent) => agent.id === sale.salesAgent) || supervisor;
                                    const prospect = prospects.find((prospect) => prospect.id === sale.soldTo);
                                    const isEditing = editingSaleId === sale.id;
                                    const isDisabled = isSaleOlderThan24Hours(sale);

                                    return (
                                        <tr key={sale.id} className="hover:bg-gray-100 transition-colors">
                                            {isEditing ? (
                                                <>
                                                    <td className="py-3 px-4 border-b">
                                                        <input
                                                            type="text"
                                                            name="salesAmount"
                                                            value={editSaleFormData.salesAmount}
                                                            onChange={handleSaleInputChange}
                                                            className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-[#117960] ${isDisabled ? 'bg-gray-200 cursor-not-allowed' : ''}`}
                                                            required
                                                            disabled={isDisabled}
                                                        />
                                                    </td>
                                                    <td className="py-3 px-4 border-b">
                                                        <SearchableDropdown
                                                            options={agentOptions}
                                                            value={editSaleFormData.salesAgent}
                                                            onChange={handleSaleInputChange}
                                                            placeholder="Select Agent"
                                                            name="salesAgent"
                                                            disabled={isDisabled}
                                                        />
                                                    </td>
                                                    <td className="py-3 px-4 border-b">
                                                        <SearchableDropdown
                                                            options={typeOptions}
                                                            value={editSaleFormData.type}
                                                            onChange={handleSaleInputChange}
                                                            placeholder="Select Type"
                                                            name="type"
                                                            disabled={isDisabled}
                                                        />
                                                    </td>
                                                    <td className="py-3 px-4 border-b">
                                                        <SearchableDropdown
                                                            options={siteOptions}
                                                            value={editSaleFormData.site}
                                                            onChange={handleSaleInputChange}
                                                            placeholder="Select Site"
                                                            name="site"
                                                            disabled={isDisabled}
                                                        />
                                                    </td>
                                                    <td className="py-3 px-4 border-b">
                                                        <input
                                                            type="number"
                                                            name="areaInSQM"
                                                            value={editSaleFormData.areaInSQM}
                                                            onChange={handleSaleInputChange}
                                                            className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-[#117960] ${isDisabled ? 'bg-gray-200 cursor-not-allowed' : ''}`}
                                                            required
                                                            disabled={isDisabled}
                                                        />
                                                    </td>
                                                    <td className="py-3 px-4 border-b">
                                                        <input
                                                            type="text"
                                                            name="area"
                                                            value={editSaleFormData.area}
                                                            onChange={handleSaleInputChange}
                                                            className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-[#117960] ${isDisabled ? 'bg-gray-200 cursor-not-allowed' : ''}`}
                                                            required
                                                            disabled={isDisabled}
                                                        />
                                                    </td>
                                                    <td className="py-3 px-4 border-b">
                                                        <input
                                                            type="date"
                                                            name="dateOfRecording"
                                                            value={editSaleFormData.dateOfRecording}
                                                            onChange={handleSaleInputChange}
                                                            className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-[#117960] ${isDisabled ? 'bg-gray-200 cursor-not-allowed' : ''}`}
                                                            required
                                                            disabled={isDisabled}
                                                        />
                                                    </td>
                                                    <td className="py-3 px-4 border-b">
                                                        <input
                                                            type="text"
                                                            placeholder="Search by phone number"
                                                            onChange={(e) => {
                                                                const searchTerm = e.target.value.toLowerCase();
                                                                setProspectFilters(searchTerm === "" ? [] : prospects.filter((prospect) =>
                                                                    prospect["Phone number"].toLowerCase().includes(searchTerm)
                                                                ));
                                                            }}
                                                            className={`w-full p-2 border rounded-md mb-2 focus:ring-2 focus:ring-[#117960] ${isDisabled ? 'bg-gray-200 cursor-not-allowed' : ''}`}
                                                            disabled={isDisabled}
                                                        />
                                                        <SearchableDropdown
                                                            options={prospectOptions}
                                                            value={editSaleFormData.soldTo}
                                                            onChange={handleSaleInputChange}
                                                            placeholder="Select Prospect"
                                                            name="soldTo"
                                                            disabled={isDisabled}
                                                        />
                                                        {editSaleFormData.soldTo === "Others" && !isDisabled && (
                                                            <>
                                                                <input
                                                                    type="text"
                                                                    name="prospectName"
                                                                    value={editSaleFormData.prospectName || ""}
                                                                    onChange={handleSaleInputChange}
                                                                    className="w-full p-2 border rounded-md mt-2 focus:ring-2 focus:ring-[#117960]"
                                                                    placeholder="Enter prospect name"
                                                                />
                                                                <input
                                                                    type="text"
                                                                    name="prospectPhoneNumber"
                                                                    value={editSaleFormData.prospectPhoneNumber || ""}
                                                                    onChange={handleSaleInputChange}
                                                                    className="w-full p-2 border rounded-md mt-2 focus:ring-2 focus:ring-[#117960]"
                                                                    placeholder="Enter phone number"
                                                                />
                                                            </>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 border-b">
                                                        <input
                                                            type="text"
                                                            name="houseNumber"
                                                            value={editSaleFormData.houseNumber}
                                                            onChange={handleSaleInputChange}
                                                            className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-[#117960] ${isDisabled ? 'bg-gray-200 cursor-not-allowed' : ''}`}
                                                            required
                                                            disabled={isDisabled}
                                                        />
                                                    </td>
                                                    <td className="py-3 px-4 border-b">
                                                        <input
                                                            type="text"
                                                            name="remark"
                                                            value={editSaleFormData.remark}
                                                            onChange={handleSaleInputChange}
                                                            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-[#117960]"
                                                        />
                                                    </td>
                                                    <td className="py-3 px-4 border-b flex flex-col sm:flex-row items-center justify-between gap-2">
                                                        <button
                                                            onClick={handleSaveSaleEdit}
                                                            className="w-full sm:w-auto inline-flex items-center justify-center py-2 px-4 rounded-full text-white font-medium transition-all duration-300 bg-gradient-to-r from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 shadow-md hover:shadow-lg"
                                                        >
                                                            Save
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingSaleId(null)}
                                                            className="w-full sm:w-auto inline-flex items-center justify-center py-2 px-4 rounded-full text-white font-medium transition-all duration-300 bg-gradient-to-r from-gray-400 to-gray-600 hover:from-gray-500 hover:to-gray-700 shadow-md hover:shadow-lg"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="py-3 px-4 border-b">{parseFloat(sale.salesAmount).toLocaleString()}</td>
                                                    <td className="py-3 px-4 border-b">
                                                        {sale.salesAgent === "Digital Department" || sale.salesAgent === "Freelance"
                                                            ? sale.salesAgent
                                                            : agent?.name || sale.salesAgent}
                                                    </td>
                                                    <td className="py-3 px-4 border-b">{sale.type}</td>
                                                    <td className="py-3 px-4 border-b">{sale.site}</td>
                                                    <td className="py-3 px-4 border-b">{sale.areaInSQM}</td>
                                                    <td className="py-3 px-4 border-b">{sale.area}</td>
                                                    <td className="py-3 px-4 border-b">
                                                        {new Date(sale.dateOfRecording).toLocaleDateString("en-GB", {
                                                            day: "numeric",
                                                            month: "short",
                                                            year: "numeric",
                                                        })}
                                                    </td>
                                                    <td className="py-3 px-4 border-b">
                                                        {sale.soldTo === "Others"
                                                            ? `${sale.prospectName} - ${sale.prospectPhoneNumber}`
                                                            : prospect
                                                            ? `${prospect.Name} - ${prospect["Phone number"]}`
                                                            : "Unknown"}
                                                    </td>
                                                    <td className="py-3 px-4 border-b">{sale.houseNumber}</td>
                                                    <td className="py-3 px-4 border-b">{sale.remark || '-'}</td>
                                                    <td className="py-3 px-4 border-b">
                                                        <button
                                                            onClick={() => handleSaleEdit(sale)}
                                                            className="inline-flex items-center justify-center py-2 px-4 rounded-full text-white font-medium transition-all duration-300 bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 shadow-md hover:shadow-lg"
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

            <div className="max-w-2xl mx-auto bg-white p-6 rounded-xl shadow-lg mt-10" style={{ fontFamily: 'Noto Sans, sans-serif' }}>
                <h2 className="text-3xl font-bold mb-4 text-gray-800">Register New Sale</h2>
                <Divider className="bg-gray-300" />
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-gray-700 mb-2 font-medium">Property Cost (ETB)</label>
                            <input
                                type="number"
                                name="salesAmount"
                                value={formData.salesAmount}
                                onChange={handleChange}
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#117960] transition-colors"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-gray-700 mb-2 font-medium">House Number</label>
                            <input
                                type="text"
                                name="houseNumber"
                                value={formData.houseNumber}
                                onChange={handleChange}
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#117960] transition-colors"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-gray-700 mb-2 font-medium">Agreement Number</label>
                            <input
                                type="text"
                                name="agreementNumber"
                                value={formData.agreementNumber}
                                onChange={handleChange}
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#117960] transition-colors"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-gray-700 mb-2 font-medium">Date of Sale</label>
                            <input
                                type="date"
                                name="dateOfRecording"
                                value={formData.dateOfRecording}
                                onChange={handleChange}
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#117960] transition-colors"
                                required
                            />
                        </div>
                    </div>

                    <div className="bg-gray-50 p-6 rounded-xl">
                        <h3 className="text-xl font-semibold mb-4 text-gray-800">Property Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-gray-700 mb-2 font-medium">Sales Agent</label>
                                <SearchableDropdown
                                    options={agentOptions}
                                    value={formData.salesAgent}
                                    onChange={handleChange}
                                    placeholder="Select Sales Agent"
                                    name="salesAgent"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-700 mb-2 font-medium">Property Type</label>
                                <SearchableDropdown
                                    options={typeOptions}
                                    value={formData.type}
                                    onChange={handleChange}
                                    placeholder="Select Type"
                                    name="type"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-700 mb-2 font-medium">Area (SQM)</label>
                                <input
                                    type="number"
                                    name="areaInSQM"
                                    value={formData.areaInSQM}
                                    onChange={handleChange}
                                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#117960] transition-colors"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-gray-700 mb-2 font-medium">Location</label>
                                <input
                                    type="text"
                                    name="area"
                                    value={formData.area}
                                    onChange={handleChange}
                                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#117960] transition-colors"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-gray-700 mb-2 font-medium">Site</label>
                                <SearchableDropdown
                                    options={siteOptions}
                                    value={formData.site}
                                    onChange={handleChange}
                                    placeholder="Select Site"
                                    name="site"
                                />
                            </div>
                            {formData.site === "Other" && (
                                <div>
                                    <label className="block text-gray-700 mb-2 font-medium">Other Site</label>
                                    <input
                                        type="text"
                                        name="otherSite"
                                        value={formData.otherSite || ""}
                                        onChange={handleChange}
                                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#117960] transition-colors"
                                        placeholder="Please specify other site"
                                        required
                                    />
                                </div>
                            )}
                            <div>
                                <label className="block text-gray-700 mb-2 font-medium">Remark</label>
                                <input
                                    type="text"
                                    name="remark"
                                    value={formData.remark}
                                    onChange={handleChange}
                                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#117960] transition-colors"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-50 p-6 rounded-xl">
                        <h3 className="text-xl font-semibold mb-4 text-gray-800">Client Information</h3>
                        <div>
                            <input
                                type="text"
                                placeholder="Search by phone number"
                                onChange={(e) => {
                                    const searchTerm = e.target.value.toLowerCase();
                                    setProspectFilters(searchTerm === "" ? [] : prospects.filter(prospect =>
                                        prospect["Phone number"].toLowerCase().includes(searchTerm)
                                    ));
                                }}
                                className="w-full p-3 border rounded-lg mb-4 focus:ring-2 focus:ring-[#117960] transition-colors"
                            />
                            <SearchableDropdown
                                options={prospectOptions}
                                value={formData.soldTo}
                                onChange={handleChange}
                                placeholder="Select Prospect"
                                name="soldTo"
                            />
                        </div>
                        {formData.soldTo === "Others" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                                <div>
                                    <label className="block text-gray-700 mb-2 font-medium">Client Name</label>
                                    <input
                                        type="text"
                                        name="prospectName"
                                        value={formData.prospectName}
                                        onChange={handleChange}
                                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#117960] transition-colors"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-700 mb-2 font-medium">Client Phone</label>
                                    <input
                                        type="text"
                                        name="prospectPhoneNumber"
                                        value={formData.prospectPhoneNumber}
                                        onChange={handleChange}
                                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#117960] transition-colors"
                                        required
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {animationStatus === "success" && !editingSaleId ? (
                        <div className="flex justify-center">
                            <DotLottieReact
                                src="https://lottie.host/2cc98f5a-e22e-46d3-b73f-fb1b40fd9364/E8mJpbWQYS.lottie"
                                loop
                                autoplay
                                style={{ width: 120, height: 120 }}
                            />
                        </div>
                    ) : animationStatus === "error" && !editingSaleId ? (
                        <div className="text-red-500 text-center font-medium">
                            Error registering the sale. Please try again.
                        </div>
                    ) : (
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`w-full inline-flex items-center justify-center py-4 px-6 rounded-lg text-white font-bold transition-all duration-300 ease-in-out transform hover:scale-[1.02] shadow-lg hover:shadow-xl ${
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
                                'Register Sale'
                            )}
                        </button>
                    )}
                </form>
            </div>
        </div>
    );
}