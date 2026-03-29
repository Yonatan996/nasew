import React, { useState, useEffect, useMemo } from 'react';
import { Layout, Card, Row, Col, Table, Tag, Spin, Pagination, Button, Modal, Input, DatePicker, message, Popconfirm } from 'antd';
import { collection, getDocs, query, orderBy, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../Sales/Components/firebase';
import { getAuth ,onAuthStateChanged} from "firebase/auth";
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { FaFilter, FaFileExcel, FaEdit, FaTrash } from 'react-icons/fa';
import { UserOutlined } from '@ant-design/icons';
import Select from 'react-select';
import * as XLSX from 'xlsx';

const { RangePicker } = DatePicker;

const FollowUpDashboard = () => {
  const [followUps, setFollowUps] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingFollowUp, setEditingFollowUp] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [filters, setFilters] = useState({
    agent: '',
    dateRange: null,
    unassigned: false
  });
  const navigate = useNavigate();
  const pageSize = 10;

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setAuthLoading(false);
      if (currentUser) {
        try {
          setLoading(true);
          
          const [followUpData, teamData] = await Promise.all([
            fetchFollowUps(),
            fetchTeamMembers()
          ]);

          setFollowUps(followUpData);
          setTeams(teamData);

        } catch (error) {
          console.error('Error loading data:', error);
          setError('Failed to load follow-up data');
        } finally {
          setLoading(false);
        }
      } else {
        navigate('/adminlogin');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const fetchFollowUps = async () => {
    const followUpSnapshot = await getDocs(query(
      collection(db, 'followUps'),
      orderBy('date', 'desc')
    ));
    return followUpSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date?.toDate?.() || doc.data().date
    }));
  };

  const fetchTeamMembers = async () => {
    const teamSnapshot = await getDocs(collection(db, 'teamMembers'));
    return teamSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  };

  const filteredFollowUps = useMemo(() => {
    let data = [...followUps];

    if (filters.agent) {
      data = data.filter(f => f.userId === filters.agent);
    }

    if (filters.dateRange && filters.dateRange.length === 2) {
      const [start, end] = filters.dateRange;
      data = data.filter(f => {
        const followUpDate = f.date;
        if (!followUpDate) return false;
        const date = followUpDate.toDate ? followUpDate.toDate() : new Date(followUpDate);
        return date >= start.startOf('day').toDate() && date <= end.endOf('day').toDate();
      });
    }

    if (filters.unassigned) {
      data = data.filter(f => !f.userId || !teams.some(t => t.userId === f.userId));
    }

    return data;
  }, [followUps, filters, teams]);

  const metrics = useMemo(() => {
    const totalFollowUps = followUps.length;
    const unassignedFollowUps = followUps.filter(f => !f.userId || !teams.some(t => t.userId === f.userId)).length;
    const lastUpdated = new Date().toLocaleDateString();

    return {
      totalFollowUps,
      unassignedFollowUps,
      lastUpdated,
      filteredCount: filteredFollowUps.length
    };
  }, [followUps, filteredFollowUps, teams]);

  const agentOptions = useMemo(() => [
    { value: '', label: 'All Agents' },
    ...teams.filter(member => ['Sales Agent', 'Supervisor', 'Manager'].includes(member.role))
      .map(agent => ({
        value: agent.userId,
        label: agent.name
      }))
  ], [teams]);

  const supervisorOptions = useMemo(() => [
    { value: '', label: 'All Supervisors' },
    ...teams.filter(member => member.role === 'Supervisor')
      .map(supervisor => ({
        value: supervisor.id,
        label: supervisor.name
      }))
  ], [teams]);

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      agent: '',
      dateRange: null,
      unassigned: false
    });
  };

  const handleEdit = (followUp) => {
    setEditingFollowUp(followUp);
    setIsEditing(true);
  };

  const handleUpdate = async () => {
    try {
      await updateDoc(doc(db, 'followUps', editingFollowUp.id), {
        followUpNumber: editingFollowUp.followUpNumber,
        userId: editingFollowUp.userId,
        supervisor: editingFollowUp.supervisor,
        date: editingFollowUp.date,
        notes: editingFollowUp.notes
      });
      setFollowUps(prev => 
        prev.map(f => f.id === editingFollowUp.id ? editingFollowUp : f)
      );
      message.success('Follow-up updated successfully');
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating follow-up:', error);
      message.error(`Failed to update follow-up: ${error.message}`);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'followUps', id));
      setFollowUps(prev => prev.filter(f => f.id !== id));
      message.success('Follow-up deleted successfully');
    } catch (error) {
      console.error('Error deleting follow-up:', error);
      message.error(`Failed to delete follow-up: ${error.message}`);
    }
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      filteredFollowUps.map(followUp => {
        const agent = teams.find(t => t.userId === followUp.userId);
        const supervisor = teams.find(t => t.id === followUp.supervisor);
        return {
          'Follow-up Number': followUp.followUpNumber,
          'Assigned Agent': agent?.name || 'Unassigned',
          'Supervisor': supervisor?.name || 'N/A',
          'Follow-up Date': followUp.date?.toLocaleString() || 'N/A',
          'Notes': followUp.notes || 'N/A'
        };
      })
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'FollowUps');
    const fileName = `FollowUps_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const columns = [
    {
      title: 'Follow-up #',
      dataIndex: 'followUpNumber',
      key: 'followUpNumber',
      sorter: (a, b) => a.followUpNumber - b.followUpNumber
    },
    {
      title: 'Agent',
      key: 'agent',
      render: (_, record) => {
        const agent = teams.find(t => t.userId === record.userId);
        return agent ? agent.name : <Tag color="red">Unassigned</Tag>;
      }
    },
    {
      title: 'Supervisor',
      key: 'supervisor',
      render: (_, record) => {
        const supervisor = teams.find(t => t.id === record.supervisor);
        return supervisor ? supervisor.name : 'N/A';
      }
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: date => {
        if (!date) return 'N/A';
        const d = date.toDate ? date.toDate() : new Date(date);
        return dayjs(d).format('MMM D, YYYY h:mm A');
      },
      sorter: (a, b) => {
        const dateA = a.date?.toDate?.() || a.date;
        const dateB = b.date?.toDate?.() || b.date;
        return new Date(dateA) - new Date(dateB);
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <div className="flex space-x-2">
          <Button
            icon={<FaEdit />}
            size="small"
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="Are you sure to delete this follow-up?"
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
        <Spin size="large" tip="Loading Follow-up Dashboard..." />
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
                <h1 className="text-xl md:text-2xl font-bold text-gray-800">Follow-up Management</h1>
              </Col>
            </Row>
          </div>

          <Row gutter={[8, 8]} className="mb-4 md:mb-6">
            {[
              { title: 'Total Follow-ups', value: metrics.totalFollowUps, icon: <UserOutlined />, color: '#117960' },
              { title: 'Unassigned Follow-ups', value: metrics.unassignedFollowUps, icon: <UserOutlined />, color: '#FFBB28' },
              { title: 'Last Updated', value: metrics.lastUpdated, icon: <UserOutlined />, color: '#0088FE' }
            ].map((metric, index) => (
              <Col xs={24} sm={12} md={6} lg={4} key={index}>
                <MetricCard
                  title={metric.title}
                  value={metric.value}
                  icon={metric.icon}
                  color={metric.color}
                />
              </Col>
            ))}
          </Row>

          <Card
            title="Follow-up Management"
            className="shadow-sm"
            extra={<span className="text-gray-500 text-sm md:text-base">{metrics.filteredCount} follow-ups found</span>}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  <label className="block mb-2 text-sm font-medium">Date Range</label>
                  <RangePicker
                    className="w-full"
                    value={filters.dateRange}
                    onChange={dates => handleFilterChange('dateRange', dates)}
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
                dataSource={filteredFollowUps.slice((currentPage - 1) * pageSize, currentPage * pageSize)}
                rowKey="id"
                pagination={false}
                scroll={{ x: true }}
              />
            </div>
            <div className="mt-3 md:mt-4 flex justify-center">
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={filteredFollowUps.length}
                onChange={setCurrentPage}
                showSizeChanger={false}
                size={window.innerWidth < 768 ? 'small' : 'default'}
              />
            </div>
          </Card>

          {/* Edit Follow-up Modal */}
          <Modal
            title="Edit Follow-up"
            open={isEditing}
            onCancel={() => setIsEditing(false)}
            onOk={handleUpdate}
            okText="Save"
            cancelText="Cancel"
            width={600}
          >
            {editingFollowUp && (
              <div className="space-y-4">
                <div>
                  <label className="block mb-2 text-sm font-medium">Follow-up Number</label>
                  <Input
                    value={editingFollowUp.followUpNumber}
                    onChange={e => setEditingFollowUp({...editingFollowUp, followUpNumber: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium">Agent</label>
                  <Select
                    options={agentOptions}
                    value={agentOptions.find(opt => opt.value === editingFollowUp.userId)}
                    onChange={opt => setEditingFollowUp({...editingFollowUp, userId: opt?.value || ''})}
                    placeholder="Select agent"
                  />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium">Supervisor</label>
                  <Select
                    options={supervisorOptions}
                    value={supervisorOptions.find(opt => opt.value === editingFollowUp.supervisor)}
                    onChange={opt => setEditingFollowUp({...editingFollowUp, supervisor: opt?.value || ''})}
                    placeholder="Select supervisor"
                  />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium">Date</label>
                  <DatePicker
                    showTime
                    className="w-full"
                    value={editingFollowUp.date ? dayjs(editingFollowUp.date) : null}
                    onChange={(date) => setEditingFollowUp({...editingFollowUp, date: date ? date.toDate() : null})}
                  />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium">Notes</label>
                  <Input.TextArea
                    value={editingFollowUp.notes || ''}
                    onChange={e => setEditingFollowUp({...editingFollowUp, notes: e.target.value})}
                    rows={4}
                  />
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

export default FollowUpDashboard;