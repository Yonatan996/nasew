import React, { useState, useEffect } from 'react';
import { db } from '../Sales/Components/firebase';
import { collection, getDocs, query, where, addDoc, doc, updateDoc , deleteDoc} from "firebase/firestore";
import { Divide } from 'lucide-react';
import { Divider } from 'antd';
const TeamPerformancePage = () => {
  // State to hold the teams data from Firestore
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salesDate,setsalesDate] = useState("");

  useEffect(() => {
    // Fetch teams data from Firestore
    const fetchTeams = async () => {
      try {
        // Assuming you have a 'users' collection in Firestore where each user has a role and supervisor
     

        const userRef = await getDocs(collection(db, "teamMembers"));
        const snapshot = await getDocs(query(collection(db, "teamMembers"), where('role', '==', 'Sales Agent'))); // Fetch sales agents
        const supervisorSnapshot = await getDocs(query(collection(db, "teamMembers"), where('role', '==', 'Supervisor'))); // Fetch supervisors

        const supervisors = [];
        supervisorSnapshot.forEach(doc => {
          supervisors.push({ id: doc.id, ...doc.data() });
        });

   
   
        const salesAgentId = "D3bROto90aLvTcBgN0Bq";
        const salesAgentSalesRef = await getDocs(query(collection(db, "sales"), where('salesAgent', '==', salesAgentId)));
        const salesAgentSales = salesAgentSalesRef.docs.map(doc => doc.data().salesAmount);
        setsalesDate(salesAgentSales);
    
        // Grouping sales agents under their respective supervisors
        const teamsData = supervisors.map(supervisor => {
          const salesAgents = [];
          snapshot.forEach(doc => {
            const agent = doc.data();
            if (agent.supervisor === supervisor.id) {
              salesAgents.push({ id: doc.id, ...agent });
            }
          });
          
          return { supervisor: supervisor.name, salesAgents };
        });

        setTeams(teamsData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data: ', error);
        setLoading(false);
      }
    };

    fetchTeams();
  }, []);

  // Calculate average sales for all agents
  const allSales = teams.flatMap((team) => team.salesAgents.map((agent) => agent.sales));
  const averageSales = allSales.length > 0 ? allSales.reduce((sum, sales) => sum + sales, 0) / allSales.length : 0;

  // Redistribute agent (optional)
  const redistributeAgent = (agentId, newSupervisorName) => {
    const updatedTeams = teams.map((team) => {
      // Remove agent from current team
      const updatedAgents = team.salesAgents.filter((agent) => agent.id !== agentId);
      // Add agent to new supervisor's team
      if (team.supervisor === newSupervisorName) {
        const agent = teams
          .flatMap((t) => t.salesAgents)
          .find((a) => a.id === agentId);
        updatedAgents.push(agent);
      }
      return { ...team, salesAgents: updatedAgents };
    });
    setTeams(updatedTeams);
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen" style={{ fontFamily: 'Noto Sans, Sans' }}>
      <h1 className="text-3xl font-bold mb-6">Team Distribution and Performance</h1>
 <Divider />
      {/* Averag>e Sales Display */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-lg font-semibold">Average Sales: ${averageSales.toFixed(2)}</h2>
      </div>

      {/* Teams and Agents List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <div>Loading...</div>
        ) : (
          teams.map((team) => (
            <div key={team.supervisor} className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-[#117960] text-lg font-semibold mb-4">{team.supervisor}'s Team</h2>
              <ul>
                {team.salesAgents.map((agent) => (
                  <li
                    key={agent.id}
                    className={`p-3 mb-2 rounded-md ${
                      agent.sales >= averageSales ? 'bg-green-100' : 'bg-red-100'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span>{agent.name}</span>
                      <span>${salesDate}</span>
                    </div>
                    {/* Redistribute Button (Optional) */}
                    <div className="mt-2">
                      <select
                        onChange={(e) => redistributeAgent(agent.id, e.target.value)}
                        className="p-1 border border-gray-300 rounded-md text-sm"
                      >
                        <option value="">Move to...</option>
                        {teams
                          .filter((t) => t.supervisor !== team.supervisor)
                          .map((t) => (
                            <option key={t.supervisor} value={t.supervisor}>
                              {t.supervisor}
                            </option>
                          ))}
                      </select>
                    </div>
                  </li>
                ))}
              </ul>
              {/* Total Sales for the Team */}
              <div className="mt-4">
                <h3 className="text-md font-semibold">Total Sales: ${team.salesAgents.reduce((sum, agent) => sum + agent.sales, 0)}</h3>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TeamPerformancePage;
