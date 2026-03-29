import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs, query, where } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { Tabs, Card, Button, DatePicker, Space, Typography, Spin ,Table} from 'antd';
import { 
  UserOutlined, 
  ShopOutlined, 
  HomeOutlined, 
  CalendarOutlined, 
  DollarOutlined,
  CopyOutlined
} from '@ant-design/icons';
import {
  BarChart, Bar,
  PieChart, Pie, Cell,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { db } from "../Sales/Components/firebase";
import dayjs from 'dayjs';

const { TabPane } = Tabs;
const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const SupervisorDashboard = () => {
  // State management
  const [supervisor, setSupervisor] = useState(null);
  const [rawData, setRawData] = useState({
    salesAgents: [],
    prospects: [],
    sales: [],
    followups: [],
    visits: []
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState([]);
  const [copiedAgentId, setCopiedAgentId] = useState(null);
  const [userId, setUserId] = useState("");
  const [userDocId, setUserDocId] = useState("");

  // Memoized data processing
  const { filteredData, chartData, statsCards } = useMemo(() => {
    const [startDate, endDate] = dateRange || [];
    
    // Filter functions
    const filterByDate = (items, dateField) => {
      if (!startDate && !endDate) return items;
      return items.filter(item => {
        const itemDate = item[dateField];
        if (!itemDate) return false;
        return (!startDate || itemDate >= startDate.startOf('day')) && 
               (!endDate || itemDate <= endDate.endOf('day'));
      });
    };

    // Apply filters
    const filteredProspects = filterByDate(rawData.prospects, "Date");
    const filteredVisits = filterByDate(rawData.visits, "visitDate");
    const filteredFollowups = filterByDate(rawData.followups, "date");
    const filteredSales = filterByDate(rawData.sales, "dateOfRecording");

    // Calculate stats
    const stats = {
      totalProspects: filteredProspects.length,
      totalOfficeVisits: filteredVisits.filter(v => v.officeVisit).length,
      totalSiteVisits: filteredVisits.filter(v => v.siteVisit).length,
      totalFollowups: filteredFollowups.reduce((total, f) => total + (Number(f.followUpNumber) || 0), 0),
      totalSales: filteredSales.length,
      totalSalesAmount: filteredSales.reduce((total, s) => total + (Number(s.saleAmount) || 0), 0)
    };

    // Prepare chart data
    const weeklyVisitData = rawData.salesAgents.map(agent => {
      const agentVisits = filteredVisits.filter(v => v.salesAgent === agent.id);
      return {
        name: agent.name,
        officeVisits: agentVisits.filter(v => v.officeVisit).length,
        siteVisits: agentVisits.filter(v => v.siteVisit).length
      };
    });

    const visitTypeData = [
      { name: "Office Visits", value: stats.totalOfficeVisits },
      { name: "Site Visits", value: stats.totalSiteVisits }
    ];

    const salesTrendData = (() => {
      const salesByDate = {};
      filteredSales.forEach(sale => {
        const dateKey = dayjs(sale.dateOfRecording).format('YYYY-MM-DD');
        salesByDate[dateKey] = (salesByDate[dateKey] || 0) + (Number(sale.saleAmount) || 0);
      });
      return Object.entries(salesByDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, amount]) => ({ date, amount }));
    })();

    // Stats cards data
    const statsCards = [
      { icon: <UserOutlined />, title: "Total Prospects", value: stats.totalProspects, color: "teal" },
      { icon: <ShopOutlined />, title: "Office Visits", value: stats.totalOfficeVisits, color: "green" },
      { icon: <HomeOutlined />, title: "Site Visits", value: stats.totalSiteVisits, color: "blue" },
      { icon: <CalendarOutlined />, title: "Follow-ups", value: stats.totalFollowups, color: "orange" },
      { icon: <DollarOutlined />, title: "Total Sales", value: stats.totalSales, color: "purple" },
      { icon: <DollarOutlined />, title: "Sales Amount", value: `${stats.totalSalesAmount.toLocaleString()} ETB`, color: "red" }
    ];

    return {
      filteredData: {
        filteredProspects,
        filteredVisits,
        filteredFollowups,
        filteredSales,
        stats
      },
      chartData: {
        weeklyVisitData,
        visitTypeData,
        salesTrendData
      },
      statsCards
    };
  }, [dateRange, rawData]);

  // Fetch data with optimized queries
  const fetchDashboardData = useCallback(async () => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    setLoading(true);
    try {
      // 1. Fetch supervisor data first
      const supervisorQuery = query(
        collection(db, "teamMembers"),
        where("role", "==", "Supervisor"),
        where("userId", "==", currentUser.uid)
      );
      const supervisorSnapshot = await getDocs(supervisorQuery);
      
      if (supervisorSnapshot.empty) {
        setLoading(false);
        return;
      }

      const supervisorData = supervisorSnapshot.docs[0].data();
      const supervisorId = supervisorSnapshot.docs[0].id;
      
      setUserId(currentUser.uid);
      setUserDocId(supervisorId);
      setSupervisor(supervisorData);

      // 2. Fetch all other data in parallel with optimized queries
      const salesAgentPromise = getDocs(query(
        collection(db, "teamMembers"),
        where("supervisor", "==", supervisorId)
      ));
      const salesAgentSnapshots = await getDocs(query(
        collection(db, "teamMembers"),
        where("supervisor", "==", supervisorId)
      ));

      const salesAgents = salesAgentSnapshots.docs.map(doc => ({
        id: doc.id,
        userId: doc.data().userId,
        ...doc.data()
      }));

      // Add the supervisor's UID and document ID (current user)
      salesAgents.push({
        id: supervisorId,
        userId: currentUser.uid,
        ...supervisorData
      });
      console.log("Sales Agents:", salesAgents);

      setRawData(prevData => ({
        ...prevData,
        salesAgents: [
          { id: supervisorId, userId: currentUser.uid, ...supervisorData },
          ...salesAgents
        ]
      }));
      // Only fetch necessary fields for each collection
      const prospectPromise = getDocs(query(
        collection(db, "Prospect"),
        where("user", "in", salesAgents.map(agent => agent.userId))
      ));

      const salesPromise = getDocs(query(
        collection(db, "sales"),
        where("salesAgent", "in", salesAgents.map(agent => agent.id))
      ));

      const followupPromise = getDocs(query(
        collection(db, "followUps"),
        where("userId",  "in", salesAgents.map(agent => agent.userId))
      ));

      const visitsPromise = getDocs(query(
        collection(db, "visits"),
        where("salesAgent", "in", salesAgents.map(agent => agent.id))
      ));
console.log(salesAgents.map(agent => agent.id))
      const [
        salesAgentSnapshot, 
        prospectSnapshot, 
        salesSnapshot, 
        followSnapshot, 
        visitsSnapshot
      ] = await Promise.all([
        salesAgentPromise,
        prospectPromise,
        salesPromise,
        followupPromise,
        visitsPromise
      ]);

      // Process data with minimal transformations
      setRawData({
        salesAgents: [
          { id: supervisorId, ...supervisorData },
          ...salesAgentSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
        ],
        prospects: prospectSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          Date: doc.data().Date?.toDate?.() || new Date()
        })),
        sales: salesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          dateOfRecording: doc.data().dateOfRecording?.toDate?.() || new Date()
        })),
        followups: followSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date?.toDate?.() || new Date()
        })),
        visits: visitsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          visitDate: doc.data().visitDate?.toDate?.() || new Date(),
          officeVisit: doc.data().officeVisit === true,
          siteVisit: doc.data().siteVisit === true
        }))
      });

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial data load with cleanup
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user) fetchDashboardData();
    });
    return () => unsubscribe();
  }, [fetchDashboardData]);

  // Handle password copy with debounce
  const handleCopyPassword = useCallback((agentId, password) => {
    navigator.clipboard.writeText(`Password: ${password}`);
    setCopiedAgentId(agentId);
    const timer = setTimeout(() => setCopiedAgentId(null), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Optimized table columns
  const agentColumns = useMemo(() => [
    { title: "#", dataIndex: "index", key: "index", width: 50 },
    { title: "Name", dataIndex: "name", key: "name" },
    { title: "Phone", dataIndex: "phoneNumber", key: "phone", render: (text) => text || "-" },
    { title: "Email", dataIndex: "email", key: "email", render: (text) => text || "-" },
    { title: "Prospects", dataIndex: "prospects", key: "prospects" },
    { title: "Office Visits", dataIndex: "officeVisits", key: "officeVisits" },
    { title: "Site Visits", dataIndex: "siteVisits", key: "siteVisits" },
    { title: "Follow-ups", dataIndex: "followups", key: "followups" },
    { title: "Sales", dataIndex: "sales", key: "sales" },
    { title: "Amount (ETB)", dataIndex: "amount", key: "amount", render: (text) => text.toLocaleString() },
    {
      title: "Password",
      key: "password",
      render: (_, record) => (
        <Button
          icon={<CopyOutlined />}
          onClick={() => handleCopyPassword(record.id, record.password)}
          className={copiedAgentId === record.id ? 'bg-green-500 text-white' : ''}
        >
          {copiedAgentId === record.id ? 'Copied' : 'Copy'}
        </Button>
      )
    }
  ], [copiedAgentId, handleCopyPassword]);

  // Prepare agent data for table
  const agentTableData = useMemo(() => {
    return rawData.salesAgents.map((agent, index) => {
      const agentProspects = filteredData.filteredProspects.filter(p => p.user === agent.userId).length;
      const agentVisits = filteredData.filteredVisits.filter(v => v.salesAgent === agent.id);
      const agentFollowups = filteredData.filteredFollowups
        .filter(f => f.userId === agent.userId)
        .reduce((total, f) => total + (Number(f.followUpNumber) || 0), 0);
      const agentSales = filteredData.filteredSales.filter(s => s.salesAgent === agent.id);
      const salesAmount = agentSales.reduce((total, s) => total + (Number(s.saleAmount) || 0), 0);

      return {
        ...agent,
        index: index + 1,
        prospects: agentProspects,
        officeVisits: agentVisits.filter(v => v.officeVisit).length,
        siteVisits: agentVisits.filter(v => v.siteVisit).length,
        followups: agentFollowups,
        sales: agentSales.length,
        amount: salesAmount,
        key: agent.id
      };
    });
  }, [rawData.salesAgents, filteredData]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spin size="large" tip="Loading Dashboard..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        {supervisor && (
          <Card className="bg-gradient-to-r from-teal-600 to-teal-700 text-white">
            <div className="flex flex-col md:flex-row md:items-center justify-between">
              <div>
                <Title level={3} className="text-white mb-1">Welcome, {supervisor.name}!</Title>
                <Text className="text-teal-100">Role: {supervisor.role}</Text>
              </div>
              <Text className="text-teal-100 mt-2 md:mt-0">
                {dayjs().format('dddd, MMMM D, YYYY')}
              </Text>
            </div>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <RangePicker 
                style={{ width: '100%' }}
                onChange={setDateRange}
                ranges={{
                  'Today': [dayjs(), dayjs()],
                  'This Week': [dayjs().startOf('week'), dayjs().endOf('week')],
                  'This Month': [dayjs().startOf('month'), dayjs().endOf('month')]
                }}
              />
            </div>
          </div>
        </Card>

        {/* Tabs */}
        <Tabs defaultActiveKey="1" className="bg-white rounded-lg shadow p-8">
          <TabPane tab="Overview" key="1">
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {statsCards.map((card, index) => (
                  <Card key={index} className="hover:shadow-lg transition-shadow">
                    <div className="flex items-center">
                      <div className={`text-3xl mr-4 text-${card.color}-500`}>
                        {card.icon}
                      </div>
                      <div>
                        <Text className="text-gray-700">{card.title}</Text>
                        <Title level={4} className={`mt-1 text-${card.color}-500`}>
                          {card.value}
                        </Title>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card title="Visits per Agent">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData.weeklyVisitData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="officeVisits" fill="#00C49F" name="Office Visits" />
                      <Bar dataKey="siteVisits" fill="#0088FE" name="Site Visits" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                <Card title="Visit Type Distribution">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={chartData.visitTypeData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        <Cell fill="#00C49F" />
                        <Cell fill="#0088FE" />
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>

                <Card className="md:col-span-2" title="Sales Trend">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData.salesTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="amount" stroke="#FF8042" name="Sales Amount (ETB)" />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            </div>
          </TabPane>

          <TabPane tab="Agents Performance" key="2">
            <Card>
              <Table
                columns={agentColumns}
                dataSource={agentTableData}
                scroll={{ x: true }}
                pagination={{ pageSize: 10 }}
                summary={() => (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={4}>
                      <Text strong>Total</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1}>
                      <Text strong>
                        {agentTableData.reduce((sum, record) => sum + record.prospects, 0)}
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2}>
                      <Text strong>
                        {agentTableData.reduce((sum, record) => sum + record.officeVisits, 0)}
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3}>
                      <Text strong>
                        {agentTableData.reduce((sum, record) => sum + record.siteVisits, 0)}
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4}>
                      <Text strong>
                        {agentTableData.reduce((sum, record) => sum + record.followups, 0)}
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={5}>
                      <Text strong>
                        {agentTableData.reduce((sum, record) => sum + record.sales, 0)}
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={6}>
                      <Text strong>
                        {agentTableData.reduce((sum, record) => sum + record.amount, 0).toLocaleString()}
                      </Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
              />
            </Card>
          </TabPane>
        </Tabs>
      </div>
    </div>
  );
};

export default React.memo(SupervisorDashboard);