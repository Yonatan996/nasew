import React, { useState, useEffect,useRef } from 'react';
import { Table, Button, Input, Typography, Card, Divider, message, Select, DatePicker } from 'antd';
import { db } from '../Sales/Components/firebase';
import { collection, getDocs, query, where, doc, updateDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title } = Typography;
const { RangePicker } = DatePicker;


const SupervisorProspectView = () => {
  const PAGE_SIZE = 10;
const [prospects, setProspects] = useState([]);
const [displayedProspects, setDisplayedProspects] = useState([]);
const [allFetched, setAllFetched] = useState(false);
const [filteredView, setFilteredView] = useState(false); // detect if filters/search are active
const lastFetchedRef = useRef(null);


  const [loading, setLoading] = useState(false);
  const [filteredProspects, setFilteredProspects] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [dateRange, setDateRange] = useState([]);
  const [salesAgents, setSalesAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [searchText, setSearchText] = useState('');

  const formatDate = (seconds) => {
    if (!seconds) return 'N/A';
    return new Date(seconds * 1000).toLocaleString('en-GB', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const isProspectOlderThan24Hours = (prospect) => {
    if (!prospect.Date?.seconds) return true;
    const prospectTime = prospect.Date.seconds * 1000;
    const currentTime = Date.now();
    return (currentTime - prospectTime) > (24 * 60 * 60 * 1000);
  };

const fetchData = async ({ fetchAll = false, reset = false } = {}) => {
  const auth = getAuth();
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  setLoading(true);

  try {
    const userSnap = await getDocs(query(
      collection(db, 'teamMembers'),
      where('userId', '==', currentUser.uid)
    ));
    if (userSnap.empty) return;

    const userDoc = userSnap.docs[0];
    const userDocId = userDoc.id;
    const supervisorData = userDoc.data();

    const agentSnap = await getDocs(query(
      collection(db, 'teamMembers'),
      where('supervisor', '==', userDocId)
    ));

    const agents = [
      {
        id: userDoc.id,
        userId: supervisorData.userId,
        name: supervisorData.name,
        ...supervisorData
      },
      ...agentSnap.docs.map(doc => ({
        id: doc.id,
        userId: doc.data().userId,
        name: doc.data().name,
        ...doc.data()
      }))
    ];
    setSalesAgents(agents);

    const allUserIds = [...agents.map(a => a.userId), currentUser.uid];
    let allProspectDocs = [];

    const chunkSize = 10;
    for (let i = 0; i < allUserIds.length; i += chunkSize) {
      const chunk = allUserIds.slice(i, i + chunkSize);
      const q = query(
        collection(db, 'Prospect'),
        
        where('user', 'in', chunk)
      );
      const snap = await getDocs(q);
      allProspectDocs.push(...snap.docs);
    }

    const processed = allProspectDocs.map(doc => {
      const data = doc.data();
      const date = data.Date?.toDate?.()
        || (data.Date?.seconds ? new Date(data.Date.seconds * 1000) : new Date(data.Date || 0));

      return {
        id: doc.id,
        ...data,
        _sortDate: date,
        agentName: agents.find(a => a.userId === data.user)?.name || supervisorData.name,
        canEdit: data.user === currentUser.uid && !isProspectOlderThan24Hours({ Date: data.Date })
      };
    }).sort((a, b) => b._sortDate - a._sortDate);

    setProspects(processed);
    setFilteredProspects(processed);
    lastFetchedRef.current = PAGE_SIZE;
    setDisplayedProspects(processed.slice(0, PAGE_SIZE));
    setAllFetched(processed.length <= PAGE_SIZE);
  } catch (err) {
    console.error("Error fetching prospects:", err);
    message.error("Failed to fetch data");
  } finally {
    setLoading(false);
  }
};
const handleLoadMore = () => {
  const nextLimit = lastFetchedRef.current + PAGE_SIZE;
  const nextData = filteredProspects.slice(0, nextLimit);
  setDisplayedProspects(nextData);
  lastFetchedRef.current = nextLimit;
  if (nextData.length >= filteredProspects.length) {
    setAllFetched(true);
  }
};


  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) fetchData();
    });
    return () => unsubscribe();
  }, []);

 useEffect(() => {
  let filtered = [...prospects];
  let hasFilter = false;

  if (dateRange && dateRange.length === 2) {
    const [start, end] = dateRange;
    filtered = filtered.filter(p => p._sortDate >= start.startOf('day') && p._sortDate <= end.endOf('day'));
    hasFilter = true;
  }

  if (selectedAgent) {
    filtered = filtered.filter(p => p.agentName === selectedAgent);
    hasFilter = true;
  }

  if (searchText) {
    filtered = filtered.filter(p =>
      p["Phone number"]?.toString().toLowerCase().includes(searchText.toLowerCase())
    );
    hasFilter = true;
  }

  setFilteredProspects(filtered);
  setDisplayedProspects(hasFilter ? filtered : filtered.slice(0, PAGE_SIZE));
  setAllFetched(hasFilter || filtered.length <= PAGE_SIZE);
  setFilteredView(hasFilter);

  lastFetchedRef.current = hasFilter ? filtered.length : PAGE_SIZE;
}, [prospects, dateRange, selectedAgent, searchText]);

  const handleEdit = (prospect) => {
    setEditingId(prospect.id);
    setEditFormData({
      Name: prospect.Name,
      "Phone number": prospect["Phone number"],
      Interest: prospect.Interest,
      Site: prospect.Site,
      Method: prospect.Method,
      Comment: prospect.Comment,
      remark: prospect.remark,
    });
  };

  const handleSave = async (id) => {
    try {
      const prospectRef = doc(db, "Prospect", id);
      await updateDoc(prospectRef, {
        Name: editFormData.Name,
        "Phone number": editFormData["Phone number"],
        Interest: editFormData.Interest,
        Site: editFormData.Site,
        Method: editFormData.Method,
        Comment: editFormData.Comment,
        remark: editFormData.remark,
      });
      
      await fetchData();
      setEditingId(null);
      message.success("Prospect updated successfully!");
    } catch (error) {
      console.error("Error updating prospect:", error);
      message.error("Failed to update prospect.");
    }
  };

  const handleCancel = () => {
    setEditingId(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({ ...prev, [name]: value }));
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'Name',
      key: 'Name',
      render: (text, record) => 
        editingId === record.id ? (
          <Input
            name="Name"
            value={editFormData.Name}
            onChange={handleInputChange}
            disabled={!record.canEdit}
          />
        ) : text,
    },
    {
      title: 'Phone',
      dataIndex: 'Phone number',
      key: 'Phone number',
      render: (text, record) => 
        editingId === record.id ? (
          <Input
            name="Phone number"
            value={editFormData["Phone number"]}
            onChange={handleInputChange}
            disabled={!record.canEdit}
          />
        ) : text,
    },
    {
      title: 'Agent',
      dataIndex: 'agentName',
      key: 'agentName',
      filters: salesAgents.map(agent => ({
        text: agent.name,
        value: agent.name,
      })),
      onFilter: (value, record) => record.agentName === value,
    },
    {
      title: 'Date',
      dataIndex: 'Date',
      key: 'Date',
      render: (date) => formatDate(date?.seconds),
    },
    {
      title: 'Interest',
      dataIndex: 'Interest',
      key: 'Interest',
      render: (text, record) => 
        editingId === record.id ? (
          <Input
            name="Interest"
            value={editFormData.Interest}
            onChange={handleInputChange}
            disabled={!record.canEdit}
          />
        ) : text,
    },
    {
      title: 'Site',
      dataIndex: 'Site',
      key: 'Site',
      render: (text, record) => 
        editingId === record.id ? (
          <Input
            name="Site"
            value={editFormData.Site}
            onChange={handleInputChange}
            disabled={!record.canEdit}
          />
        ) : text,
    },
    {
      title: 'Method',
      dataIndex: 'Method',
      key: 'Method',
      render: (text, record) => 
        editingId === record.id ? (
          <Input
            name="Method"
            value={editFormData.Method}
            onChange={handleInputChange}
            disabled={!record.canEdit}
          />
        ) : text,
    },
    {
      title: 'Comment',
      dataIndex: 'Comment',
      key: 'Comment',
      render: (text, record) => 
        editingId === record.id ? (
          <Input
            name="Comment"
            value={editFormData.Comment}
            onChange={handleInputChange}
            disabled={!record.canEdit}
          />
        ) : text,
    },
    {
      title: 'Remark',
      dataIndex: 'remark',
      key: 'remark',
      render: (text, record) => 
        editingId === record.id ? (
          <Input
            name="remark"
            value={editFormData.remark}
            onChange={handleInputChange}
          />
        ) : text,
    },
    // {
    //   title: 'Actions',
    //   key: 'actions',
    //   render: (_, record) => {
    //     if (editingId === record.id) {
    //       return (
    //         <span>
    //           <Button type="link" onClick={() => handleSave(record.id)}>Save</Button>
    //           <Button type="link" onClick={handleCancel}>Cancel</Button>
    //         </span>
    //       );
    //     }
    //     return record.canEdit ? (
    //       <Button 
    //         icon={<EditOutlined />} 
    //         onClick={() => handleEdit(record)}
    //         disabled={!record.canEdit}
    //       />
    //     ) : null;
    //   },
    // },
  ];

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <Card className="mb-6 shadow-lg rounded-xl">
        <Title level={2} className="text-center text-[#117960]">
          Prospect Management
        </Title>
        <Divider />
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block mb-1 font-medium">Search Phone</label>
            <Input.Search
              placeholder="Search phone numbers"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </div>
          
          <div>
            <label className="block mb-1 font-medium">Date Range</label>
            <RangePicker 
             
              onChange={setDateRange}
                   className="w-full sm:w-auto"
                              size="middle"
                              disabledDate={current => current && current > dayjs().endOf('day')}
            />
          </div>
          
          <div>
            <label className="block mb-1 font-medium">Filter by Agent</label>
            <Select
              className="w-full"
              placeholder="Select agent"
              allowClear
              onChange={setSelectedAgent}
              options={salesAgents.map(agent => ({
                label: agent.name,
                value: agent.name
              }))}
            />
          </div>
          
          <div className="flex items-end">
            <Button 
              className="w-full"
              onClick={() => {
                setSearchText('');
                setDateRange([]);
                setSelectedAgent(null);
              }}
            >
              Clear Filters
            </Button>
          </div>
        </div>
        
        <div className="mb-4">
          <span className="font-medium">Showing: </span>
          <span className="text-[#117960] font-semibold">
            {filteredProspects.length} prospects
          </span>
        </div>
      </Card>

    <Table
  columns={columns}
  dataSource={displayedProspects}
  rowKey="id"
  loading={loading}
  scroll={{ x: true }}
    pagination={{ pageSize: 10, showSizeChanger: true, showQuickJumper: true }}
/>

{!allFetched && !filteredView && (
  <div className="text-center mt-4">
    <Button onClick={handleLoadMore} loading={loading}>
      Load More
    </Button>
  </div>
)}

    </div>
  );
};

export default SupervisorProspectView;