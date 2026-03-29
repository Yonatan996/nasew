import React, { useState, useEffect, useMemo } from 'react';
import { Layout, Menu, Button, Card, Row, Col, Modal, Input, Table, Tag, Spin, Pagination, Popconfirm, Form, Select as AntSelect, DatePicker, message } from 'antd';
import { getAuth, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, query, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../Sales/Components/firebase';
import * as XLSX from 'xlsx';
import { useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  PieChart, Pie, Cell, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  UserOutlined, TeamOutlined, SafetyOutlined, MenuFoldOutlined, MenuUnfoldOutlined, LogoutOutlined, DashboardOutlined
} from '@ant-design/icons';
import { FaFileExcel, FaFilter, FaEye, FaEdit, FaTrash } from 'react-icons/fa';
import Select from 'react-select';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

const { Option } = AntSelect;
const { RangePicker } = DatePicker;

const AdminSalesDashboard = () => {
  const [sales, setSales] = useState([]);
  const [prospects, setProspects] = useState([]);
  const [teams, setTeams] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isViewing, setIsViewing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [animationStatus, setAnimationStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filters, setFilters] = useState({
    team: '',
    agent: '',
    phoneNumber: '',
    dateRange: null,
    site: '',
    type: '',
    unassigned: false
  });
  const [filteredData, setFilteredData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [collapsed, setCollapsed] = useState(false);
  const [form] = Form.useForm();
  const [prospectSearchTerm, setProspectSearchTerm] = useState('');
  const [filteredProspects, setFilteredProspects] = useState([]);
  const pageSize = 10;
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setAuthLoading(false);
      if (currentUser) {
        try {
          setLoading(true);
          setError(null);

          // Fetch sales data
          const salesQuery = query(collection(db, 'sales'));
          const salesSnapshot = await getDocs(salesQuery);
          const salesData = salesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            dateOfRecording: doc.data().dateOfRecording?.toDate?.() || doc.data().dateOfRecording
          }));
          setSales(salesData);

          // Fetch prospects
          const prospectQuery = query(collection(db, 'Prospect'));
          const prospectSnapshot = await getDocs(prospectQuery);
          const prospectData = prospectSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            Date: doc.data().Date?.toDate?.() || doc.data().Date
          }));
          setProspects(prospectData);
          setFilteredProspects(prospectData);

          // Fetch team members
          const teamSnapshot = await getDocs(collection(db, 'teamMembers'));
          const teamData = teamSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setTeams(teamData);

          // Extract agents (Sales Agents, Supervisors, Managers)
          const agents = teamData.filter(member =>
            ['Sales Agent', 'Supervisor', 'Manager'].includes(member.role)
          );
          setAgents(agents);

        } catch (error) {
          console.error('Error fetching data:', error);
          setError('Failed to load sales data');
        } finally {
          setLoading(false);
        }
      } else {
        navigate('/adminlogin');
      }
    }, (error) => {
      console.error('Auth state error:', error);
      setError('Authentication error');
      setAuthLoading(false);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (prospectSearchTerm) {
      const filtered = prospects.filter(prospect =>
        prospect['Phone number']?.toLowerCase().includes(prospectSearchTerm.toLowerCase()) ||
        prospect.Name?.toLowerCase().includes(prospectSearchTerm.toLowerCase())
      );
      setFilteredProspects(filtered);
    } else {
      setFilteredProspects(prospects);
    }
  }, [prospectSearchTerm, prospects]);

  const filteredDataMemo = useMemo(() => {
    let data = [...sales];

    if (filters.team) {
      const supervisor = teams.find(t => t.id === filters.team);
      if (supervisor) {
        data = data.filter(sale => {
          const isSupervisorSale = sale.salesAgent === supervisor.id;
          const agent = agents.find(a => a.id === sale.salesAgent);
          const isAgentSale = agent && agent.supervisor === supervisor.id;
          return isSupervisorSale || isAgentSale;
        });
      }
    }

    if (filters.agent) {
      data = data.filter(sale => sale.salesAgent === filters.agent);
    }

    if (filters.phoneNumber) {
      data = data.filter(sale => {
        const prospectPhoneNumber = sale.soldTo === "Others"
          ? sale.prospectPhoneNumber || ""
          : prospects.find(p => p.id === sale.soldTo)?.["Phone number"] || "";
        return prospectPhoneNumber.includes(filters.phoneNumber);
      });
    }

    if (filters.dateRange && filters.dateRange.length === 2) {
      const [start, end] = filters.dateRange;
      data = data.filter(sale => {
        const saleDate = sale.dateOfRecording;
        if (!saleDate) return false;
        const date = saleDate.toDate ? saleDate.toDate() : new Date(saleDate);
        return date >= start.startOf('day').toDate() && date <= end.endOf('day').toDate();
      });
    }

    if (filters.site) {
      data = data.filter(sale => sale.site === filters.site);
    }

    if (filters.type) {
      data = data.filter(sale => sale.type === filters.type);
    }

    if (filters.unassigned) {
      data = data.filter(sale => 
        !['Digital Department', 'Freelance'].includes(sale.salesAgent) && 
        !agents.some(a => a.id === sale.salesAgent)
      );
    }

    return data;
  }, [sales, filters, teams, agents, prospects]);

  useEffect(() => {
    setFilteredData(filteredDataMemo);
    setCurrentPage(1);
  }, [filteredDataMemo]);

  const teamOptions = useMemo(() => [
    { value: '', label: 'All Teams' },
    ...teams
      .filter(member => member.role === 'Supervisor')
      .map(supervisor => ({
        value: supervisor.id,
        label: supervisor.name
      }))
  ], [teams]);

  const agentOptions = useMemo(() => [
    { value: '', label: 'All Agents' },
    { value: 'Digital Department', label: 'Digital Department' },
    { value: 'Freelance', label: 'Freelance' },
    ...agents.map(agent => ({
      value: agent.id,
      label: agent.name
    }))
  ], [agents]);

  const siteOptions = useMemo(() => {
    const sites = [...new Set(sales.map(s => s.site).filter(Boolean))];
    return [
      { value: '', label: 'All Sites' },
      ...sites.map(site => ({ value: site, label: site }))
    ];
  }, [sales]);

  const typeOptions = useMemo(() => {
    const types = [...new Set(sales.map(s => s.type).filter(Boolean))];
    return [
      { value: '', label: 'All Types' },
      ...types.map(type => ({ value: type, label: type }))
    ];
  }, [sales]);

  const prospectOptions = useMemo(() => {
    return filteredProspects.map(prospect => ({
      value: prospect.id,
      label: `${prospect.Name} - ${prospect['Phone number']}`
    }));
  }, [filteredProspects]);

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      team: '',
      agent: '',
      phoneNumber: '',
      dateRange: null,
      site: '',
      type: '',
      unassigned: false
    });
  };

  const handleView = (sale) => {
    setSelectedSale(sale);
    setIsViewing(true);
  };

  const handleEdit = (sale) => {
    setSelectedSale(sale);
    form.setFieldsValue({
      ...sale,
      dateOfRecording: sale.dateOfRecording ? dayjs(sale.dateOfRecording) : null,
      soldTo: sale.soldTo
    });
    setIsEditing(true);
    setAnimationStatus(null);
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'sales', id));
      setSales(prev => prev.filter(sale => sale.id !== id));
      message.success('Sale deleted successfully');
    } catch (error) {
      console.error('Error deleting sale:', error);
      message.error('Failed to delete sale');
    }
  };

  const handleUpdate = async () => {
    setIsSubmitting(true);
    setAnimationStatus(null);

    try {
      const values = await form.validateFields();
      const updatedSale = {
        ...selectedSale,
        ...values,
        dateOfRecording: values.dateOfRecording ? values.dateOfRecording.valueOf() : null,
        site: values.site || null // Ensure site is not undefined
      };
      if (Object.values(updatedSale).some(value => value === undefined)) {
        message.error('Please ensure all fields are filled correctly.');
        return;
      }
      await updateDoc(doc(db, 'sales', selectedSale.id), updatedSale);
      // await updateDoc(doc(db, 'sales', selectedSale.id), updatedSale);
      setSales(prev => prev.map(sale => sale.id === selectedSale.id ? updatedSale : sale));
      setAnimationStatus('success');
      message.success('Sale updated successfully');
      setTimeout(() => {
        setIsEditing(false);
        setAnimationStatus(null);
      }, 1500);
    } catch (error) {
      console.error('Error updating sale:', error);
      setAnimationStatus('error');
      message.error('Failed to update sale');
    } finally {
      setIsSubmitting(false);
    }
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      filteredData.map(sale => {
        const prospect = prospects.find(p => p.id === sale.soldTo);
        return {
          'Agreement Number': sale.agreementNumber || 'N/A',
          'Sales Amount (ETB)': sale.salesAmount || 'N/A',
          'Sales Agent': sale.salesAgent === 'Digital Department' || sale.salesAgent === 'Freelance'
            ? sale.salesAgent
            : agents.find(a => a.id === sale.salesAgent)?.name || sale.salesAgent || 'N/A',
          'Type': sale.type || 'N/A',
          'Site': sale.site || 'N/A',
          'Area (SQM)': sale.areaInSQM || 'N/A',
          'Location': sale.area || 'N/A',
          'House Number': sale.houseNumber || 'N/A',
          'Date': sale.dateOfRecording
            ? new Date(sale.dateOfRecording).toLocaleDateString('en-GB')
            : 'N/A',
          'Sold To': sale.soldTo === 'Others'
            ? `${sale.prospectName || 'N/A'} - ${sale.prospectPhoneNumber || 'N/A'}`
            : prospect
              ? `${prospect.Name || 'N/A'} - ${prospect['Phone number'] || 'N/A'}`
              : 'Unknown',
          'Remark': sale.remark || 'N/A'
        };
      })
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales');
    const dateStr = new Date().toISOString().slice(0, 10);
    const filterNames = Object.entries(filters)
      .filter(([key, value]) => value && key !== 'dateRange')
      .map(([key, value]) => `${key}-${value}`)
      .join('_');

    const dateRangeStr = filters.dateRange
      ? `DateRange-${filters.dateRange[0].format('YYYY-MM-DD')}_to_${filters.dateRange[1].format('YYYY-MM-DD')}`
      : '';

    const fileName = `Sales_${filterNames}${dateRangeStr ? `_${dateRangeStr}` : ''}_${dateStr}.xlsx`;

    XLSX.writeFile(workbook, fileName);
  };

  const calculateMetrics = () => {
    const totalAmount = filteredData.reduce((sum, sale) => sum + parseFloat(sale.salesAmount || 0), 0);
    return {
      totalSales: sales.length,
      filteredSales: filteredData.length,
      totalAmount: totalAmount.toLocaleString(),
      lastUpdated: new Date().toLocaleDateString()
    };
  };

  const { totalSales, filteredSales, totalAmount, lastUpdated } = calculateMetrics();

  const prepareChartData = () => {
    // Aggregate type counts
    const typeCounts = {};
    filteredData.forEach(s => {
      const type = s.type || 'Unknown';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    // Sort types by count, take top 5, group others
    const sortedTypes = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const otherCount = Object.values(typeCounts)
      .slice(5)
      .reduce((sum, count) => sum + count, 0);

    const typeData = [
      ...sortedTypes.map(([name, value]) => ({ name, value })),
      ...(otherCount > 0 ? [{ name: 'Other', value: otherCount }] : [])
    ];

    const trendData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      const count = filteredData.filter(s => {
        if (!s.dateOfRecording) return false;
        const saleDate = s.dateOfRecording.toDate ? s.dateOfRecording.toDate() : new Date(s.dateOfRecording);
        return saleDate >= date && saleDate <= endOfDay && !isNaN(saleDate.getTime());
      }).length;
      trendData.push({
        name: dayjs(date).format('MMM D'),
        sales: count
      });
    }

    return { typeData, trendData };
  };

  const { typeData, trendData } = prepareChartData();

  const COLORS = ['#117960', '#129777', '#00C49F', '#0088FE', '#FF8042', '#FFBB28'];


  const handleMenuClick = ({ key }) => {
    if (key === 'logout') {
      const auth = getAuth();
      signOut(auth)
        .then(() => {
          navigate('/login');
        })
        .catch(error => console.error('Logout error:', error));
    } else {
      navigate(key);
    }
  };

  const columns = [
    {
      title: 'Agreement Number',
      dataIndex: 'agreementNumber',
      key: 'agreementNumber',
      render: number => number || 'N/A'
    },
    {
      title: 'Sales Amount (ETB)',
      dataIndex: 'salesAmount',
      key: 'salesAmount',
      render: amount => amount ? `${parseFloat(amount).toLocaleString()}` : 'N/A',
      sorter: (a, b) => parseFloat(a.salesAmount || 0) - parseFloat(b.salesAmount || 0)
    },
    {
      title: 'Sales Agent',
      key: 'salesAgent',
      render: (_, record) => {
        if (record.salesAgent === 'Digital Department' || record.salesAgent === 'Freelance') {
          return record.salesAgent;
        }
        const agent = agents.find(a => a.id === record.salesAgent);
        return agent ? agent.name : <Tag color="red">Unassigned</Tag>;
      }
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: type => type || 'N/A'
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <div className="flex space-x-2">
          <Button
            icon={<FaEye />}
            size="small"
            onClick={() => handleView(record)}
          />
          <Popconfirm
            title="Are you sure you want to edit this sale?"
            onConfirm={() => handleEdit(record)}
            okText="Yes"
            cancelText="No"
          >
            <Button
              icon={<FaEdit />}
              size="small"
            />
          </Popconfirm>
          <Popconfirm
            title="Are you sure you want to delete this sale?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button
              icon={<FaTrash />}
              size="small"
              danger
            />
          </Popconfirm>
        </div>
      )
    }
  ];

  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spin size="large" tip="Checking authentication..." />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spin size="large" tip="Loading Sales Dashboard..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-red-600 text-center">
          <p>Error: {error}</p>
          <Button type="primary" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
   

      <Layout>
        <Layout.Content className="p-4 md:p-6 bg-gray-50">
          <div className="mb-4 md:mb-6">
            <Row gutter={[16, 16]} className="mb-2 md:mb-4">
              <Col xs={24}>
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-gray-800">Sales Dashboard</h1>
                 
                </div>
              </Col>
            </Row>
          </div>

          <Row gutter={[8, 8]} className="mb-4 md:mb-6">
            {[
              { title: 'Total Sales', value: totalSales, icon: <UserOutlined />, color: '#117960' },
              { title: 'Filtered Sales', value: filteredSales, icon: <UserOutlined />, color: '#0e684e' },
              { title: 'Total Amount (ETB)', value: totalAmount, icon: <UserOutlined />, color: '#129777' },
              { title: 'Last Updated', value: lastUpdated, icon: <SafetyOutlined />, color: '#00C49F' }
            ].map((metric, index) => (
              <Col xs={24} sm={12} md={6} key={index}>
                <MetricCard
                  title={metric.title}
                  value={metric.value}
                  icon={metric.icon}
                  color={metric.color}
                />
              </Col>
            ))}
          </Row>

          <Row gutter={[8, 8]} className="mb-4 md:mb-6">
            {[
              { title: 'Type Distribution', data: typeData, type: 'pie' },
              { title: 'Sales Trends (Last 7 Days)', data: trendData, type: 'bar' }
            ].map((chart, index) => (
              <Col xs={24} md={12} key={index}>
                <ChartCard title={chart.title}>
                  <ResponsiveContainer width="100%" height={350}>
                    {chart.type === 'pie' ? (
                      <PieChart>
                        <Pie
                          data={chart.data}
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          dataKey="value"
                          isAnimationActive={true}
                        >
                          {chart.data.map((entry, i) => (
                            <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value, name) => [`${value} sales`, name]} />
                        <Legend layout="vertical" align="right" verticalAlign="middle" />
                      </PieChart>
                    ) : (
                      <BarChart data={chart.data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="sales" fill="#117960" name="Sales" />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </ChartCard>
              </Col>
            ))}
          </Row>

          <Card
            title="Sales Management"
            className="shadow-sm"
            extra={<span className="text-gray-500 text-sm md:text-base">{filteredData.length} sales found</span>}
            bodyStyle={{ padding: window.innerWidth < 768 ? '8px' : '16px' }}
          >
            <div className="bg-white p-4 rounded-lg mb-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-[#117960]">
                  <FaFilter className="inline mr-2" />
                  Filters
                </h2>
                <div className="flex space-x-2">
                  <Button
                    type="primary"
                    onClick={exportToExcel}
                    icon={<FaFileExcel />}
                    size={window.innerWidth < 768 ? 'small' : 'middle'}
                  >
                    Export
                  </Button>
                  <Button
                    onClick={handleClearFilters}
                    size={window.innerWidth < 768 ? 'small' : 'middle'}
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block mb-2 text-sm font-medium">Team</label>
                  <Select
                    options={teamOptions}
                    value={teamOptions.find(opt => opt.value === filters.team)}
                    onChange={opt => handleFilterChange('team', opt?.value || '')}
                    placeholder="Select team"
                    isClearable
                  />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium">Agent</label>
                  <Select
                    options={agentOptions}
                    value={agentOptions.find(opt => opt.value === filters.agent)}
                    onChange={opt => handleFilterChange('agent', opt?.value || '')}
                    placeholder="Select agent"
                    isClearable
                  />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium">Type</label>
                  <Select
                    options={typeOptions}
                    value={typeOptions.find(opt => opt.value === filters.type)}
                    onChange={opt => handleFilterChange('type', opt?.value || '')}
                    placeholder="Select type"
                    isClearable
                  />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium">Date Range</label>
                  <RangePicker
                    className="w-full"
                    value={filters.dateRange}
                    onChange={dates => handleFilterChange('dateRange', dates)}
                    size={window.innerWidth < 768 ? 'small' : 'middle'}
                  />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium">Phone Number</label>
                  <Input
                    placeholder="Search phone"
                    value={filters.phoneNumber}
                    onChange={e => handleFilterChange('phoneNumber', e.target.value)}
                    size={window.innerWidth < 768 ? 'small' : 'middle'}
                  />
                </div>
                <div className="flex items-end">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="unassigned"
                      checked={filters.unassigned}
                      onChange={e => handleFilterChange('unassigned', e.target.checked)}
                      className="mr-2"
                    />
                    <label htmlFor="unassigned" className="text-sm font-medium">
                      Show Unassigned Only
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table
                columns={columns}
                dataSource={filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize)}
                rowKey="id"
                pagination={false}
                scroll={{ x: true }}
              />
            </div>
            <div className="mt-3 md:mt-4 flex justify-center">
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={filteredData.length}
                onChange={setCurrentPage}
                showSizeChanger={false}
                size={window.innerWidth < 768 ? 'small' : 'default'}
              />
            </div>
          </Card>

          {/* View Modal */}
          <Modal
            title="View Sale"
            open={isViewing}
            onCancel={() => setIsViewing(false)}
            footer={null}
            centered
            width={window.innerWidth < 768 ? '90%' : 520}
          >
            {selectedSale && (
              <div className="p-3 md:p-4">
                <div className="space-y-3">
                  <div>
                    <p className="text-gray-500 text-sm">Agreement Number</p>
                    <p className="text-gray-800">{selectedSale.agreementNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Sales Amount (ETB)</p>
                    <p className="text-gray-800">{selectedSale.salesAmount ? `${parseFloat(selectedSale.salesAmount).toLocaleString()}` : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Sales Agent</p>
                    <p className="text-gray-800">
                      {selectedSale.salesAgent === 'Digital Department' || selectedSale.salesAgent === 'Freelance'
                        ? selectedSale.salesAgent
                        : agents.find(a => a.id === selectedSale.salesAgent)?.name || 'Unassigned'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Type</p>
                    <p className="text-gray-800">{selectedSale.type || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Site</p>
                    <p className="text-gray-800">{selectedSale.site || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Area (SQM)</p>
                    <p className="text-gray-800">{selectedSale.areaInSQM || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Location</p>
                    <p className="text-gray-800">{selectedSale.area || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">House Number</p>
                    <p className="text-gray-800">{selectedSale.houseNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Date</p>
                    <p className="text-gray-800">
                      {selectedSale.dateOfRecording ? dayjs(selectedSale.dateOfRecording).format('MMM D, YYYY h:mm A') : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Sold To</p>
                    <p className="text-gray-800">
                      {selectedSale.soldTo === 'Others'
                        ? `${selectedSale.prospectName || 'N/A'} - ${selectedSale.prospectPhoneNumber || 'N/A'}`
                        : prospects.find(p => p.id === selectedSale.soldTo)
                          ? `${prospects.find(p => p.id === selectedSale.soldTo).Name || 'N/A'} - ${prospects.find(p => p.id === selectedSale.soldTo)['Phone number'] || 'N/A'}`
                          : 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Remark</p>
                    <p className="text-gray-800">{selectedSale.remark || 'N/A'}</p>
                  </div>
                </div>
              </div>
            )}
          </Modal>

          {/* Edit Modal */}
          <Modal
            title="Edit Sale"
            open={isEditing}
            onCancel={() => setIsEditing(false)}
            footer={null}
            centered
            width={window.innerWidth < 768 ? '90%' : '80%'}
          >
            {selectedSale && (
              <div className="space-y-6 relative">
                {animationStatus === 'success' && (
                  <div className="absolute top-0 right-0 w-full h-full flex justify-center items-center bg-white opacity-50 z-10">
                    <DotLottieReact
                      src="https://lottie.host/146d0edc-bd40-4c5c-932d-55fb0bca823b/dk7cZaCXah.lottie"
                      loop
                      autoplay
                      style={{ width: 100, height: 100 }}
                    />
                  </div>
                )}
                {animationStatus === 'error' && (
                  <div className="absolute top-0 right-0 w-full h-full flex justify-center items-center bg-white opacity-80 z-10">
                    <p className="text-red-500 text-center">Error submitting the form. Please try again.</p>
                  </div>
                )}
                <Form
                  form={form}
                  layout="vertical"
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Form.Item
                      name="salesAmount"
                      label="Property Cost (ETB)"
                      rules={[{ required: true, message: 'Please input property cost!' }]}
                    >
                      <Input type="number" />
                    </Form.Item>
                    <Form.Item
                      name="houseNumber"
                      label="House Number"
                      rules={[{ required: true, message: 'Please input house number!' }]}
                    >
                      <Input />
                    </Form.Item>
                    <Form.Item
                      name="agreementNumber"
                      label="Agreement Number"
                      rules={[{ required: true, message: 'Please input agreement number!' }]}
                    >
                      <Input />
                    </Form.Item>
                    <Form.Item
                      name="dateOfRecording"
                      label="Date of Sale"
                      rules={[{ required: true, message: 'Please select date of sale!' }]}
                    >
                      <DatePicker className="w-full" />
                    </Form.Item>
                  </div>

                  <div className="bg-gray-50 p-6 rounded-xl">
                    <h3 className="text-xl font-semibold mb-4 text-gray-800">Property Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Form.Item
                        name="salesAgent"
                        label="Sales Agent"
                        rules={[{ required: true, message: 'Please select sales agent!' }]}
                      >
                        <AntSelect>
                          <Option value="Digital Department">Digital Department</Option>
                          <Option value="Freelance">Freelance</Option>
                          {agents.map(agent => (
                            <Option key={agent.id} value={agent.id}>{agent.name}</Option>
                          ))}
                        </AntSelect>
                      </Form.Item>
                      <Form.Item
                        name="type"
                        label="Property Type"
                        rules={[{ required: true, message: 'Please select property type!' }]}
                      >
                        <AntSelect>
                          {typeOptions.filter(opt => opt.value).map(opt => (
                            <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                          ))}
                        </AntSelect>
                      </Form.Item>
                      <Form.Item
                        name="areaInSQM"
                        label="Area (SQM)"
                        rules={[{ required: true, message: 'Please input area!' }]}
                      >
                        <Input type="number" />
                      </Form.Item>
                      <Form.Item
                        name="area"
                        label="Location"
                        rules={[{ required: true, message: 'Please input location!' }]}
                      >
                        <Input />
                      </Form.Item>
                      <Form.Item
                        name="site"
                        label="Site"
                      >
                        <AntSelect>
                          {siteOptions.filter(opt => opt.value).map(opt => (
                            <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                          ))}
                          <Option value="Other">Other</Option>
                        </AntSelect>
                      </Form.Item>
                      {form.getFieldValue('site') === "Other" && (
                        <Form.Item
                          name="otherSite"
                          label="Other Site"
                          rules={[{ required: true, message: 'Please specify other site!' }]}
                        >
                          <Input placeholder="Please specify other site" />
                        </Form.Item>
                      )}
                      <Form.Item
                        name="remark"
                        label="Remark"
                      >
                        <Input />
                      </Form.Item>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-6 rounded-xl">
                    <h3 className="text-xl font-semibold mb-4 text-gray-800">Client Information</h3>
                    <div>
                      <Input
                        placeholder="Search by phone number or name"
                        onChange={(e) => setProspectSearchTerm(e.target.value)}
                        className="w-full mb-4"
                      />
                      <Form.Item
                        name="soldTo"
                        label="Client"
                        rules={[{ required: true, message: 'Please select client!' }]}
                      >
                        <AntSelect
                          showSearch
                          optionFilterProp="children"
                          filterOption={(input, option) =>
                            option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                          }
                        >
                          <Option value="Others">Others (Manual Entry)</Option>
                          {prospectOptions.map(option => (
                            <Option key={option.value} value={option.value}>
                              {option.label}
                            </Option>
                          ))}
                        </AntSelect>
                      </Form.Item>
                      {form.getFieldValue('soldTo') === "Others" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                          <Form.Item
                            name="prospectName"
                            label="Client Name"
                            rules={[{ required: true, message: 'Please input client name!' }]}
                          >
                            <Input />
                          </Form.Item>
                          <Form.Item
                            name="prospectPhoneNumber"
                            label="Client Phone"
                            rules={[{ required: true, message: 'Please input client phone!' }]}
                          >
                            <Input />
                          </Form.Item>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <button
                      onClick={handleUpdate}
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
                          Updating...
                        </>
                      ) : (
                        'Update Sale'
                      )}
                    </button>
                  </div>
                </Form>
              </div>
            )}
          </Modal>
        </Layout.Content>
      </Layout>
    </Layout>
  );
};

const MetricCard = ({ title, value, icon, color }) => {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center">
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
};

const ChartCard = ({ title, children }) => {
  return (
    <Card
      title={title}
      className="shadow-sm h-full"
      headStyle={{ borderBottom: '1px solid #f0f0f0' }}
    >
      {children}
    </Card>
  );
};

export default AdminSalesDashboard;