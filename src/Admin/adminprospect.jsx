import React, { useState, useEffect, useMemo } from 'react';
import { Layout, Menu, Button, Card, Row, Col, Modal, Input, Select as AntSelect, DatePicker, message, Table, Tag, Spin, Pagination, Popconfirm } from 'antd';
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
import { FaFileExcel, FaEdit, FaTrash, FaFilter, FaEye } from 'react-icons/fa';
import Select from 'react-select';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

const { RangePicker } = DatePicker;
const { Option } = AntSelect;

const AdminProspectDashboard = () => {
  const [prospects, setProspects] = useState([]);
  const [teams, setTeams] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState(null);
  const [animationStatus, setAnimationStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [filters, setFilters] = useState({
    team: '',
    agent: '',
    phoneNumber: '',
    name: '',
    dateRange: null,
    site: '',
    status: '',
    method: '',
    unassigned: false
  });
  const [filteredData, setFilteredData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [collapsed, setCollapsed] = useState(false);
  const pageSize = 10;
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log('Auth state changed:', currentUser ? 'User logged in' : 'No user');
      setAuthLoading(false);
      if (currentUser) {
        try {
          setLoading(true);
          setError(null);

          // Fetch prospects
          const prospectSnapshot = await getDocs(collection(db, 'Prospect'));
          const prospectData = prospectSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            Date: doc.data().Date?.toDate?.() || doc.data().Date,
            Site: Array.isArray(doc.data().Site) ? doc.data().Site : [doc.data().Site].filter(Boolean)
          }));
          setProspects(prospectData);

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
          setError('Failed to load prospect data');
        } finally {
          setLoading(false);
        }
      } else {
        console.log('Redirecting to adminlogin');
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

  const filteredDataMemo = useMemo(() => {
    let data = [...prospects];

    if (filters.team) {
      const supervisor = teams.find(t => t.id === filters.team);
      if (supervisor) {
        data = data.filter(p => {
          const isSupervisorProspect = p.user === supervisor.userId;
          const agent = agents.find(a => a.userId === p.user);
          const isAgentProspect = agent && agent.supervisor === supervisor.id;
          return isSupervisorProspect || isAgentProspect;
        });
      }
    }

    if (filters.agent) {
      data = data.filter(p => p.user === filters.agent);
    }

    if (filters.phoneNumber) {
      data = data.filter(p =>
        p['Phone number']?.toLowerCase().includes(filters.phoneNumber.toLowerCase())
      );
    }

    if (filters.name) {
      data = data.filter(p =>
        p.Name?.toLowerCase().includes(filters.name.toLowerCase())
      );
    }

    if (filters.dateRange && filters.dateRange.length === 2) {
      const [start, end] = filters.dateRange;
      data = data.filter(p => {
        const prospectDate = p.Date;
        if (!prospectDate) return false;
        const date = prospectDate.toDate ? prospectDate.toDate() : new Date(prospectDate);
        return date >= start.startOf('day').toDate() && date <= end.endOf('day').toDate();
      });
    }

    if (filters.site) {
      data = data.filter(p => p.Site.includes(filters.site));
    }

    if (filters.status) {
      data = data.filter(p => p.Status === filters.status);
    }

    if (filters.method) {
      data = data.filter(p => p.Method === filters.method);
    }

    if (filters.unassigned) {
      data = data.filter(p => !p.user || !agents.some(t => t.userId === p.user));
    }

    return data;
  }, [prospects, filters, teams, agents]);

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
    ...agents.map(agent => ({
      value: agent.userId,
      label: agent.name
    }))
  ], [agents]);

  const siteOptions = useMemo(() => {
    const sites = [...new Set(prospects.flatMap(p => p.Site))].filter(Boolean);
    return [
      { value: '', label: 'All Sites' },
      ...sites.map(site => ({ value: site, label: site }))
    ];
  }, [prospects]);



  const methodOptions = useMemo(() => {
    const methods = [...new Set(prospects.map(p => p.Method).filter(Boolean))];
    return [
      { value: '', label: 'All Methods' },
      ...methods.map(method => ({ value: method, label: method }))
    ];
  }, [prospects]);

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      team: '',
      agent: '',
      phoneNumber: '',
      name: '',
      dateRange: null,
      site: '',
      method: '',
      unassigned: false
    });
  };

  const handleEdit = (prospect) => {
    setSelectedProspect({
      ...prospect,
      otherInterest: prospect.Interest && !['Apartment', 'Shop'].includes(prospect.Interest) ? prospect.Interest : '',
      otherSite: prospect.Site.length && !['Yebe Real Estate', 'Addis Empire Real Estate', 'Sunshine Real Estate'].includes(prospect.Site[0]) ? prospect.Site.join(', ') : '',
      otherComment: prospect.Comment && ![
        'I will call you again',
        'Let me discuss with my spouse',
        'Send me more details',
        'Can I visit again?',
        'Can we negotiate the price?',
        'I need more time to decide',
        'I found another property',
        'I am no longer looking'
      ].includes(prospect.Comment) ? prospect.Comment : '',
      otherMethod: prospect.Method && !['Telemarketing', 'Survey', 'Social Media', 'Email', 'Referral', 'Event', 'Walk-in'].includes(prospect.Method) ? prospect.Method : ''
    });
    setIsEditing(true);
    setAnimationStatus(null);
    setPhoneError('');
    setIsCheckingPhone(false);
  };

  const handleView = (prospect) => {
    setSelectedProspect(prospect);
    setIsViewing(true);
  };

  const handleDelete = async (id) => {
    if (!id) {
      console.error('Invalid prospect ID:', id);
      message.error('Invalid prospect ID');
      return;
    }
    try {
      console.log('Deleting prospect with ID:', id);
      await deleteDoc(doc(db, 'Prospect', id));
      setProspects(prev => {
        const updated = prev.filter(p => p.id !== id);
        console.log('Updated prospects count:', updated.length);
        return updated;
      });
      message.success('Prospect deleted successfully');
    } catch (error) {
      console.error('Error deleting prospect:', error);
      message.error(`Failed to delete prospect: ${error.message}`);
    }
  };

  const handlePhoneChange = (e) => {
    const value = e.target.value;
    setSelectedProspect(prev => ({ ...prev, 'Phone number': value }));
    setIsCheckingPhone(true);
    const phoneRegex = /^\+?\d{9,13}$/;
    if (!phoneRegex.test(value)) {
      setPhoneError('Please enter a valid phone number (e.g., +251912345678 or 0912345678)');
    } else {
      setPhoneError('');
    }
    setTimeout(() => setIsCheckingPhone(false), 500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (phoneError || isCheckingPhone) return;

    setIsSubmitting(true);
    setAnimationStatus(null);

    try {
      const { id, otherInterest, otherSite, otherComment, otherMethod, ...updatedData } = selectedProspect;
      const updatePayload = {
        ...updatedData,
        Interest: selectedProspect.Interest === 'Other' ? otherInterest : selectedProspect.Interest,
        Site: selectedProspect.Site[0] === 'Other' ? otherSite.split(',').map(s => s.trim()).filter(Boolean) : selectedProspect.Site,
        Comment: selectedProspect.Comment === 'Other' ? otherComment : selectedProspect.Comment,
        Method: selectedProspect.Method === 'Other' ? otherMethod : selectedProspect.Method,
        'Phone number_normalized': selectedProspect['Phone number'].replace(/\D/g, '')
      };

      console.log('Updating prospect with ID:', id, 'Payload:', updatePayload);
      await updateDoc(doc(db, 'Prospect', id), updatePayload);
      setProspects(prev =>
        prev.map(p => p.id === id ? { id, ...updatePayload } : p)
      );
      setAnimationStatus('success');
      message.success('Prospect updated successfully');
      setTimeout(() => {
        setIsEditing(false);
        setAnimationStatus(null);
      }, 1500);
    } catch (error) {
      console.error('Error updating prospect:', error);
      setAnimationStatus('error');
      message.error(`Failed to update prospect: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      filteredData.map(prospect => {
        const agent = agents.find(a => a.userId === prospect.user);
        return {
          Name: prospect.Name,
          'Phone Number': prospect['Phone number'],
          Date: prospect.Date?.toDate?.().toLocaleString() || prospect.Date?.toLocaleString(),
          'Assigned Agent': agent?.name || 'Unassigned',
          Site: prospect.Site.join(', '),
          Status: prospect.Status || prospect.Comment,
          Method: prospect.Method,
          Interest: prospect.Interest,
          Comment: prospect.Comment,
          Remark: prospect.remark
        };
      })
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Prospects');
    const dateStr = new Date().toISOString().slice(0, 10);
    const filterNames = Object.entries(filters)
      .filter(([key, value]) => value && key !== 'dateRange')
      .map(([key, value]) => `${key}-${value}`)
      .join('_');

    const dateRangeStr = filters.dateRange
      ? `DateRange-${filters.dateRange[0].format('YYYY-MM-DD')}_to_${filters.dateRange[1].format('YYYY-MM-DD')}`
      : '';

    const fileName = `Prospects_${filterNames}${dateRangeStr ? `_${dateRangeStr}` : ''}_${dateStr}.xlsx`;

    XLSX.writeFile(workbook, fileName);
  };

  const calculateMetrics = () => {
    return {
      totalProspects: prospects.length,
      filteredProspects: filteredData.length,
      unassignedProspects: prospects.filter(p => !p.user || !agents.some(t => t.userId === p.user)).length,
      lastUpdated: new Date().toLocaleDateString()
    };
  };

  const { totalProspects, filteredProspects, unassignedProspects, lastUpdated } = calculateMetrics();

  const prepareChartData = () => {
    // Aggregate method counts
    const methodCounts = {};
    filteredData.forEach(p => {
      const method = p.Method || 'Unknown';
      methodCounts[method] = (methodCounts[method] || 0) + 1;
    });

    // Sort methods by count, take top 5, group others
    const sortedMethods = Object.entries(methodCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const otherCount = Object.values(methodCounts)
      .slice(5)
      .reduce((sum, count) => sum + count, 0);

    const methodData = [
      ...sortedMethods.map(([name, value]) => ({ name, value })),
      ...(otherCount > 0 ? [{ name: 'Other', value: otherCount }] : [])
    ];

    const trendData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      const count = filteredData.filter(p => {
        if (!p.Date) return false;
        const prospectDate = p.Date.toDate ? p.Date.toDate() : new Date(p.Date);
        return prospectDate >= date && prospectDate <= endOfDay && !isNaN(prospectDate.getTime());
      }).length;
      trendData.push({
        name: dayjs(date).format('MMM D'),
        prospects: count
      });
    }

    return { methodData, trendData };
  };

  const { methodData, trendData } = prepareChartData();

  const COLORS = ['#117960', '#129777', '#00C49F', '#0088FE', '#FF8042', '#FFBB28'];


 

  const columns = [
    {
      title: 'Name',
      dataIndex: 'Name',
      key: 'Name',
      sorter: (a, b) => a.Name.localeCompare(b.Name)
    },
    {
      title: 'Phone',
      dataIndex: 'Phone number',
      key: 'Phone',
      render: phone => phone || 'N/A'
    },
    {
      title: 'Date',
      dataIndex: 'Date',
      key: 'Date',
      render: date => {
        if (!date) return 'N/A';
        const d = date.toDate ? date.toDate() : new Date(date);
        return dayjs(d).format('MMM D, YYYY h:mm A');
      },
      sorter: (a, b) => {
        const dateA = a.Date?.toDate?.() || a.Date;
        const dateB = b.Date?.toDate?.() || b.Date;
        return new Date(dateA) - new Date(dateB);
      }
    },
    {
      title: 'Assigned Agent',
      key: 'Agent',
      render: (_, record) => {
        const agent = agents.find(a => a.userId === record.user);
        return agent ? agent.name : <Tag color="red">Unassigned</Tag>;
      }
    },
    {
      title: 'Site',
      dataIndex: 'Site',
      key: 'Site',
      render: site => (Array.isArray(site) ? site.join(', ') : site) || 'N/A'
    },
    {
      title: 'Method',
      dataIndex: 'Method',
      key: 'Method',
      render: method => method || 'N/A'
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
            title="Are you sure you want to edit this prospect?"
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
            title="Are you sure you want to delete this prospect?"
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
        <Spin size="large" tip="Loading Prospect Dashboard..." />
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
                  <h1 className="text-xl md:text-2xl font-bold text-gray-800">Prospect Dashboard</h1>
                 
                </div>
              </Col>
            </Row>
          </div>

          <Row gutter={[8, 8]} className="mb-4 md:mb-6">
            {[
              { title: 'Total Prospects', value: totalProspects, icon: <UserOutlined />, color: '#117960' },
              { title: 'Filtered Prospects', value: filteredProspects, icon: <UserOutlined />, color: '#0e684e' },
              { title: 'Unassigned Prospects', value: unassignedProspects, icon: <UserOutlined />, color: '#129777' },
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
              { title: 'Method Distribution', data: methodData, type: 'pie' },
              { title: 'Prospect Trends (Last 7 Days)', data: trendData, type: 'bar' }
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
                        <Tooltip formatter={(value, name) => [`${value} prospects`, name]} />
                        <Legend layout="vertical" align="right" verticalAlign="middle" />
                      </PieChart>
                    ) : (
                      <BarChart data={chart.data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="prospects" fill="#117960" name="Prospects" />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </ChartCard>
              </Col>
            ))}
          </Row>

          <Card
            title="Prospect Management"
            className="shadow-sm"
            extra={<span className="text-gray-500 text-sm md:text-base">{filteredData.length} prospects found</span>}
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
                  <label className="block mb-2 text-sm font-medium">Name</label>
                  <Input
                    placeholder="Search by name"
                    value={filters.name}
                    onChange={e => handleFilterChange('name', e.target.value)}
                    size={window.innerWidth < 768 ? 'small' : 'middle'}
                  />
                </div>
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
                  <label className="block mb-2 text-sm font-medium">Site</label>
                  <Select
                    options={siteOptions}
                    value={siteOptions.find(opt => opt.value === filters.site)}
                    onChange={opt => handleFilterChange('site', opt?.value || '')}
                    placeholder="Select site"
                    isClearable
                  />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium">Method</label>
                  <Select
                    options={methodOptions}
                    value={methodOptions.find(opt => opt.value === filters.method)}
                    onChange={opt => handleFilterChange('method', opt?.value || '')}
                    placeholder="Select method"
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

          <Modal
            title="View Prospect"
            open={isViewing}
            onCancel={() => setIsViewing(false)}
            footer={null}
            centered
            width={window.innerWidth < 768 ? '90%' : 520}
          >
            {selectedProspect && (
              <div className="p-3 md:p-4">
                <div className="space-y-3">
                  <div>
                    <p className="text-gray-500 text-sm">Name</p>
                    <p className="text-gray-800">{selectedProspect.Name}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Phone Number</p>
                    <p className="text-gray-800">{selectedProspect['Phone number'] || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Date</p>
                    <p className="text-gray-800">
                      {selectedProspect.Date ? dayjs(selectedProspect.Date).format('MMM D, YYYY h:mm A') : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Assigned Agent</p>
                    <p className="text-gray-800">
                      {agents.find(a => a.userId === selectedProspect.user)?.name || 'Unassigned'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Site</p>
                    <p className="text-gray-800">
                      {(Array.isArray(selectedProspect.Site) ? selectedProspect.Site.join(', ') : selectedProspect.Site) || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Status</p>
                    <p className="text-gray-800">{selectedProspect.Status || selectedProspect.Comment || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Method</p>
                    <p className="text-gray-800">{selectedProspect.Method || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Interest</p>
                    <p className="text-gray-800">{selectedProspect.Interest || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Comment</p>
                    <p className="text-gray-800">{selectedProspect.Comment || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Remark</p>
                    <p className="text-gray-800">{selectedProspect.remark || 'N/A'}</p>
                  </div>
                </div>
              </div>
            )}
          </Modal>

          <Modal
            title="Edit Prospect"
            open={isEditing}
            onCancel={() => setIsEditing(false)}
            footer={null}
            centered
            width={window.innerWidth < 768 ? '90%' : 600}
          >
            {selectedProspect && (
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
                <div>
                  <input
                    id="name"
                    type="text"
                    value={selectedProspect.Name}
                    onChange={e => setSelectedProspect({ ...selectedProspect, Name: e.target.value })}
                    required
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                    placeholder="Enter name"
                  />
                </div>
                <div>
                  <input
                    id="phoneNumber"
                    type="tel"
                    value={selectedProspect['Phone number']}
                    onChange={handlePhoneChange}
                    required
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                    placeholder="Enter phone number (e.g., +251912345678 or 0912345678)"
                  />
                  {phoneError && (
                    <p className="mt-2 text-sm text-red-600">{phoneError}</p>
                  )}
                  {isCheckingPhone && (
                    <p className="mt-2 text-sm text-gray-600">Checking phone number...</p>
                  )}
                </div>
                <div>
                  <input
                    id="date"
                    type="datetime-local"
                    value={selectedProspect.Date ? dayjs(selectedProspect.Date).format('YYYY-MM-DDTHH:mm') : ''}
                    onChange={e => setSelectedProspect({
                      ...selectedProspect,
                      Date: e.target.value ? new Date(e.target.value) : null
                    })}
                    required
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  />
                </div>
                <div>
                  <select
                    id="user"
                    value={selectedProspect.user || ''}
                    onChange={e => setSelectedProspect({ ...selectedProspect, user: e.target.value })}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  >
                    <option value="">Unassigned</option>
                    {agents.map(agent => (
                      <option key={agent.userId} value={agent.userId}>{agent.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <select
                    id="site"
                    value={selectedProspect.Site[0] || ''}
                    onChange={e => setSelectedProspect({
                      ...selectedProspect,
                      Site: [e.target.value]
                    })}
                    required
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  >
                    <option value="" disabled>Select Site</option>
                    <option value="Yebe Real Estate">Yebe Real Estate</option>
                    <option value="Addis Empire Real Estate">Addis Empire Real Estate</option>
                    <option value="Sunshine Real Estate">Sunshine Real Estate</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                {selectedProspect.Site[0] === 'Other' && (
                  <div>
                    <input
                      id="otherSite"
                      type="text"
                      value={selectedProspect.otherSite}
                      onChange={e => setSelectedProspect({ ...selectedProspect, otherSite: e.target.value })}
                      required
                      className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                      placeholder="Please specify other site"
                    />
                  </div>
                )}
                <div>
                  <select
                    id="status"
                    value={selectedProspect.Status || selectedProspect.Comment}
                    onChange={e => setSelectedProspect({ ...selectedProspect, Status: e.target.value })}
                    required
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  >
                    <option value="" disabled>Select Client Response</option>
                    <option value="I will call you again">I will call you again</option>
                    <option value="Let me discuss with my spouse">Let me discuss with my spouse</option>
                    <option value="Send me more details">Send me more details</option>
                    <option value="Can I visit again?">Can I visit again?</option>
                    <option value="Can we negotiate the price?">Can we negotiate the price?</option>
                    <option value="I need more time to decide">I need more time to decide</option>
                    <option value="I found another property">I found another property</option>
                    <option value="I am no longer looking">I am no longer looking</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                {selectedProspect.Status === 'Other' && (
                  <div>
                    <input
                      id="otherComment"
                      type="text"
                      value={selectedProspect.otherComment}
                      onChange={e => setSelectedProspect({ ...selectedProspect, otherComment: e.target.value })}
                      required
                      className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                      placeholder="Please specify other response"
                    />
                  </div>
                )}
                <div>
                  <select
                    id="method"
                    value={selectedProspect.Method}
                    onChange={e => setSelectedProspect({ ...selectedProspect, Method: e.target.value })}
                    required
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  >
                    <option value="" disabled>Select Method of Contact</option>
                    <option value="Telemarketing">Telemarketing</option>
                    <option value="Survey">Survey</option>
                    <option value="Social Media">Social Media</option>
                    <option value="Email">Email</option>
                    <option value="Referral">Referral</option>
                    <option value="Event">Event</option>
                    <option value="Walk-in">Walk-in</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                {selectedProspect.Method === 'Other' && (
                  <div>
                    <input
                      id="otherMethod"
                      type="text"
                      value={selectedProspect.otherMethod}
                      onChange={e => setSelectedProspect({ ...selectedProspect, otherMethod: e.target.value })}
                      required
                      className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                      placeholder="Please specify other method"
                    />
                  </div>
                )}
                <div>
                  <select
                    id="interest"
                    value={selectedProspect.Interest}
                    onChange={e => setSelectedProspect({ ...selectedProspect, Interest: e.target.value })}
                    required
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  >
                    <option value="" disabled>Select Interested Property</option>
                    <option value="Apartment">Apartment</option>
                    <option value="Shop">Shop</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                {selectedProspect.Interest === 'Other' && (
                  <div>
                    <input
                      id="otherInterest"
                      type="text"
                      value={selectedProspect.otherInterest}
                      onChange={e => setSelectedProspect({ ...selectedProspect, otherInterest: e.target.value })}
                      required
                      className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                      placeholder="Please specify other interest"
                    />
                  </div>
                )}
                <div>
                  <input
                    id="remark"
                    type="text"
                    value={selectedProspect.remark}
                    onChange={e => setSelectedProspect({ ...selectedProspect, remark: e.target.value })}
                    required
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                    placeholder="Enter remark"
                  />
                </div>
                <div>
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || isCheckingPhone || phoneError}
                    className="group relative w-1/2 flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white hover:bg-[#129777] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 bg-[#117960] disabled:opacity-50"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Prospect Information'}
                  </button>
                </div>
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

export default AdminProspectDashboard;