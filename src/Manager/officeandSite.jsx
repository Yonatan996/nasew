import React, { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query } from "firebase/firestore";
import * as XLSX from "xlsx";
import dayjs from "dayjs";
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
  message
} from 'antd';
import { 
  UserOutlined, 
  TeamOutlined, 
  SafetyOutlined,
  FileExcelOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import Select from 'react-select';

const { RangePicker } = DatePicker;
const { Option } = AntSelect;

const OfficeAndSiteVisits = () => {
  const [prospects, setProspects] = useState([]);
  const [visitsData, setVisitsData] = useState([]);
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
    visitType: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch Prospects
        const prospectQuery = query(collection(db, "Prospect"));
        const prospectSnapshot = await getDocs(prospectQuery);
        const prospectsData = prospectSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setProspects(prospectsData);

        // Fetch Visits
        const visitsQuery = query(collection(db, "visits"));
        const visitsSnapshot = await getDocs(visitsQuery);
        const visitsData = visitsSnapshot.docs.map((doc) => ({ 
          id: doc.id, 
          ...doc.data(),
          visitDate: doc.data().visitDate?.toDate?.() || doc.data().visitDate
        }));
        visitsData.sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate));
        setVisitsData(visitsData);

        // Fetch Team Members
        const teamSnapshot = await getDocs(collection(db, "teamMembers"));
        const allTeamMembers = teamSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        // Separate Supervisors and Combined List (Supervisors + Sales Agents)
        const supervisorList = allTeamMembers.filter((member) => member.role === "Supervisor");
        const combinedList = [...allTeamMembers]; // Include all team members (supervisors + sales agents)

        setSupervisors(supervisorList);
        setSalesAgents(combinedList);
      } catch (error) {
        console.error("Error fetching data:", error);
        message.error('Failed to load visits data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Memoize site options
  const siteOptions = useMemo(() => {
     const sites = [...new Set(visitsData.map((v) => v.site || "N/A"))];
     return [
       { value: "", label: "All Sites" },
       ...sites.map((site) => ({ value: site, label: site }))
     ];
   }, [visitsData]);

  // Memoize visit type options
  const visitTypeOptions = useMemo(() => [
    { value: "", label: "All Types" },
    { value: "Office", label: "Office Visit" },
    { value: "Site", label: "Site Visit" },
  ], []);

  // Memoize team options
  const teamOptions = useMemo(() => [
    { value: "", label: "All Teams" },
    ...supervisors.map((supervisor) => ({ value: supervisor.id, label: supervisor.name })),
  ], [supervisors]);

  // Memoize sales agent options (includes supervisors)
  const salesAgentOptions = useMemo(() => [
    { value: "", label: "All Agents" },
    ...salesAgents.map((agent) => ({ value: agent.id, label: agent.name })),
  ], [salesAgents]);

  // Filter data based on filters
  const filteredData = useMemo(() => {
    let data = [...visitsData];

    if (filters.team) {
      const selectedSupervisor = supervisors.find((supervisor) => supervisor.id === filters.team);
      if (selectedSupervisor) {
        data = data.filter((visit) => {
          // Check if the visit belongs to the supervisor directly
          const isSupervisorVisit = visit.salesAgent === selectedSupervisor.id;
          // Check if the visit belongs to a sales agent under this supervisor
          const salesAgent = salesAgents.find((agent) => agent.id === visit.salesAgent);
          const isAgentVisit = salesAgent && salesAgent.supervisor === selectedSupervisor.id;
          return isSupervisorVisit || isAgentVisit;
        });
      }
    }

    if (filters.salesAgent) {
      data = data.filter((visit) => visit.salesAgent === filters.salesAgent);
    }

    if (filters.phoneNumber) {
      data = data.filter((visit) => {
        const prospectPhone = visit.phoneNumber || 
          prospects.find((prospect) => prospect.id === visit.clientId)?.["Phone number"];
        return prospectPhone && prospectPhone.includes(filters.phoneNumber);
      });
    }

    if (filters.dateRange && filters.dateRange.length === 2) {
      const [start, end] = filters.dateRange;
      data = data.filter((visit) => {
        const visitDate = visit.visitDate;
        if (!visitDate) return false;
        const date = visitDate.toDate ? visitDate.toDate() : new Date(visitDate);
        return date >= start.startOf('day').toDate() && date <= end.endOf('day').toDate();
      });
    }

    if (filters.site) {
      data = data.filter((visit) => (visit.site || "N/A") === filters.site);
    }

    if (filters.visitType) {
      data = data.filter((visit) => {
        if (filters.visitType === "Office") return visit.officeVisit === true;
        if (filters.visitType === "Site") return visit.siteVisit === true;
        return true;
      });
    }

    return data;
  }, [filters, visitsData, prospects, supervisors, salesAgents]);

  // Calculate metrics
  const { officeVisitCount, siteVisitCount } = useMemo(() => {
    const officeVisits = filteredData.filter(v => v.officeVisit).length;
    const siteVisits = filteredData.filter(v => v.siteVisit).length;
    return { officeVisitCount: officeVisits, siteVisitCount: siteVisits };
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
      visitType: "",
    });
    setCurrentPage(1);
  };

  const downloadExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      filteredData.map((visit) => {
        const agent = salesAgents.find(a => a.id === visit.salesAgent);
        const prospect = prospects.find(p => p.id === visit.clientId);
        return {
          'Client Name': visit.clientName,
          'Phone Number': visit.phoneNumber || prospect?.['Phone number'] || 'N/A',
          'Visit Date': visit.visitDate?.toDate?.().toLocaleString() || visit.visitDate?.toLocaleString(),
          'Sales Agent': agent?.name || 'Unassigned',
          'Client Feedback': visit.clientFeedback || 'N/A',
          'Site Visit': visit.siteVisit ? 'Yes' : 'No',
          'Office Visit': visit.officeVisit ? 'Yes' : 'No',
          'Site': visit.site || 'N/A',
          'Remark': visit.remark || 'N/A'
        };
      })
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Visits Report");
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

  const columns = [
    {
      title: 'Client Name',
      dataIndex: 'clientName',
      key: 'clientName',
      render: (text) => text || 'N/A',
      sorter: (a, b) => (a.clientName || '').localeCompare(b.clientName || '')
    },
    {
      title: 'Phone Number',
      key: 'phone',
      render: (_, record) => {
        const prospect = prospects.find(p => p.id === record.clientId);
        return record.phoneNumber || prospect?.['Phone number'] || 'N/A';
      }
    },
    {
      title: 'Visit Date',
      dataIndex: 'visitDate',
      key: 'visitDate',
      render: (date) => {
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
      key: 'agent',
      render: (_, record) => {
        const agent = salesAgents.find(a => a.id === record.salesAgent);
        return agent ? agent.name : <Tag color="red">Unassigned</Tag>;
      }
    },
    {
      title: 'Client Feedback',
      dataIndex: 'clientFeedback',
      key: 'clientFeedback',
      render: (text) => text || 'N/A'
    },
    {
      title: 'Site Visit',
      key: 'siteVisit',
      render: (_, record) => (
        record.siteVisit ? <Tag color="green">Yes</Tag> : <Tag color="red">No</Tag>
      )
    },
    {
      title: 'Office Visit',
      key: 'officeVisit',
      render: (_, record) => (
        record.officeVisit ? <Tag color="blue">Yes</Tag> : <Tag color="red">No</Tag>
      )
    },
    {
      title: 'Site',
      dataIndex: 'site',
      key: 'site',
      render: (text) => text || 'N/A'
    },
    {
      title: 'Remark',
      dataIndex: 'remark',
      key: 'remark',
      render: (text) => text || 'N/A'
    }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spin size="large" tip="Loading Visits Data..." />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-gray-50">
      <div className="mb-4 md:mb-6">
        <Row gutter={[16, 16]} className="mb-2 md:mb-4">
          <Col xs={24}>
            <h1 className="text-xl md:text-2xl font-bold text-gray-800">Visits Report</h1>
          </Col>
        </Row>
      </div>

      <Row gutter={[8, 8]} className="mb-4 md:mb-6">
        {[
          { title: 'Total Visits', value: filteredData.length, icon: <UserOutlined />, color: '#117960' },
          { title: 'Office Visits', value: officeVisitCount, icon: <TeamOutlined />, color: '#129777' },
          { title: 'Site Visits', value: siteVisitCount, icon: <TeamOutlined />, color: '#00C49F' }
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
        title="Visits Management"
        className="shadow-sm"
        extra={<span className="text-gray-500 text-sm md:text-base">{filteredData.length} visits found</span>}
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
              <label className="block mb-2 text-sm font-medium">Client Phone</label>
              <Input
                placeholder="Search by phone"
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

export default OfficeAndSiteVisits;