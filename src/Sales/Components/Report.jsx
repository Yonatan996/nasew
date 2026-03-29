import React, { useState, useEffect, useMemo, useCallback } from "react";
import { collection, getDocs, query, where, addDoc } from "firebase/firestore";
import { 
  UserOutlined, CalendarOutlined, HistoryOutlined, 
  DollarOutlined, TrophyOutlined, DownloadOutlined, 
  PhoneOutlined, EyeOutlined, EditOutlined 
} from '@ant-design/icons';
import { db } from "./firebase";
import { Bar, Pie } from "react-chartjs-2";
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, ArcElement, Tooltip, Legend } from "chart.js";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { Layout, Card, Row, Col, Divider, Modal, Pagination, notification, Button, Spin, Typography, Input, Form, Select } from 'antd';
import { getAuth } from "firebase/auth";
import dayjs from 'dayjs';

ChartJS.register(BarElement, CategoryScale, LinearScale, ArcElement, Tooltip, Legend);

const { Content } = Layout;
const { Title, Text } = Typography;

// Constants for better maintainability
const PAGE_SIZE = 5;
const DATE_FIELDS = {
  prospects: 'Date',
  visits: 'visitDate',
  sales: 'dateOfRecording',
  followUps: 'date'
};

const Report = () => {
  // Split state into multiple pieces to avoid unnecessary re-renders
  const [data, setData] = useState({
    prospects: [],
    visits: [],
    sales: [],
    followUps: [],
    userInfo: {},
    supervisor: ""
  });
  
  const [filters, setFilters] = useState({
    fromDate: "",
    toDate: ""
  });
  
  const [ui, setUi] = useState({
    loading: true,
    activeView: null,
    isModalVisible: false,
    successModalVisible: false,
    followUpNumber: "",
    followUpError: "",
    successMessage: "",
    currentPage: { prospects: 1, office: 1, site: 1, sales: 1, followUps: 1 }
  });

  // Memoized data processing with improved efficiency
  const processData = useCallback((type, docs) => {
    const dateField = DATE_FIELDS[type];
    
    return docs.map(doc => {
      const base = { id: doc.id, ...doc.data() };
      const dateValue = base[dateField]?.toDate ? 
        base[dateField].toDate() : 
        new Date(base[dateField]);
      
      return {
        ...base,
        [dateField]: dateValue,
        officeVisit: type === 'visits' ? base.officeVisit === true : undefined,
        siteVisit: type === 'visits' ? base.siteVisit === true : undefined
      };
    });
  }, []);

  // Optimized fetch function with less state updates
  const fetchData = useCallback(async (currentUser) => {
    if (!currentUser) return;
    
    setUi(prev => ({ ...prev, loading: true }));
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    try {
      const userDoc = await getDocs(query(collection(db, "teamMembers"), where("userId", "==", user.uid)));
      const userDocId = userDoc.docs[0]?.id;
      if (!userDocId) throw new Error("User document not found");

      const [
        userSnapshot, 
        prospectSnapshot, 
        salesSnapshot, 
        visitsSnapshot, 
        followUpSnapshot
      ] = await Promise.all([
        getDocs(collection(db, "teamMembers")),
        getDocs(query(collection(db, "Prospect"), where("user", "==", currentUser.uid))),
        getDocs(query(collection(db, "sales"), where("salesAgent", "==", userDocId))),
        getDocs(query(collection(db, "visits"), where("salesAgent", "==", userDocId))),
        getDocs(query(collection(db, "followUps"), where("userId", "==", currentUser.uid)))
      ]);

      const userData = userSnapshot.docs.find(doc => doc.data().userId === currentUser.uid)?.data() || {};

      // Single state update with all data
      setData({
        prospects: processData('prospects', prospectSnapshot.docs),
        visits: processData('visits', visitsSnapshot.docs),
        sales: processData('sales', salesSnapshot.docs),
        followUps: processData('followUps', followUpSnapshot.docs),
        userInfo: {
          name: userData.name,
          role: userData.role,
          id: currentUser.uid
        },
        supervisor: userData.supervisor || ""
      });

      setUi(prev => ({ ...prev, loading: false }));
    } catch (error) {
      console.error("Error fetching data:", error);
      notification.error({
        message: "Data Fetch Failed",
        description: error.message,
        duration: 5,
      });
      setUi(prev => ({ ...prev, loading: false }));
    }
  }, [processData]);

  // Initialize auth and fetch data with cleanup
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user) fetchData(user);
    });
    return () => unsubscribe();
  }, [fetchData]);

  // Optimized filter function with memoization
  const filterByDate = useCallback((data, dateField) => {
    if (!data || !data.length) return [];
    const { fromDate, toDate } = filters;
    if (!fromDate && !toDate) return data;

    return data.filter(item => {
      const itemDate = item[dateField];
      if (!itemDate || isNaN(itemDate.getTime())) return false;
      const from = fromDate ? new Date(fromDate) : null;
      const to = toDate ? new Date(`${toDate}T23:59:59.999Z`) : null;
      return (!from || itemDate >= from) && (!to || itemDate <= to);
    });
  }, [filters]);

  // Memoized calculations with improved efficiency
  const { filteredStats, barData, pieData } = useMemo(() => {
    const filteredProspects = filterByDate(data.prospects, DATE_FIELDS.prospects);
    const filteredVisits = filterByDate(data.visits, DATE_FIELDS.visits);
    const filteredSales = filterByDate(data.sales, DATE_FIELDS.sales);
    const filteredFollowUps = filterByDate(data.followUps, DATE_FIELDS.followUps);

    // Calculate stats
    const stats = {
      totalProspects: filteredProspects.length,
      totalOfficeVisits: filteredVisits.filter(v => v.officeVisit).length,
      totalSiteVisits: filteredVisits.filter(v => v.siteVisit).length,
      totalSalesNumber: filteredSales.length,
      totalSalesAmount: filteredSales.reduce((total, doc) => total + (parseInt(doc.salesAmount, 10) || 0), 0),
      totalFollowUps: filteredFollowUps.reduce((total, doc) => total + (doc.followUpNumber || 0), 0),
    };

    // Prepare chart data more efficiently
    const now = new Date();
    const todayStr = now.toDateString();
    const oneWeekAgo = new Date(now.setDate(now.getDate() - 7));
    
    const dailyProspects = filteredProspects.filter(p => 
      p.Date.toDateString() === todayStr
    ).length;
    
    const weeklyProspects = filteredProspects.filter(p => 
      p.Date >= oneWeekAgo
    ).length;

    // Method distribution with better performance
    const methodCounts = {};
    filteredProspects.forEach(p => {
      const method = p.Method || 'Unknown';
      methodCounts[method] = (methodCounts[method] || 0) + 1;
    });
    const methodsUsed = Object.keys(methodCounts);
    const methodValues = methodsUsed.map(method => methodCounts[method]);

    return {
      filteredStats: stats,
      barData: {
        labels: ["Daily", "Weekly", "Total"],
        datasets: [{
          label: "Prospects Count",
          data: [dailyProspects, weeklyProspects, stats.totalProspects],
          backgroundColor: ["#4CAF50", "#FF9800", "#2196F3"],
        }],
      },
      pieData: {
        labels: methodsUsed,
        datasets: [{
          label: "Methods Used",
          data: methodValues,
          backgroundColor: ["#E91E63", "#FFEB3B", "#9C27B0", "#00BCD4", "#8BC34A"],
        }],
      }
    };
  }, [data, filterByDate]);

  // Handle follow-up submission with less state updates
  const handleSubmit = async () => {
    const { followUpNumber } = ui;
    const { supervisor } = data;
    
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error("Please sign in to submit a follow-up number.");

      const followUpNum = parseInt(followUpNumber, 10);
      if (isNaN(followUpNum)) throw new Error("Please enter a valid number.");

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const followUpQuery = query(
        collection(db, "followUps"),
        where("userId", "==", user.uid),
        where("date", ">=", today),
        where("date", "<", tomorrow)
      );

      const followUpSnapshot = await getDocs(followUpQuery);
      
      if (!followUpSnapshot.empty) {
        const lastSubmission = followUpSnapshot.docs[0].data().date.toDate();
        const nextAllowedSubmission = new Date(lastSubmission.getTime() + 24 * 60 * 60 * 1000);
        
        setUi(prev => ({
          ...prev,
          followUpError: `You already submitted today. Next submission available on ${dayjs(nextAllowedSubmission).format('DD/MM/YYYY')}`,
          isModalVisible: false
        }));
        return;
      }

      await addDoc(collection(db, "followUps"), {
        userId: user.uid,
        followUpNumber: followUpNum,
        supervisor: supervisor || "N/A",
        date: new Date(),
      });

      // Optimized state update
      setData(prev => ({
        ...prev,
        followUps: [
          ...prev.followUps,
          { 
            id: user.uid, 
            followUpNumber: followUpNum,
            supervisor: supervisor || "N/A",
            date: new Date() 
          }
        ]
      }));

      setUi(prev => ({
        ...prev,
        successMessage: `Successfully submitted ${followUpNum} follow-ups!`,
        successModalVisible: true,
        followUpNumber: "",
        followUpError: "",
        isModalVisible: false
      }));

      setTimeout(() => {
        setUi(prev => ({ ...prev, successModalVisible: false }));
      }, 5000);

    } catch (error) {
      console.error("Error submitting follow-up:", error);
      setUi(prev => ({
        ...prev,
        followUpError: error.message
      }));
      notification.error({
        message: "Submission Failed",
        description: error.message,
        duration: 5,
      });
    }
  };

  // Download Excel report with optimized data processing
  const downloadExcel = async () => {
    const { prospects } = data;
    const { fromDate, toDate } = filters;
    const { name } = data.userInfo;

    if (!prospects.length) {
      notification.error({
        message: "No Data",
        description: "No data available to export.",
        duration: 5,
      });
      return;
    }

    try {
      const filteredData = filterByDate(prospects, DATE_FIELDS.prospects);
      const formattedData = filteredData.map(p => ({
        Name: p.Name || "",
        "Phone Number": p["Phone number"] || "",
        Comment: p.Comment || "",
        Method: p.Method || "",
        Interest: p.Interest || "",
        Date: dayjs(p.Date).format("DD/MM/YYYY"),
      }));

      const ws = XLSX.utils.json_to_sheet(formattedData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Prospects");
      
      const fileName = `prospects_${name || 'user'}_${fromDate || 'all'}_to_${toDate || 'all'}.xlsx`;
      const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      saveAs(new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), fileName);
      
      setUi(prev => ({
        ...prev,
        successMessage: "Report downloaded successfully!",
        successModalVisible: true
      }));

      setTimeout(() => {
        setUi(prev => ({ ...prev, successModalVisible: false }));
      }, 5000);
    } catch (error) {
      console.error("Export error:", error);
      notification.error({
        message: "Export Failed",
        description: error.message,
        duration: 5,
      });
    }
  };

  // Metric Card Component - memoized to prevent unnecessary re-renders
  const MetricCard = React.memo(({ icon: Icon, title, value, color, view }) => (
    <Card 
      className="hover:shadow-md transition-shadow cursor-pointer h-full"
      onClick={() => setUi(prev => ({
        ...prev,
        activeView: prev.activeView === view ? null : view
      }))}
    >
      <div className="flex items-center">
        <div className={`p-3 rounded-full mr-4`} style={{ backgroundColor: `${color}20`, color }}>
          <Icon style={{ fontSize: '24px' }} />
        </div>
        <div>
          <Text type="secondary">{title}</Text>
          <Title level={3} style={{ color, margin: 0 }}>{value}</Title>
        </div>
      </div>
    </Card>
  ));

  // Render table for active view with optimized pagination
  const renderTable = (type) => {
    const { currentPage } = ui;
    const dataMap = {
      prospects: { data: data.prospects, dateField: DATE_FIELDS.prospects },
      office: { data: data.visits.filter(v => v.officeVisit), dateField: DATE_FIELDS.visits },
      site: { data: data.visits.filter(v => v.siteVisit), dateField: DATE_FIELDS.visits },
      sales: { data: data.sales, dateField: DATE_FIELDS.sales },
      followUps: { data: data.followUps, dateField: DATE_FIELDS.followUps }
    };

    const { data: typeData, dateField } = dataMap[type];
    const filteredData = filterByDate(typeData, dateField);
    const paginatedData = filteredData.slice(
      (currentPage[type] - 1) * PAGE_SIZE,
      currentPage[type] * PAGE_SIZE
    );

    const columns = {
      prospects: [
        { key: 'Name', title: 'Name' },
        { key: 'Phone number', title: 'Phone' },
        { key: 'Date', title: 'Date', render: d => dayjs(d).format('DD/MM/YYYY') },
        { key: 'Method', title: 'Method' }
      ],
      office: [
        { key: 'clientName', title: 'Client' },
        { key: 'phoneNumber', title: 'Phone' },
        { key: 'visitDate', title: 'Date', render: d => dayjs(d).format('DD/MM/YYYY') },
        { key: 'site', title: 'Site' }
      ],
      site: [
        { key: 'clientName', title: 'Client' },
        { key: 'phoneNumber', title: 'Phone' },
        { key: 'visitDate', title: 'Date', render: d => dayjs(d).format('DD/MM/YYYY') },
        { key: 'site', title: 'Site' }
      ],
      sales: [
        { key: 'agreementNumber', title: 'Agreement #' },
        { key: 'salesAmount', title: 'Amount' },
        { key: 'dateOfRecording', title: 'Date', render: d => dayjs(d).format('DD/MM/YYYY') },
        { key: 'soldTo', title: 'Sold To' }
      ],
      followUps: [
        { key: 'date', title: 'Date', render: d => dayjs(d).format('DD/MM/YYYY') },
        { key: 'followUpNumber', title: 'Count' }
      ]
    };

    return (
      <Card className="mt-4">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#f0f0f0]">
                {columns[type].map(col => (
                  <th key={col.key} className="p-2 text-left">
                    {col.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedData.map(item => (
                <tr key={item.id} className="border-b hover:bg-gray-50">
                  {columns[type].map(col => (
                    <td key={col.key} className="p-2">
                      {col.render ? col.render(item[col.key]) : item[col.key] || '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          current={currentPage[type]}
          pageSize={PAGE_SIZE}
          total={filteredData.length}
          onChange={page => setUi(prev => ({
            ...prev,
            currentPage: { ...prev.currentPage, [type]: page }
          }))}
          className="mt-4 text-center"
        />
      </Card>
    );
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Content className="p-4 md:p-6 bg-gray-50">
        {/* Loading Overlay */}
        {ui.loading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Spin size="large" tip="Loading..." className="text-white" />
          </div>
        )}

        {/* Success Modal */}
        <Modal
          open={ui.successModalVisible}
          footer={null}
          closable={false}
          centered
          onCancel={() => setUi(prev => ({ ...prev, successModalVisible: false }))}
        >
          <div className="p-6 text-center">
            <Title level={3} className="text-[#117960]">
              {ui.successMessage}
            </Title>
          </div>
        </Modal>

        {/* Confirmation Modal */}
        <Modal
          title="Confirm Follow-Up Submission"
          open={ui.isModalVisible}
          onOk={handleSubmit}
          onCancel={() => setUi(prev => ({ ...prev, isModalVisible: false }))}
          okText="Submit"
          cancelText="Cancel"
          okButtonProps={{ className: "bg-[#117960] hover:bg-[#129777]" }}
          centered
        >
          <p>Are you sure you want to submit {ui.followUpNumber} follow-ups?</p>
          {ui.followUpError && (
            <Text type="danger" className="mt-2 block">
              {ui.followUpError}
            </Text>
          )}
        </Modal>

        <Card className="mb-6 bg-[#117960] border-[#117960]">
          <Title level={2} style={{ color: 'white' }} className="mb-1">
            Welcome, {data.userInfo.name || 'User'}!
          </Title>
          <Text className="text-gray-200 block">
            Role: {data.userInfo.role || 'N/A'}
          </Text>
          <Text className="text-gray-200">
            {dayjs().format('dddd, MMMM D, YYYY')}
          </Text>
        </Card>

        <Card className="mb-6">
          <Form 
            layout="vertical" 
            onFinish={() => setUi(prev => ({ ...prev, isModalVisible: true }))}
            className="flex flex-col sm:flex-row sm:items-center"
          >
            <Form.Item
              label="Today's Follow-ups"
              name="followUpNumber"
              rules={[{ required: true, message: 'Please enter a number' }]}
              className="flex-1 w-full sm:w-auto"
            >
              <Input
                type="number"
                min="0"
                value={ui.followUpNumber}
                onChange={e => setUi(prev => ({
                  ...prev,
                  followUpNumber: e.target.value
                }))}
                placeholder="Enter number"
              />
            </Form.Item>
            <Form.Item className="mt-4 sm:mt-0 sm:ml-4">
              <Button 
                type="primary" 
                htmlType="submit"
                className="bg-[#117960] hover:bg-[#129777] w-full sm:w-auto"
              >
                Submit
              </Button>
            </Form.Item>
          </Form>
          {ui.followUpError && (
            <Text type="danger" className="mt-2 block">
              {ui.followUpError}
            </Text>
          )}
        </Card>

        {/* Date Filters */}
        <Card className="mb-6">
          <Title level={5} className="mb-4">Filter by Date</Title>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item label="From Date">
                <Input
                  type="date"
                  value={filters.fromDate}
                  onChange={e => setFilters(prev => ({
                    ...prev,
                    fromDate: e.target.value
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item label="To Date">
                <Input
                  type="date"
                  value={filters.toDate}
                  onChange={e => setFilters(prev => ({
                    ...prev,
                    toDate: e.target.value
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Metrics Cards */}
        <Row gutter={[16, 16]} className="mb-6">
          {[
            { icon: UserOutlined, title: 'Prospects', value: filteredStats.totalProspects, color: '#117960', view: 'prospects' },
            { icon: HistoryOutlined, title: 'Office Visits', value: filteredStats.totalOfficeVisits, color: '#FF6347', view: 'office' },
            { icon: HistoryOutlined, title: 'Site Visits', value: filteredStats.totalSiteVisits, color: '#32CD32', view: 'site' },
            { icon: TrophyOutlined, title: 'Sales', value: filteredStats.totalSalesNumber, color: '#6A0DAD', view: 'sales' },
            { icon: PhoneOutlined, title: 'Follow-ups', value: filteredStats.totalFollowUps, color: '#FFA500', view: 'followUps' }
          ].map((metric, i) => (
            <Col xs={24} sm={12} md={8} lg={6} key={i}>
              <MetricCard {...metric} />
            </Col>
          ))}
        </Row>

        {/* Active View Table */}
        {ui.activeView && renderTable(ui.activeView)}

        {/* Charts */}
        <Row gutter={[16, 16]} className="mb-6 mt-5">
          <Col xs={24} md={12}>
            <Card title="Prospects Overview">
              <Bar data={barData} options={{ responsive: true }} />
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title="Methods Distribution">
              <Pie data={pieData} options={{ responsive: true }} />
            </Card>
          </Col>
        </Row>
      </Content>
    </Layout>
  );
};

export default Report;