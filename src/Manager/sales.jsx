import React, { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query } from "firebase/firestore";
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
  Statistic
} from 'antd';
import { 
  UserOutlined, 
  TeamOutlined, 
  SafetyOutlined,
  FileExcelOutlined,
  ReloadOutlined,
  DollarOutlined
} from '@ant-design/icons';
import Select from 'react-select';

const { RangePicker } = DatePicker;
const { Option } = AntSelect;
const { Countdown } = Statistic;

const SalesDashboard = () => {
  const [prospects, setProspects] = useState([]);
  const [salesData, setSalesData] = useState([]);
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
  });

  // Memoized data fetching
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Use Promise.all to fetch data in parallel
        const [prospectSnapshot, salesSnapshot, teamSnapshot] = await Promise.all([
          getDocs(query(collection(db, "Prospect"))),
          getDocs(query(collection(db, "sales"))),
          getDocs(query(collection(db, "teamMembers")))
        ]);

        // Process data
        const prospectsData = prospectSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const salesData = salesSnapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data(),
          dateOfRecording: doc.data().dateOfRecording?.toDate?.() || doc.data().dateOfRecording
        })).sort((a, b) => new Date(b.dateOfRecording) - new Date(a.dateOfRecording));

        const allTeamMembers = teamSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const supervisorList = allTeamMembers.filter(member => member.role === "Supervisor");

        // Set state in one batch
        setProspects(prospectsData);
        setSalesData(salesData);
        setSupervisors(supervisorList);
        setSalesAgents(allTeamMembers);
      } catch (error) {
        console.error("Error fetching data:", error);
        message.error('Failed to load sales data');
      } finally {
        setLoading(false);
      }
    };

    // Add a small delay to show loading spinner only if fetch takes time
    const timer = setTimeout(() => {
      fetchData();
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  // Memoize team options
  const teamOptions = useMemo(() => [
    { value: "", label: "All Teams" },
    ...supervisors.map(supervisor => ({ value: supervisor.id, label: supervisor.name })),
  ], [supervisors]);

  // Memoize sales agent options
  const salesAgentOptions = useMemo(() => [
    { value: "", label: "All Agents" },
    { value: "Digital Department", label: "Digital Department" },
    { value: "Freelance", label: "Freelance" },
    ...salesAgents.map(agent => ({ value: agent.id, label: agent.name })),
  ], [salesAgents]);

  // Optimized filter function
  const filteredData = useMemo(() => {
    let data = [...salesData];

    if (filters.team) {
      const selectedSupervisor = supervisors.find(s => s.id === filters.team);
      if (selectedSupervisor) {
        data = data.filter(sale => {
          const agent = salesAgents.find(a => a.id === sale.salesAgent);
          return sale.salesAgent === selectedSupervisor.id || 
                 (agent && agent.supervisor === selectedSupervisor.id);
        });
      }
    }

    if (filters.salesAgent) {
      data = data.filter(sale => sale.salesAgent === filters.salesAgent);
    }

    if (filters.phoneNumber) {
      const phoneFilter = filters.phoneNumber.toLowerCase();
      data = data.filter(sale => {
        if (sale.soldTo === "Others") {
          return (sale.prospectPhoneNumber || "").toLowerCase().includes(phoneFilter);
        }
        const prospect = prospects.find(p => p.id === sale.soldTo);
        return (prospect?.["Phone number"] || "").toLowerCase().includes(phoneFilter);
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

    return data;
  }, [filters, salesData, prospects, supervisors, salesAgents]);

  // Calculate metrics
  const { totalAmount, averageSale } = useMemo(() => {
    const total = filteredData.reduce((sum, sale) => sum + parseFloat(sale.salesAmount || 0), 0);
    const avg = filteredData.length > 0 ? total / filteredData.length : 0;
    return {
      totalAmount: total,
      averageSale: avg
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
    });
    setCurrentPage(1);
  };

  const downloadExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      filteredData.map(sale => {
        const prospect = prospects.find(p => p.id === sale.soldTo);
        const agent = salesAgents.find(a => a.id === sale.salesAgent);
        return {
          'Sales Amount (ETB)': sale.salesAmount || 'N/A',
          'Sales Agent': ['Digital Department', 'Freelance'].includes(sale.salesAgent) 
            ? sale.salesAgent 
            : agent?.name || sale.salesAgent || 'N/A',
          'Type': sale.type || 'N/A',
          'Site': sale.site || 'N/A',
          'Area (SQM)': sale.areaInSQM || 'N/A',
          'Location': sale.area || 'N/A',
          'Date': sale.dateOfRecording?.toDate?.().toLocaleString() || sale.dateOfRecording?.toLocaleString() || 'N/A',
          'Sold To': sale.soldTo === "Others"
            ? `${sale.prospectName || 'N/A'} - ${sale.prospectPhoneNumber || 'N/A'}`
            : prospect
              ? `${prospect.Name || 'N/A'} - ${prospect['Phone number'] || 'N/A'}`
              : 'Unknown'
        };
      })
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Report");
    const fileName = `Sales_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const columns = [
    {
      title: 'Amount (ETB)',
      dataIndex: 'salesAmount',
      key: 'amount',
      render: (amount) => amount ? `${parseFloat(amount).toLocaleString()} ETB` : 'N/A',
      sorter: (a, b) => (parseFloat(a.salesAmount || 0) - parseFloat(b.salesAmount || 0))
    },
    {
      title: 'Agent',
      key: 'agent',
      render: (_, record) => {
        if (['Digital Department', 'Freelance'].includes(record.salesAgent)) {
          return record.salesAgent;
        }
        const agent = salesAgents.find(a => a.id === record.salesAgent);
        return agent ? agent.name : <Tag color="red">Unassigned</Tag>;
      }
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (text) => text || 'N/A'
    },
    {
      title: 'Site',
      dataIndex: 'site',
      key: 'site',
      render: (text) => text || 'N/A'
    },
    {
      title: 'Area (SQM)',
      dataIndex: 'areaInSQM',
      key: 'area',
      render: (text) => text || 'N/A'
    },
    {
      title: 'Location',
      dataIndex: 'area',
      key: 'location',
      render: (text) => text || 'N/A'
    },
    {
      title: 'Date',
      dataIndex: 'dateOfRecording',
      key: 'date',
      render: (date) => {
        if (!date) return 'N/A';
        const d = date.toDate ? date.toDate() : new Date(date);
        return dayjs(d).format('MMM D, YYYY');
      },
      sorter: (a, b) => {
        const dateA = a.dateOfRecording?.toDate?.() || a.dateOfRecording;
        const dateB = b.dateOfRecording?.toDate?.() || b.dateOfRecording;
        return new Date(dateA) - new Date(dateB);
      }
    },
    {
      title: 'Sold To',
      key: 'soldTo',
      render: (_, record) => {
        if (record.soldTo === "Others") {
          return `${record.prospectName || 'N/A'} - ${record.prospectPhoneNumber || 'N/A'}`;
        }
        const prospect = prospects.find(p => p.id === record.soldTo);
        return prospect 
          ? `${prospect.Name || 'N/A'} - ${prospect['Phone number'] || 'N/A'}` 
          : 'Unknown';
      }
    }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spin size="large" tip="Loading Sales Data..." />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-gray-50">
      <div className="mb-4 md:mb-6">
        <Row gutter={[16, 16]} className="mb-2 md:mb-4">
          <Col xs={24}>
            <h1 className="text-xl md:text-2xl font-bold text-gray-800">Sales Dashboard</h1>
          </Col>
        </Row>
      </div>

      <Row gutter={[8, 8]} className="mb-4 md:mb-6">
        {[
          { title: 'Total Sales', value: filteredData.length, icon: <UserOutlined />, color: '#117960' },
          { title: 'Total Amount', value: `${totalAmount.toLocaleString()} ETB`, icon: <DollarOutlined />, color: '#129777' },
          { title: 'Average Sale', value: `${averageSale.toLocaleString()} ETB`, icon: <TeamOutlined />, color: '#00C49F' }
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
        title="Sales Management"
        className="shadow-sm"
        extra={<span className="text-gray-500 text-sm md:text-base">{filteredData.length} sales found</span>}
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

export default SalesDashboard;