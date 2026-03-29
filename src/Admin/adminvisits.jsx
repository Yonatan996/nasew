import React, { useState, useEffect, useMemo } from 'react';
import { Layout, Menu, Button, Card, Row, Col, Modal, Input, Select as AntSelect, DatePicker, message, Table, Tag, Spin, Pagination, Popconfirm, Form } from 'antd';
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

const { RangePicker } = DatePicker;
const { Option } = AntSelect;

const AdminVisitsDashboard = () => {
  const [visits, setVisits] = useState([]);
  const [prospects, setProspects] = useState([]);
  const [teams, setTeams] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isViewing, setIsViewing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [form] = Form.useForm();
  const [filters, setFilters] = useState({
    team: '',
    agent: '',
    phoneNumber: '',
    name: '',
    dateRange: null,
    site: '',
    visitType: '',
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
      setAuthLoading(false);
      if (currentUser) {
        try {
          setLoading(true);
          setError(null);

          // Fetch visits
          const visitsSnapshot = await getDocs(collection(db, 'visits'));
          const visitsData = visitsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            visitDate: doc.data().visitDate?.toDate?.() || doc.data().visitDate
          }));
          setVisits(visitsData);

          // Fetch prospects
          const prospectSnapshot = await getDocs(collection(db, 'Prospect'));
          const prospectData = prospectSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
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
          setError('Failed to load visits data');
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

  const filteredDataMemo = useMemo(() => {
    let data = [...visits];

    if (filters.team) {
      const supervisor = teams.find(t => t.id === filters.team);
      if (supervisor) {
        data = data.filter(v => {
          const isSupervisorVisit = v.salesAgent === supervisor.id;
          const agent = agents.find(a => a.id === v.salesAgent);
          const isAgentVisit = agent && agent.supervisor === supervisor.id;
          return isSupervisorVisit || isAgentVisit;
        });
      }
    }

    if (filters.agent) {
      data = data.filter(v => v.salesAgent === filters.agent);
    }

    if (filters.phoneNumber) {
      data = data.filter(v => {
        const prospect = prospects.find(p => p.id === v.clientId);
        return prospect?.['Phone number']?.includes(filters.phoneNumber) || 
               v.phoneNumber?.includes(filters.phoneNumber);
      });
    }

    if (filters.name) {
      data = data.filter(v => 
        v.clientName?.toLowerCase().includes(filters.name.toLowerCase())
      );
    }

    if (filters.dateRange && filters.dateRange.length === 2) {
      const [start, end] = filters.dateRange;
      data = data.filter(v => {
        const visitDate = v.visitDate;
        if (!visitDate) return false;
        const date = visitDate.toDate ? visitDate.toDate() : new Date(visitDate);
        return date >= start.startOf('day').toDate() && date <= end.endOf('day').toDate();
      });
    }

    if (filters.site) {
      data = data.filter(v => v.site === filters.site);
    }

    if (filters.visitType) {
      if (filters.visitType === 'Office') {
        data = data.filter(v => v.officeVisit);
      } else if (filters.visitType === 'Site') {
        data = data.filter(v => v.siteVisit);
      }
    }

    if (filters.unassigned) {
      data = data.filter(v => !v.salesAgent || !agents.some(a => a.id === v.salesAgent));
    }

    return data;
  }, [visits, filters, teams, agents, prospects]);

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
      value: agent.id,
      label: agent.name
    }))
  ], [agents]);

  const siteOptions = useMemo(() => {
    const sites = [...new Set(visits.map(v => v.site).filter(Boolean))];
    return [
      { value: '', label: 'All Sites' },
      ...sites.map(site => ({ value: site, label: site }))
    ];
  }, [visits]);

  const visitTypeOptions = useMemo(() => [
    { value: '', label: 'All Types' },
    { value: 'Office', label: 'Office Visit' },
    { value: 'Site', label: 'Site Visit' }
  ], []);

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
      visitType: '',
      unassigned: false
    });
  };

  const handleView = (visit) => {
    setSelectedVisit(visit);
    setIsViewing(true);
  };

  const handleEdit = (visit) => {
    setSelectedVisit({
      ...visit,
      visitDate: visit.visitDate ? dayjs(visit.visitDate) : null
    });
    form.setFieldsValue({
      clientName: visit.clientName,
      phoneNumber: visit.phoneNumber || '',
      visitDate: visit.visitDate ? dayjs(visit.visitDate) : null,
      salesAgent: visit.salesAgent || '',
      site: visit.site || '',
      officeVisit: visit.officeVisit || false,
      siteVisit: visit.siteVisit || false,
      clientFeedback: visit.clientFeedback || '',
      remark: visit.remark || ''
    });
    setIsEditing(true);
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'visits', id));
      setVisits(prev => prev.filter(v => v.id !== id));
      message.success('Visit deleted successfully');
    } catch (error) {
      console.error('Error deleting visit:', error);
      message.error(`Failed to delete visit: ${error.message}`);
    }
  };

  const handleUpdateVisit = async () => {
    try {
      const values = await form.validateFields();
      const updatedVisit = {
        ...selectedVisit,
        ...values,
        visitDate: values.visitDate ? values.visitDate.toDate() : null
      };

      await updateDoc(doc(db, 'visits', selectedVisit.id), updatedVisit);
      setVisits(prev => prev.map(v => v.id === selectedVisit.id ? updatedVisit : v));
      message.success('Visit updated successfully');
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating visit:', error);
      message.error(`Failed to update visit: ${error.message}`);
    }
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      filteredData.map(visit => {
        const agent = agents.find(a => a.id === visit.salesAgent);
        const prospect = prospects.find(p => p.id === visit.clientId);
        return {
          'Client Name': visit.clientName,
          'Phone Number': visit.phoneNumber || prospect?.['Phone number'] || 'N/A',
          'Visit Date': visit.visitDate?.toDate?.().toLocaleString() || visit.visitDate?.toLocaleString(),
          'Sales Agent': agent?.name || 'Unassigned',
          'Site': visit.site || 'N/A',
          'Office Visit': visit.officeVisit ? 'Yes' : 'No',
          'Site Visit': visit.siteVisit ? 'Yes' : 'No',
          'Client Feedback': visit.clientFeedback || 'N/A',
          'Remark': visit.remark || 'N/A'
        };
      })
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Visits');
    const dateStr = new Date().toISOString().slice(0, 10);
    const filterNames = Object.entries(filters)
      .filter(([key, value]) => value && key !== 'dateRange')
      .map(([key, value]) => `${key}-${value}`)
      .join('_');

    const dateRangeStr = filters.dateRange
      ? `DateRange-${filters.dateRange[0].format('YYYY-MM-DD')}_to_${filters.dateRange[1].format('YYYY-MM-DD')}`
      : '';

    const fileName = `Visits_${filterNames}${dateRangeStr ? `_${dateRangeStr}` : ''}_${dateStr}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const calculateMetrics = () => {
    const officeVisits = filteredData.filter(v => v.officeVisit).length;
    const siteVisits = filteredData.filter(v => v.siteVisit).length;
    
    return {
      totalVisits: visits.length,
      filteredVisits: filteredData.length,
      officeVisits,
      siteVisits,
      lastUpdated: new Date().toLocaleDateString()
    };
  };

  const { totalVisits, filteredVisits, officeVisits, siteVisits, lastUpdated } = calculateMetrics();

  const prepareChartData = () => {
    const visitTypeData = [
      { name: 'Office Visits', value: officeVisits },
      { name: 'Site Visits', value: siteVisits }
    ];

    const trendData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      const count = filteredData.filter(v => {
        if (!v.visitDate) return false;
        const visitDate = v.visitDate.toDate ? v.visitDate.toDate() : new Date(v.visitDate);
        return visitDate >= date && visitDate <= endOfDay && !isNaN(visitDate.getTime());
      }).length;
      
      trendData.push({
        name: dayjs(date).format('MMM D'),
        visits: count
      });
    }

    return { visitTypeData, trendData };
  };

  const { visitTypeData, trendData } = prepareChartData();

  const COLORS = ['#117960', '#129777', '#00C49F', '#0088FE', '#FF8042', '#FFBB28'];

  


  const columns = [
    {
      title: 'Client Name',
      dataIndex: 'clientName',
      key: 'clientName',
      sorter: (a, b) => (a.clientName || '').localeCompare(b.clientName || '')
    },
    {
      title: 'Phone',
      key: 'Phone',
      render: (_, record) => {
        const prospect = prospects.find(p => p.id === record.clientId);
        return record.phoneNumber || prospect?.['Phone number'] || 'N/A';
      }
    },
    {
      title: 'Visit Date',
      dataIndex: 'visitDate',
      key: 'visitDate',
      render: date => {
        if (!date) return 'N/A';
        const d = date.toDate ? date.toDate() : new Date(date);
        return dayjs(d).format('MMM D, YYYY h:mm A');
      },
      sorter: (a, b) => {
        const dateA = a.visitDate?.toDate?.() || a.visitDate;
        const dateB = b.visitDate?.toDate?.() || b.visitDate;
        return new Date(dateA) - new Date(dateB);
      }
    },
    {
      title: 'Sales Agent',
      key: 'Agent',
      render: (_, record) => {
        const agent = agents.find(a => a.id === record.salesAgent);
        return agent ? agent.name : <Tag color="red">Unassigned</Tag>;
      }
    },
    {
      title: 'Site',
      dataIndex: 'site',
      key: 'site',
      render: site => site || 'N/A'
    },
    {
      title: 'Type',
      key: 'type',
      render: (_, record) => (
        <div>
          {record.officeVisit && <Tag color="green">Office</Tag>}
          {record.siteVisit && <Tag color="blue">Site</Tag>}
        </div>
      )
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
            title="Are you sure you want to edit this visit?"
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
            title="Are you sure you want to delete this visit?"
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
        <Spin size="large" tip="Loading Visits Dashboard..." />
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
                  <h1 className="text-xl md:text-2xl font-bold text-gray-800">Visits Dashboard</h1>
                 
                </div>
              </Col>
            </Row>
          </div>

          <Row gutter={[8, 8]} className="mb-4 md:mb-6">
            {[
              { title: 'Total Visits', value: totalVisits, icon: <UserOutlined />, color: '#117960' },
              { title: 'Filtered Visits', value: filteredVisits, icon: <UserOutlined />, color: '#0e684e' },
              { title: 'Office Visits', value: officeVisits, icon: <TeamOutlined />, color: '#129777' },
              { title: 'Site Visits', value: siteVisits, icon: <TeamOutlined />, color: '#00C49F' },
              { title: 'Last Updated', value: lastUpdated, icon: <SafetyOutlined />, color: '#0088FE' }
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
              { title: 'Visit Type Distribution', data: visitTypeData, type: 'pie' },
              { title: 'Visit Trends (Last 7 Days)', data: trendData, type: 'bar' }
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
                        <Tooltip formatter={(value, name) => [`${value} visits`, name]} />
                        <Legend layout="vertical" align="right" verticalAlign="middle" />
                      </PieChart>
                    ) : (
                      <BarChart data={chart.data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="visits" fill="#117960" name="Visits" />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </ChartCard>
              </Col>
            ))}
          </Row>

          <Card
            title="Visits Management"
            className="shadow-sm"
            extra={<span className="text-gray-500 text-sm md:text-base">{filteredData.length} visits found</span>}
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
                  <label className="block mb-2 text-sm font-medium">Client Name</label>
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
                    options={[
                      { value: '', label: 'All Sites' },
                      { value: 'Yebe Real Estate', label: 'Yebe Real Estate' },
                      { value: 'Addis Empire Real Estate', label: 'Addis Empire Real Estate' },
                      { value: 'Sunshine Real Estate', label: 'Sunshine Real Estate' },
                      { value: 'Other', label: 'Other' }
                    ]}
                    value={siteOptions.find(opt => opt.value === filters.site)}
                    onChange={opt => handleFilterChange('site', opt?.value || '')}
                    placeholder="Select site"
                    isClearable
                  />
                  {filters.site === 'Other' && (
                    <Input
                      placeholder="Please specify other site"
                      value={filters.otherSite || ''}
                      onChange={e => handleFilterChange('otherSite', e.target.value)}
                      className="mt-2"
                    />
                  )}
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium">Visit Type</label>
                  <Select
                    options={visitTypeOptions}
                    value={visitTypeOptions.find(opt => opt.value === filters.visitType)}
                    onChange={opt => handleFilterChange('visitType', opt?.value || '')}
                    placeholder="Select visit type"
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

          {/* View Visit Modal */}
          <Modal
            title="View Visit Details"
            open={isViewing}
            onCancel={() => setIsViewing(false)}
            footer={null}
            centered
            width={window.innerWidth < 768 ? '90%' : 520}
          >
            {selectedVisit && (
              <div className="p-3 md:p-4">
                <div className="space-y-3">
                  <div>
                    <p className="text-gray-500 text-sm">Client Name</p>
                    <p className="text-gray-800">{selectedVisit.clientName || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Phone Number</p>
                    <p className="text-gray-800">
                      {selectedVisit.phoneNumber || 
                       prospects.find(p => p.id === selectedVisit.clientId)?.['Phone number'] || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Visit Date</p>
                    <p className="text-gray-800">
                      {selectedVisit.visitDate ? 
                        dayjs(selectedVisit.visitDate).format('MMM D, YYYY h:mm A') : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Sales Agent</p>
                    <p className="text-gray-800">
                      {agents.find(a => a.id === selectedVisit.salesAgent)?.name || 'Unassigned'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Site</p>
                    <p className="text-gray-800">
                      {selectedVisit.site || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Visit Type</p>
                    <p className="text-gray-800">
                      {selectedVisit.officeVisit && 'Office Visit'}
                      {selectedVisit.siteVisit && 'Site Visit'}
                      {!selectedVisit.officeVisit && !selectedVisit.siteVisit && 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Client Feedback</p>
                    <p className="text-gray-800">{selectedVisit.clientFeedback || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Remark</p>
                    <p className="text-gray-800">{selectedVisit.remark || 'N/A'}</p>
                  </div>
                </div>
              </div>
            )}
          </Modal>

          {/* Edit Visit Modal */}
          <Modal
            title="Edit Visit Details"
            open={isEditing}
            onCancel={() => setIsEditing(false)}
            onOk={handleUpdateVisit}
            okText="Save Changes"
            cancelText="Cancel"
            centered
            width={window.innerWidth < 768 ? '90%' : 600}
          >
            <Form
              form={form}
              layout="vertical"
              initialValues={{
                clientName: selectedVisit?.clientName || '',
                phoneNumber: selectedVisit?.phoneNumber || '',
                visitDate: selectedVisit?.visitDate ? dayjs(selectedVisit.visitDate) : null,
                salesAgent: selectedVisit?.salesAgent || '',
                site: selectedVisit?.site || '',
                officeVisit: selectedVisit?.officeVisit || false,
                siteVisit: selectedVisit?.siteVisit || false,
                clientFeedback: selectedVisit?.clientFeedback || '',
                remark: selectedVisit?.remark || ''
              }}
            >
              <Form.Item
                name="clientName"
                label="Client Name"
                rules={[{ required: true, message: 'Please enter client name' }]}
              >
                <Input placeholder="Enter client name" />
              </Form.Item>

              <Form.Item
                name="phoneNumber"
                label="Phone Number"
              >
                <Input placeholder="Enter phone number" />
              </Form.Item>

              <Form.Item
                name="visitDate"
                label="Visit Date"
                rules={[{ required: true, message: 'Please select visit date' }]}
              >
                <DatePicker
                  showTime
                  format="YYYY-MM-DD HH:mm"
                  style={{ width: '100%' }}
                />
              </Form.Item>

              <Form.Item
                name="salesAgent"
                label="Sales Agent"
              >
                <AntSelect
                  placeholder="Select sales agent"
                  allowClear
                >
                  {agents.map(agent => (
                    <Option key={agent.id} value={agent.id}>{agent.name}</Option>
                  ))}
                </AntSelect>
              </Form.Item>

              <Form.Item
                name="site"
                label="Site"
              >
                <AntSelect
                  placeholder="Select site"
                  allowClear
                  onChange={value => {
                    form.setFieldsValue({ site: value });
                    if (value !== 'Other') {
                      form.setFieldsValue({ otherSite: '' });
                    }
                  }}
                >
                  <Option value="Yebe Real Estate">Yebe Real Estate</Option>
                  <Option value="Addis Empire Real Estate">Addis Empire Real Estate</Option>
                  <Option value="Sunshine Real Estate">Sunshine Real Estate</Option>
                  <Option value="Other">Other</Option>
                </AntSelect>
                {form.getFieldValue('site') === 'Other' && (
                  <Form.Item
                    name="otherSite"
                    rules={[{ required: true, message: 'Please specify other site' }]}
                  >
                    <Input placeholder="Please specify other site" />
                  </Form.Item>
                )}
              </Form.Item>

              <Form.Item
                name="officeVisit"
                label="Office Visit"
                valuePropName="checked"
              >
                <Input type="checkbox" />
              </Form.Item>

              <Form.Item
                name="siteVisit"
                label="Site Visit"
                valuePropName="checked"
              >
                <Input type="checkbox" />
              </Form.Item>

              <Form.Item
                name="clientFeedback"
                label="Client Feedback"
              >
                <Input.TextArea rows={3} placeholder="Enter client feedback" />
              </Form.Item>

              <Form.Item
                name="remark"
                label="Remark"
              >
                <Input.TextArea rows={3} placeholder="Enter remark" />
              </Form.Item>
            </Form>
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

export default AdminVisitsDashboard;