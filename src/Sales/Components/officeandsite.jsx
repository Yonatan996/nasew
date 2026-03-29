import { Divider } from "antd";
import { useState, useEffect } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth"; // Import onAuthStateChanged
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { collection, getDocs, query, where, addDoc, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from './firebase';

export default function OfficeSiteVisitSales() {
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
  const auth = getAuth();
  const [currentUser, setCurrentUser] = useState(null); // Use state for currentUser

  const [formData, setFormData] = useState({
    clientName: "",
    phoneNumber: "",
    visitDate: "",
    visitDetails: "",
    salesAgent: "",
    clientFeedback: "",
    siteVisit: false,
    officeVisit: false,
    remark: "",
  });

  // Listen for authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user); // Set the current user
        setFormData((prevData) => ({
          ...prevData,
          salesAgent: user.uid, // Set the salesAgent to the logged-in user's UID
        }));
      } else {
        console.error("No user is currently logged in!");
        setCurrentUser(null);
      }
    });

    return () => unsubscribe(); // Cleanup listener on unmount
  }, [auth]);

  // Fetch data only when currentUser is available
  useEffect(() => {
    if (!currentUser) return; // Do nothing if currentUser is not available

    const fetchDashboardData = async () => {
      try {
        // Get Current Supervisor
        const supervisorQuery = query(collection(db, "teamMembers"), where("role", "==", "Supervisor"));
        const supervisorSnapshot = await getDocs(supervisorQuery);
        const supervisorData = supervisorSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        if (supervisorData.length === 0) {
          console.error("No supervisor found!");
          setLoading(false);
          return;
        }

        setSupervisor(supervisorData[0]);
        setSupervisorId(supervisorData[0].id);

        // Fetch Sales Agents Assigned to This Supervisor
        const salesAgentQuery = query(
          collection(db, "teamMembers"),
          where("role", "==", "Sales Agent"),
          where("supervisor", "==", supervisorData[0].id)
        );
        const salesAgentSnapshot = await getDocs(salesAgentQuery);
        const agentsData = salesAgentSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setSalesAgents(agentsData);

        // Fetch Prospects for the Logged-In Agent
        const prospectQuery = query(collection(db, "Prospect"), where("user", "==", currentUser.uid));
        const prospectSnapshot = await getDocs(prospectQuery);
        const prospectsData = prospectSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setProspects(prospectsData);

        // Fetch Visits for the Logged-In Agent
        const visitsQuery = query(collection(db, "visits"), where("salesAgent", "==", currentUser.id));
        const visitsSnapshot = await getDocs(visitsQuery);
        const visitsData = visitsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        visitsData.sort((a, b) => b.visitDate - a.visitDate); // Sort by visitDate in descending order
        setVisitsData(visitsData);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [currentUser, supervisorId]); // Fetch data when currentUser or supervisorId changes

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAnimationStatus("");
    try {
      await addDoc(collection(db, "visits"), formData);
      setAnimationStatus("success");
      setTimeout(() => {
        setAnimationStatus("");
        setFormData({
          clientName: "",
          phoneNumber: "",
          visitDate: "",
          visitDetails: "",
          salesAgent: currentUser.uid, // Reset to the logged-in agent's ID
          clientFeedback: "",
          siteVisit: false,
          officeVisit: false,
          remark: "",
        });
      }, 1500);
    } catch (e) {
      console.error("Error adding document: ", e);
      setAnimationStatus("error");
    }
  };

  const handleVisitEdit = (visit) => {
    setEditingVisitId(visit.id);
    setEditVisitFormData({
      clientName: visit.clientName,
      phoneNumber: visit.phoneNumber,
      visitDate: visit.visitDate,
      visitDetails: visit.visitDetails,
      salesAgent: visit.salesAgent,
      clientFeedback: visit.clientFeedback,
      siteVisit: visit.siteVisit,
      officeVisit: visit.officeVisit,
      remark: visit.remark,
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
      await updateDoc(visitRef, editVisitFormData);
      setVisitsData((prevVisitsData) =>
        prevVisitsData.map((visit) =>
          visit.id === editingVisitId ? { ...visit, ...editVisitFormData } : visit
        )
      );
      setEditingVisitId(null);
    } catch (error) {
      console.error("Error updating visit:", error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, "visits", id));
      setVisitsData(visitsData.filter((visit) => visit.id !== id));
    } catch (error) {
      console.error("Error deleting visit:", error);
    }
  };

  return (
    <>
      <h2 className="text-3xl font-bold mb-2 mt-3" style={{ fontFamily: 'Noto Sans, Sans' }}>Office and Site Visits</h2>
      <Divider />
      <div className="max-w-full mx-auto bg-white p-6 rounded-lg shadow-md mt-5" style={{ fontFamily: 'Noto Sans, Sans' }}>
        <div className="overflow-x-auto">
          <table className="w-full table-auto bg-white text-left border-separate border-spacing-0">
            <thead className="bg-[#117960] text-white">
              <tr>
                <th className="py-3 px-4 border-b">Client</th>
                <th className="py-3 px-4 border-b">Visit Date</th>
                <th className="py-3 px-4 border-b">Sales Agent</th>
                <th className="py-3 px-4 border-b">Client Feedback</th>
                <th className="py-3 px-4 border-b">Site Visit</th>
                <th className="py-3 px-4 border-b">Office Visit</th>
                <th className="py-3 px-4 border-b">Remark</th>
                <th className="py-3 px-4 border-b">Actions</th>
              </tr>
            </thead>
            <tbody className="text-gray-500">
              {visitsData.map((visit) => {
                const agent = salesAgents.find((agent) => agent.id === visit.salesAgent) || supervisor;
                const isEditing = editingVisitId === visit.id;

                return (
                  <tr key={visit.id} className="hover:bg-gray-50">
                    {isEditing ? (
                      // Editing Mode
                      <>
                        <td className="py-2 px-4 border-b">
                          <input
                            type="text"
                            name="clientName"
                            value={editVisitFormData.clientName}
                            onChange={handleVisitInputChange}
                            className="w-full p-2 border border-gray-300 rounded-md"
                            required
                          />
                        </td>
                        <td className="py-2 px-4 border-b">
                          <input
                            type="date"
                            name="visitDate"
                            value={editVisitFormData.visitDate}
                            onChange={handleVisitInputChange}
                            className="w-full p-2 border border-gray-300 rounded-md"
                            required
                          />
                        </td>
                        <td className="py-2 px-4 border-b">
                          <select
                            name="salesAgent"
                            value={editVisitFormData.salesAgent}
                            onChange={handleVisitInputChange}
                            className="w-full p-2 border border-gray-300 rounded-md"
                            required
                            disabled
                          >
                            <option value={currentUser.uid}>{agent ? agent.name : "Unknown"}</option>
                          </select>
                        </td>
                        <td className="py-2 px-4 border-b">
                          <input
                            type="text"
                            name="clientFeedback"
                            value={editVisitFormData.clientFeedback}
                            onChange={handleVisitInputChange}
                            className="w-full p-2 border border-gray-300 rounded-md"
                            required
                          />
                        </td>
                        <td className="py-2 px-4 border-b">
                          <input
                            type="checkbox"
                            name="siteVisit"
                            checked={editVisitFormData.siteVisit}
                            onChange={handleVisitInputChange}
                          />
                        </td>
                        <td className="py-2 px-4 border-b">
                          <input
                            type="checkbox"
                            name="officeVisit"
                            checked={editVisitFormData.officeVisit}
                            onChange={handleVisitInputChange}
                          />
                        </td>
                        <td className="py-2 px-4 border-b">
                          <input
                            type="text"
                            name="remark"
                            value={editVisitFormData.remark}
                            onChange={handleVisitInputChange}
                            className="w-full p-2 border border-gray-300 rounded-md"
                          />
                        </td>
                        <td className="py-2 px-4 border-b flex flex-col sm:flex-row items-center justify-between">
                          <button
                            onClick={handleSaveVisitEdit}
                            className="my-1 py-2 px-4 bg-blue-500 text-white rounded-md sm:mr-2 w-full sm:w-auto"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingVisitId(null)}
                            className="my-1 py-2 px-4 bg-gray-500 text-white rounded-md w-full sm:w-auto"
                          >
                            Cancel
                          </button>
                        </td>
                      </>
                    ) : (
                      // Display Mode
                      <>
                        <td className="py-3 px-4 border-b">{visit.clientName} - {visit.phoneNumber}</td>
                        <td className="py-3 px-4 border-b">
                          {new Date(visit.visitDate).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-3 px-4 border-b">{agent ? agent.name : "Unknown"}</td>
                        <td className="py-3 px-4 border-b">{visit.clientFeedback}</td>
                        <td className="py-3 px-4 border-b">{visit.siteVisit ? "Yes" : "No"}</td>
                        <td className="py-3 px-4 border-b">{visit.officeVisit ? "Yes" : "No"}</td>
                        <td className="py-3 px-4 border-b">{visit.remark}</td>
                        <td className="py-3 px-4 border-b flex flex-col sm:flex-row items-center justify-between">
                          <button
                            onClick={() => handleVisitEdit(visit)}
                            className="my-1 py-2 px-4 bg-yellow-500 text-white rounded-md sm:mr-2 w-full sm:w-auto flex items-center justify-center"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(visit.id)}
                            className="my-1 py-2 px-4 bg-red-500 text-white rounded-md w-full sm:w-auto flex items-center justify-center"
                          >
                            Delete
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

      <div className="max-w-2xl mx-auto bg-gray-50 p-6 rounded-lg shadow-md mt-10" style={{ fontFamily: 'Noto Sans, Sans' }}>
        <h2 className="text-3xl font-bold mb-4">Register Office/Site Visit</h2>
        <Divider />
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-gray-100 p-4 rounded-lg mt-4">
            <div>
              <label className="text-xl font-semibold">Client Contact</label>
              <input
                type="text"
                placeholder="Search by phone number"
                onChange={(e) => {
                  const searchTerm = e.target.value.toLowerCase();
                  if (searchTerm === "") {
                    setProspectFilters([]);
                  } else {
                    const filteredProspects = prospects.filter((prospect) =>
                      prospect["Phone number"].toLowerCase().includes(searchTerm)
                    );
                    setProspectFilters(filteredProspects);
                  }
                }}
                className="w-full p-2 border rounded-lg mb-2 mt-2"
              />
              <select
                name="soldTo"
                value={formData.soldTo}
                onChange={(e) => {
                  handleChange(e);
                  const selectedProspect = prospects.find((prospect) => prospect.id === e.target.value);
                  if (selectedProspect) {
                    setFormData((prevData) => ({
                      ...prevData,
                      clientId: selectedProspect.id,
                      clientName: selectedProspect.Name,
                      phoneNumber: selectedProspect["Phone number"],
                    }));
                  } else {
                    setFormData((prevData) => ({
                      ...prevData,
                      clientId: "",
                      clientName: "",
                      phoneNumber: "",
                    }));
                  }
                }}
                className="w-full p-2 border rounded-lg"
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
            </div>

            {formData.soldTo === "Others" && (
              <div className="mt-4">
                <label className="block text-gray-700 mb-2">Client Name</label>
                <input
                  type="text"
                  name="prospectName"
                  value={formData.prospectName}
                  onChange={handleChange}
                  className="w-full p-2 border rounded-lg"
                />
                <label className="block text-gray-700 mb-2 mt-4">Client Phone Number</label>
                <input
                  type="text"
                  name="prospectPhoneNumber"
                  value={formData.prospectPhoneNumber}
                  onChange={handleChange}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-gray-700 mb-2">Visit Date</label>
            <input
              type="date"
              name="visitDate"
              value={formData.visitDate}
              onChange={handleChange}
              className="w-full p-2 border rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 mb-2">Client Feedback</label>
            <input
              type="text"
              name="clientFeedback"
              value={formData.clientFeedback}
              onChange={handleChange}
              className="w-full p-2 border rounded-lg"
              required
            />
          </div>

          <div className="flex items-center space-x-4">
            <div>
              <label className="block text-gray-700 mb-2">Site Visit</label>
              <input
                type="checkbox"
                name="siteVisit"
                checked={formData.siteVisit}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="block text-gray-700 mb-2">Office Visit</label>
              <input
                type="checkbox"
                name="officeVisit"
                checked={formData.officeVisit}
                onChange={handleChange}
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-700 mb-2">Remark</label>
            <input
              type="text"
              name="remark"
              value={formData.remark}
              onChange={handleChange}
              className="w-full p-2 border rounded-lg"
            />
          </div>

          {animationStatus === "success" ? (
            <div className="flex justify-start items-left">
              <DotLottieReact
                src="https://lottie.host/2cc98f5a-e22e-46d3-b73f-fb1b40fd9364/E8mJpbWQYS.lottie"
                loop
                autoplay
                style={{ width: 100, height: 100 }}
              />
            </div>
          ) : animationStatus === "error" ? (
            <div className="absolute top-0 left-0 w-full h-full flex justify-center items-center bg-white bg-opacity-70 rounded-lg z-20">
              <p className="text-red-500 text-center">
                Error updating the data. Please try again.
              </p>
            </div>
          ) : (
            <button
              type="submit"
              className="bg-[#117960] text-white py-2 px-4 rounded-lg w-full sm:w-1/2 hover:bg-[#0e684e]"
            >
              Register Visit
            </button>
          )}
        </form>
      </div>
    </>
  );
}