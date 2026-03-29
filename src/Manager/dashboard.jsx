import React, { useEffect, useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { getAuth } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, Legend, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { db } from "../Sales/Components/firebase";
import { 
  UserOutlined, CalendarOutlined, ClockCircleOutlined, 
  DollarOutlined, HomeOutlined, ShopOutlined, TeamOutlined,
  SafetyOutlined, LoginOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { Layout, Card, Row, Col, Divider, Spin, DatePicker, Button, Alert } from 'antd';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Content } = Layout;

const ManagerDashboard = () => {
  const [rawData, setRawData] = useState({
    prospects: [],
    supervisors: [],
    salesAgents: [],
    allData: [],
    sales: [],
    visits: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState([]);
  const navigate = useNavigate();

  // Optimized data fetcher with error handling
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const auth = getAuth();
      const currentUser = auth.currentUser;

      if (!currentUser) {
        throw new Error('No authenticated user found');
      }

      const dataPromises = [
        getDocs(collection(db, "Prospect")).catch(e => {
          console.error("Error fetching prospects:", e);
          return { docs: [] };
        }),
        getDocs(query(collection(db, "teamMembers"), where("role", "==", "Supervisor"))).catch(e => {
          console.error("Error fetching supervisors:", e);
          return { docs: [] };
        }),
        getDocs(query(collection(db, "teamMembers"), where("role", "==", "Sales Agent"))).catch(e => {
          console.error("Error fetching sales agents:", e);
          return { docs: [] };
        }),
        getDocs(query(collection(db, "teamMembers"), where("userId", "==", currentUser.uid))).catch(e => {
          console.error("Error fetching user data:", e);
          return { docs: [] };
        }),
        getDocs(collection(db, "sales")).catch(e => {
          console.error("Error fetching sales:", e);
          return { docs: [] };
        }),
        getDocs(collection(db, "visits")).catch(e => {
          console.error("Error fetching visits:", e);
          return { docs: [] };
        })
      ];

      const results = await Promise.all(dataPromises);

      setRawData({
        prospects: results[0].docs.map(doc => ({ id: doc.id, ...doc.data() })) || [],
        supervisors: results[1].docs.map(doc => ({ id: doc.id, ...doc.data() })) || [],
        salesAgents: results[2].docs.map(doc => ({ id: doc.id, ...doc.data() })) || [],
        allData: results[3].docs.map(doc => ({ id: doc.id, ...doc.data() })) || [],
        sales: results[4].docs.map(doc => ({ id: doc.id, ...doc.data() })) || [],
        visits: results[5].docs.map(doc => ({ id: doc.id, ...doc.data() })) || []
      });
    } catch (error) {
      console.error("Error fetching data:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    return () => {
      // Cleanup if needed
    };
  }, [fetchData]);

  // Improved date filtering with validation
  const filterByDate = useCallback((data, dateField) => {
    if (!Array.isArray(data) || !dateField) return [];
    if (!dateRange || dateRange.length !== 2) return data;

    try {
      const [start, end] = dateRange;
      if (!start || !end) return data;

      return data.filter(item => {
        if (!item || !item[dateField]) return false;
        
        try {
          const dateValue = item[dateField];
          const date = dateValue?.toDate?.() || new Date(dateValue);
          if (isNaN(date.getTime())) return false;
          
          return date >= start.toDate() && date <= end.toDate();
        } catch {
          return false;
        }
      });
    } catch {
      return data;
    }
  }, [dateRange]);

  // Memoized filtered data with date range
  const filteredData = useMemo(() => ({
    prospects: filterByDate(rawData.prospects, 'Date'),
    sales: filterByDate(rawData.sales, 'dateOfRecording'),
    visits: filterByDate(rawData.visits, 'visitDate')
  }), [rawData, filterByDate]);

  // Optimized metrics calculation with validation
  const metrics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1);
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const safeParseInt = (value) => {
      const num = parseInt(value || 0, 10);
      return isNaN(num) ? 0 : num;
    };

    return {
      totalSalesNumber: filteredData.sales.length,
      totalSalesAmount: filteredData.sales.reduce((total, sale) => 
        total + safeParseInt(sale.salesAmount), 0).toLocaleString(),
      totalSupervisors: rawData.supervisors.length,
      totalSalesAgents: rawData.salesAgents.length,
      totalProspectsAllTime: filteredData.prospects.length,
      totalOfficeVisits: filteredData.visits.filter(v => v?.officeVisit).length,
      totalSiteVisits: filteredData.visits.filter(v => v?.siteVisit).length,
      totalProspectsThisWeek: filteredData.prospects.filter(p => {
        try {
          const prospectDate = p?.Date?.toDate?.() || new Date(p?.Date);
          return prospectDate >= weekStart && prospectDate <= weekEnd;
        } catch {
          return false;
        }
      }).length,
      totalProspectsToday: filteredData.prospects.filter(p => {
        try {
          const prospectDate = p?.Date?.toDate?.() || new Date(p?.Date);
          return prospectDate.toDateString() === today.toDateString();
        } catch {
          return false;
        }
      }).length
    };
  }, [filteredData, rawData]);

  // Chart data preparation with error handling
  const chartData = useMemo(() => {
    try {
      // Weekly visits per team
      const weeklyDailyData = rawData.supervisors.map(supervisor => {
        const teamAgents = rawData.salesAgents.filter(agent => agent?.supervisor === supervisor?.id);
        return {
          name: supervisor?.name || 'Unknown',
          officeVisits: teamAgents.reduce((total, agent) => 
            total + filteredData.visits.filter(v => v?.officeVisit && v?.salesAgent === agent?.id).length, 0),
          siteVisits: teamAgents.reduce((total, agent) => 
            total + filteredData.visits.filter(v => v?.siteVisit && v?.salesAgent === agent?.id).length, 0)
        };
      }).filter(item => item.name !== 'Unknown');

      // Last week vs this week visits
      const lastWeekVsThisWeekData = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - date.getDay() + i + 1);
        const dayName = dayjs(date).format('ddd');
        
        const thisWeekCount = filteredData.visits.filter(v => {
          try {
            const visitDate = v?.visitDate?.toDate?.() || new Date(v?.visitDate);
            return visitDate.toDateString() === date.toDateString();
          } catch {
            return false;
          }
        }).length;

        const lastWeekDate = new Date(date);
        lastWeekDate.setDate(date.getDate() - 7);
        const lastWeekCount = filteredData.visits.filter(v => {
          try {
            const visitDate = v?.visitDate?.toDate?.() || new Date(v?.visitDate);
            return visitDate.toDateString() === lastWeekDate.toDateString();
          } catch {
            return false;
          }
        }).length;

        return { name: dayName, lastWeek: lastWeekCount, thisWeek: thisWeekCount };
      });

      // Sales source breakdown
      const salesSourceData = filteredData.sales.reduce((acc, sale) => {
        const source = sale?.salesAgent === "Freelance" ? "Freelance" :
                      sale?.salesAgent === "Digital Department" ? "Digital Department" : "Sales Team";
        acc[source] = (acc[source] || 0) + 1;
        return acc;
      }, {});

      return {
        weeklyDailyData,
        lastWeekVsThisWeekData,
        teamPerformanceData: Object.entries(salesSourceData).map(([name, value]) => ({ name, value })),
        visitTypeData: [
          { name: "Office Visits", value: metrics.totalOfficeVisits },
          { name: "Site Visits", value: metrics.totalSiteVisits }
        ]
      };
    } catch (error) {
      console.error("Error preparing chart data:", error);
      return {
        weeklyDailyData: [],
        lastWeekVsThisWeekData: [],
        teamPerformanceData: [],
        visitTypeData: []
      };
    }
  }, [rawData, filteredData, metrics]);

  const COLORS = ['#117960', '#0e684e', '#129777', '#00C49F', '#0088FE', '#FF8042'];

  const handleCardClick = useCallback((path) => {
    navigate(`/ManagerDashboard/${path}`);
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spin size="large" tip="Loading Dashboard..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Alert
          message="Error Loading Dashboard"
          description={error}
          type="error"
          showIcon
        />
      </div>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Content className="p-4 md:p-6 bg-gray-50">
        {/* Header Section */}
        <div className="mb-4 md:mb-6">
          <Row gutter={[16, 16]} className="mb-2 md:mb-4">
            <Col xs={24}>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-gray-800">Manager Dashboard</h1>
                <p className="text-gray-600 text-sm md:text-base">
                  Welcome back, {rawData.allData[0]?.name || 'Manager'}
                </p>
              </div>
            </Col>
          </Row>
        </div>

        {/* Date Range Picker */}
        <div className="bg-gradient-to-r from-[#117960] to-[#0e684e] p-4 rounded-xl shadow-lg mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div className="mb-4 sm:mb-0">
              <h2 className="text-xl sm:text-2xl font-semibold text-white">Performance Overview</h2>
              <p className="text-gray-100">Role: {rawData.allData[0]?.role || 'Manager'}</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-gray-100 mb-2">
                <span className="font-bold">Date Range:</span>
              </p>
              <RangePicker
                value={dateRange}
                onChange={setDateRange}
                className="w-full sm:w-auto"
                size="middle"
                disabledDate={current => current && current > dayjs().endOf('day')}
              />
            </div>
          </div>
        </div>

        {/* Summary Cards - First Row */}
        <Row gutter={[8, 8]} className="mb-4 md:mb-6">
          {[
            { title: 'Total Prospects', value: metrics.totalProspectsAllTime, icon: <UserOutlined />, color: '#117960' },
            { title: 'Prospects This Week', value: metrics.totalProspectsThisWeek, icon: <CalendarOutlined />, color: '#FF8042' },
            { title: 'Prospects Today', value: metrics.totalProspectsToday, icon: <ClockCircleOutlined />, color: '#FFBB28' },
            { title: 'Total Supervisors', value: metrics.totalSupervisors, icon: <TeamOutlined />, color: '#0e684e' },
            { title: 'Total Sales Agents', value: metrics.totalSalesAgents, icon: <UserOutlined />, color: '#129777' },
            { title: "Today's Activity", value: metrics.totalProspectsToday + metrics.totalSiteVisits, icon: <LoginOutlined />, color: '#0088FE' }
          ].map((metric, index) => (
            <Col xs={24} sm={12} md={8} lg={6} xl={4} key={index}>
              <MetricCard
                title={metric.title}
                value={metric.value}
                icon={metric.icon}
                color={metric.color}
                onClick={metric.title.includes('Prospects') ? () => handleCardClick("ReportProspect") : undefined}
              />
            </Col>
          ))}
        </Row>

        {/* Summary Cards - Second Row */}
        <Row gutter={[8, 8]} className="mb-4 md:mb-6">
          {[
            { 
              title: 'Total Sales Amount', 
              value: `${metrics.totalSalesAmount} ETB`, 
              icon: <DollarOutlined />, 
              color: '#581845',
              span: { xs: 24, sm: 24, md: 12, lg: 8 }
            },
            { 
              title: 'Total Sold Properties', 
              value: metrics.totalSalesNumber, 
              icon: <HomeOutlined />, 
              color: '#900C3F',
              span: { xs: 24, sm: 12, md: 6, lg: 4 }
            },
            { 
              title: 'Total Office Visits', 
              value: metrics.totalOfficeVisits, 
              icon: <ShopOutlined />, 
              color: '#00C49F',
              span: { xs: 24, sm: 12, md: 6, lg: 4 }
            },
            { 
              title: 'Total Site Visits', 
              value: metrics.totalSiteVisits, 
              icon: <HomeOutlined />, 
              color: '#0088FE',
              span: { xs: 24, sm: 12, md: 6, lg: 4 }
            }
          ].map((metric, index) => (
            <Col 
              key={index}
              xs={metric.span.xs}
              sm={metric.span.sm}
              md={metric.span.md}
              lg={metric.span.lg}
            >
              <MetricCard
                title={metric.title}
                value={metric.value}
                icon={metric.icon}
                color={metric.color}
              />
            </Col>
          ))}
        </Row>

        {/* Charts Section */}
        <Row gutter={[16, 16]} className="mb-4 md:mb-6">
          <Col xs={24} md={12}>
            <ChartCard title="Weekly Office & Site Visits per Team">
              {chartData.weeklyDailyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData.weeklyDailyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="officeVisits" fill="#00C49F" name="Office Visits" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="siteVisits" fill="#117960" name="Site Visits" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex justify-center items-center h-64">
                  <p>No data available for this chart</p>
                </div>
              )}
            </ChartCard>
          </Col>
          <Col xs={24} md={12}>
            <ChartCard title="Last Week vs. This Week Visits">
              {chartData.lastWeekVsThisWeekData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData.lastWeekVsThisWeekData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="lastWeek" 
                      stroke="#FF8042" 
                      name="Last Week" 
                      strokeWidth={2}
                      dot={{ fill: '#FF8042', strokeWidth: 2, r: 4 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="thisWeek" 
                      stroke="#117960" 
                      name="This Week" 
                      strokeWidth={2}
                      dot={{ fill: '#117960', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex justify-center items-center h-64">
                  <p>No data available for this chart</p>
                </div>
              )}
            </ChartCard>
          </Col>
          <Col xs={24} md={12}>
            <ChartCard title="Sales Source Breakdown">
              {chartData.teamPerformanceData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={chartData.teamPerformanceData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {chartData.teamPerformanceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex justify-center items-center h-64">
                  <p>No data available for this chart</p>
                </div>
              )}
            </ChartCard>
          </Col>
          <Col xs={24} md={12}>
            <ChartCard title="Office vs Site Visits Distribution">
              {chartData.visitTypeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={chartData.visitTypeData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {chartData.visitTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex justify-center items-center h-64">
                  <p>No data available for this chart</p>
                </div>
              )}
            </ChartCard>
          </Col>
        </Row>
      </Content>
    </Layout>
  );
};

// Metric Card Component with PropTypes
const MetricCard = React.memo(({ title, value, icon, color = '#117960', onClick }) => {
  return (
    <Card 
      className="shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full"
      onClick={onClick}
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <div className="flex items-center h-full">
        <div className={`p-3 rounded-full mr-4`} style={{ backgroundColor: `${color}20`, color }}>
          {React.cloneElement(icon, { style: { fontSize: '24px' } })}
        </div>
        <div>
          <p className="text-gray-500 text-sm">{title}</p>
          <h3 className="text-2xl font-bold" style={{ color }}>{value}</h3>
        </div>
      </div>
    </Card>
  );
});

MetricCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  icon: PropTypes.element.isRequired,
  color: PropTypes.string,
  onClick: PropTypes.func
};

// Chart Card Component with PropTypes
const ChartCard = React.memo(({ title, children }) => {
  return (
    <Card
      title={title}
      className="shadow-sm h-full"
      headStyle={{ borderBottom: '1px solid #f0f0f0', color: '#117960' }}
      bodyStyle={{ height: 'calc(100% - 56px)' }}
    >
      <div className="h-full">
        {children}
      </div>
    </Card>
  );
});

ChartCard.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired
};

export default ManagerDashboard;