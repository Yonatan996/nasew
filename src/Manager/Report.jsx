import React, { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, deleteDoc, doc } from "firebase/firestore";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import { db } from '../Sales/Components/firebase';
import { 
  Card, 
  Table, 
  Button, 
  Input, 
  Select as AntSelect, 
  DatePicker, 
  Tag, 
  Row, 
  Col, 
  Spin, 
  Pagination,
  message,
  Modal,
  Statistic
} from 'antd';
import { 
  UserOutlined, 
  TeamOutlined, 
  SafetyOutlined,
  FileExcelOutlined,
  ReloadOutlined,
  DeleteOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import Select from 'react-select';

const { RangePicker } = DatePicker;
const { Option } = AntSelect;
const { confirm } = Modal;

const ReportDashboard = () => {
  const [prospects, setProspects] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [salesAgents, setSalesAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [filters, setFilters] = useState({
    team: "",
    salesAgent: "",
    phoneNumber: "",
    dateRange: null,
    site: "",
  });

  // Fetch data in parallel
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [prospectSnapshot, teamSnapshot] = await Promise.all([
          getDocs(collection(db, "Prospect")),
          getDocs(collection(db, "teamMembers"))
        ]);

        const prospectsData = prospectSnapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data(),
          Date: doc.data().Date?.toDate?.() || doc.data().Date
        }));

        const allTeamMembers = teamSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const supervisorList = allTeamMembers.filter(member => member.role === "Supervisor");
        const combinedList = [...allTeamMembers];

        setProspects(prospectsData);
        setSupervisors(supervisorList);
        setSalesAgents(combinedList);
      } catch (error) {
        console.error("Error fetching data:", error);
        message.error('Failed to load prospect data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Memoize options
  const teamOptions = useMemo(() => [
    { value: "", label: "All Teams" },
    ...supervisors.map(supervisor => ({ value: supervisor.id, label: supervisor.name })),
  ], [supervisors]);

  const salesAgentOptions = useMemo(() => [
    { value: "", label: "All Agents" },
    ...salesAgents.map(agent => ({ value: agent.userId, label: agent.name })),
  ], [salesAgents]);

  const siteOptions = useMemo(() => {
    const sites = [...new Set(prospects.map(p => p.Site || "N/A"))];
    return [
      { value: "", label: "All Sites" },
      ...sites.map(site => ({ value: site, label: site }))
    ];
  }, [prospects]);

  // Optimized filter function
  const filteredData = useMemo(() => {
    let data = [...prospects];

    if (filters.team) {
      const selectedSupervisor = supervisors.find(s => s.id === filters.team);
      if (selectedSupervisor) {
        data = data.filter(p => {
          const isSupervisorProspect = p.user === selectedSupervisor.userId;
          const agent = salesAgents.find(a => a.userId === p.user);
          const isAgentProspect = agent && agent.supervisor === selectedSupervisor.id;
          return isSupervisorProspect || isAgentProspect;
        });
      }
    }

    if (filters.salesAgent) {
      data = data.filter(p => p.user === filters.salesAgent);
    }

    if (filters.phoneNumber) {
      const phoneFilter = filters.phoneNumber.toLowerCase();
      data = data.filter(p => (p["Phone number"] || "").toLowerCase().includes(phoneFilter));
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
      data = data.filter(p => (p.Site || "N/A") === filters.site);
    }

    return data;
  }, [filters, prospects, supervisors, salesAgents]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const uniqueAgents = new Set(filteredData.map(p => p.user));
    return {
      totalProspects: filteredData.length,
      uniqueAgents: uniqueAgents.size,
      lastUpdated: new Date().toLocaleDateString()
    };
  }, [filteredData]);

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      team: "",
      salesAgent: "",
      phoneNumber: "",
      dateRange: null,
      site: "",
    });
    setCurrentPage(1);
  };

  const showDeleteConfirm = () => {
    confirm({
      title: 'Are you sure you want to delete duplicates?',
      icon: <InfoCircleOutlined style={{ color: '#ff4d4f' }} />,
      content: 'This action cannot be undone.',
      okText: 'Yes',
      okType: 'danger',
      cancelText: 'No',
      onOk() {
        deleteDuplicates();
      }
    });
  };

  const deleteDuplicates = async () => {
    try {
      const seen = new Map();
      const duplicates = [];

      prospects.forEach(prospect => {
        const key = `${prospect.Name}-${prospect["Phone number"]}-${prospect.user}`;
        if (seen.has(key)) {
          duplicates.push(prospect);
        } else {
          seen.set(key, prospect.id);
        }
      });

      // Batch delete promises
      const deletePromises = duplicates.map(duplicate => 
        deleteDoc(doc(db, "Prospect", duplicate.id))
      );

      await Promise.all(deletePromises);
      
      setProspects(prospects.filter(p => !duplicates.some(d => d.id === p.id)));
      message.success(`Deleted ${duplicates.length} duplicate records successfully`);
    } catch (error) {
      console.error("Error deleting duplicates:", error);
      message.error('Failed to delete duplicates');
    }
  };

  const downloadExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      filteredData.map(prospect => {
        const agent = salesAgents.find(a => a.userId === prospect.user);
        return {
          'Name': prospect.Name,
          'Phone Number': prospect["Phone number"],
          'Sales Agent': agent?.name || "N/A",
          'Comment': prospect.Comment || "N/A",
          'Site': prospect.Site || "N/A",
          'Method': prospect.Method || "N/A",
          'Date': prospect.Date?.toDate?.().toLocaleString() || prospect.Date?.toLocaleString() || "N/A",
          'Interest': prospect.Interest || "N/A"
        };
      })
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Prospects Report");
    const fileName = `Prospects_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'Name',
      key: 'name',
      sorter: (a, b) => (a.Name || '').localeCompare(b.Name || '')
    },
    {
      title: 'Phone',
      dataIndex: 'Phone number',
      key: 'phone',
      render: (text) => text || 'N/A'
    },
    {
      title: 'Date',
      dataIndex: 'Date',
      key: 'date',
      render: (date) => {
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
      title: 'Agent',
      key: 'agent',
      render: (_, record) => {
        const agent = salesAgents.find(a => a.userId === record.user);
        return agent ? agent.name : <Tag color="red">Unassigned</Tag>;
      }
    },
    {
      title: 'Interest',
      dataIndex: 'Interest',
      key: 'interest',
      render: (text) => text || 'N/A'
    },
    {
      title: 'Method',
      dataIndex: 'Method',
      key: 'method',
      render: (text) => text || 'N/A'
    },
    {
      title: 'Site',
      dataIndex: 'Site',
      key: 'site',
      render: (text) => text || 'N/A'
    },
    {
      title: 'Comment',
      dataIndex: 'Comment',
      key: 'comment',
      render: (text) => text || 'N/A'
    }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spin size="large" tip="Loading Prospect Data..." />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-gray-50">
      <div className="mb-4 md:mb-6">
        <Row gutter={[16, 16]} className="mb-2 md:mb-4">
          <Col xs={24}>
            <h1 className="text-xl md:text-2xl font-bold text-gray-800">Prospects Dashboard</h1>
          </Col>
        </Row>
      </div>

      <Row gutter={[8, 8]} className="mb-4 md:mb-6">
        {[
          { title: 'Total Prospects', value: metrics.totalProspects, icon: <UserOutlined />, color: '#117960' },
          { title: 'Unique Agents', value: metrics.uniqueAgents, icon: <TeamOutlined />, color: '#129777' },
          { title: 'Last Updated', value: metrics.lastUpdated, icon: <SafetyOutlined />, color: '#00C49F' }
        ].map((metric, index) => (
          <Col xs={24} sm={12} md={8} key={index}>
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
        title="Prospects Management"
        className="shadow-sm"
        extra={<span className="text-gray-500 text-sm md:text-base">{filteredData.length} prospects found</span>}
        bodyStyle={{ padding: window.innerWidth < 768 ? '8px' : '16px' }}
      >
        <div className="bg-white p-4 rounded-lg mb-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-[#117960]">
              Filters
            </h2>
            <div className="flex space-x-2">
              <Button
                type="primary"
                onClick={downloadExcel}
                icon={<FileExcelOutlined />}
                size={window.innerWidth < 768 ? 'small' : 'middle'}
              >
                Export
              </Button>
              <Button
                danger
                onClick={showDeleteConfirm}
                icon={<DeleteOutlined />}
                size={window.innerWidth < 768 ? 'small' : 'middle'}
              >
                Delete Duplicates
              </Button>
              <Button
                onClick={handleClearFilters}
                icon={<ReloadOutlined />}
                size={window.innerWidth < 768 ? 'small' : 'middle'}
              >
                Clear Filters
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block mb-2 text-sm font-medium">Phone Number</label>
              <Input
                placeholder="Search phone"
                value={filters.phoneNumber}
                onChange={e => handleFilterChange('phoneNumber', e.target.value)}
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
                options={salesAgentOptions}
                value={salesAgentOptions.find(opt => opt.value === filters.salesAgent)}
                onChange={opt => handleFilterChange('salesAgent', opt?.value || '')}
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
              <label className="block mb-2 text-sm font-medium">Date Range</label>
              <RangePicker
                className="w-full"
                value={filters.dateRange}
                onChange={dates => handleFilterChange('dateRange', dates)}
                size={window.innerWidth < 768 ? 'small' : 'middle'}
              />
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
    </div>
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

export default ReportDashboard;