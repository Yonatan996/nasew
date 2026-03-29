import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Table,
  Button,
  Input,
  Card,
  Badge,
  Space,
  DatePicker,
  Typography,
  Skeleton,
} from 'antd';
import { SearchOutlined, EditOutlined } from '@ant-design/icons';
import { db } from './firebase';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import dayjs from 'dayjs';
import { debounce } from 'lodash';

const { RangePicker } = DatePicker;
const { Text } = Typography;

const PAGE_LIMIT = 10;

const ProspectData = () => {
  const [prospects, setProspects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [hasMore, setHasMore] = useState(true);
  const [sites, setSites] = useState([]);
  const lastDocRef = useRef(null);

  const auth = getAuth();
  const user = auth.currentUser;

  const fetchProspects = useCallback(async (loadMore = false) => {
    if (!user) return;
    if (!loadMore) setLoading(true);
    try {
      let q = query(
        collection(db, 'Prospect'),
        where('user', '==', user.uid),
        orderBy('Date', 'desc'),
        ...(loadMore && lastDocRef.current ? [startAfter(lastDocRef.current)] : []),
        limit(PAGE_LIMIT)
      );

      const snapshot = await getDocs(q);
      const newProspects = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        Date: doc.data().Date || { seconds: Math.floor(Date.now() / 1000) },
      }));

      setProspects(prev => (loadMore ? [...prev, ...newProspects] : newProspects));
      if (snapshot.docs.length > 0) {
        lastDocRef.current = snapshot.docs[snapshot.docs.length - 1];
      }
      setHasMore(snapshot.docs.length === PAGE_LIMIT);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchSites = useCallback(async () => {
    try {
      const snapshot = await getDocs(collection(db, 'Sites'));
      setSites(snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
    } catch (error) {
      console.error('Sites fetch error:', error);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchProspects();
      fetchSites();
    } else {
      setLoading(false);
    }
  }, [user]);

  const filteredProspects = useMemo(() => {
  const baseList = dateRange.length === 2
    ? prospects.filter(p => {
        const date = dayjs.unix(p.Date?.seconds);
        return date.isBetween(dateRange[0], dateRange[1], 'day', '[]');
      })
    : prospects;

  if (!searchText) return baseList;

  const lowerSearch = searchText.toLowerCase();
  return baseList.filter(p =>
    Object.values(p).some(val => typeof val === 'string' && val.toLowerCase().includes(lowerSearch)) ||
    (p['Phone number']?.toString().includes(lowerSearch))
  );
}, [prospects, searchText, dateRange]);

  const handleSearch = debounce(async value => {
  if (!value) return setSearchText('');
  setLoading(true);
  try {
    const snapshot = await getDocs(query(
      collection(db, 'Prospect'),
      where('user', '==', user.uid),
      orderBy('Date', 'desc')
    ));
    const allProspects = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      Date: doc.data().Date || { seconds: Math.floor(Date.now() / 1000) },
    }));
    setProspects(allProspects);
    setSearchText(value);
  } catch (err) {
    console.error('Search fetch error:', err);
  } finally {
    setLoading(false);
  }
}, 300);

  const isProspectOlderThan24Hours = (prospect) => {
    if (!prospect?.Date?.seconds) return true;
    return (Date.now() - prospect.Date.seconds * 1000) > 86400000;
  };

  const handleEdit = record => {
    setEditingId(record.id);
    setEditForm({
      Name: record.Name || '',
      'Phone number': record['Phone number'] || '',
      Interest: record.Interest || '',
      Site: record.Site || '',
      Method: record.Method || '',
      Comment: record.Comment || '',
      remark: record.remark || '',
      OtherSite: '',
      OtherMethod: '',
      OtherComment: '',
    });
  };

  const handleSave = async () => {
    if (!editingId) return;
    try {
      const prospectRef = doc(db, 'Prospect', editingId);
      const original = prospects.find(p => p.id === editingId);
      const isOld = isProspectOlderThan24Hours(original);

      await updateDoc(prospectRef, {
        remark: editForm.remark,
        ...(!isOld && {
          Name: editForm.Name,
          'Phone number': editForm['Phone number'],
          Interest: editForm.Interest,
          Site: editForm.Site === 'Other' ? editForm.OtherSite : editForm.Site,
          Method: editForm.Method === 'Other' ? editForm.OtherMethod : editForm.Method,
          Comment: editForm.Comment === 'Other' ? editForm.OtherComment : editForm.Comment,
        }),
      });

      setEditingId(null);
      fetchProspects();
    } catch (error) {
      console.error('Update error:', error);
    }
  };
  const columns = [
    {
      title: 'Name',
      dataIndex: 'Name',
      render: (text, record) => editingId === record.id ? (
        <Input 
          value={editForm.Name} 
          onChange={e => setEditForm({...editForm, Name: e.target.value})}
          disabled={isProspectOlderThan24Hours(record)}
        />
      ) : text || '-',
      width: 150,
  
    },
    {
      title: 'Phone',
      dataIndex: 'Phone number',
      render: (text, record) => editingId === record.id ? (
        <Input 
          value={editForm["Phone number"]} 
          onChange={e => setEditForm({...editForm, "Phone number": e.target.value})}
          disabled={isProspectOlderThan24Hours(record)}
        />
      ) : text || '-',
      width: 150
    },
    {
      title: 'Email',
      dataIndex: 'Email',
      render: (text, record) => editingId === record.id ? (
        <Input 
          value={editForm["Email"]} 
          onChange={e => setEditForm({...editForm, "Email": e.target.value})}
          disabled={isProspectOlderThan24Hours(record)}
        />
      ) : text || '-',
      width: 150
    },
    {
      title: 'Date',
      dataIndex: 'Date',
      render: date => date?.seconds ? dayjs.unix(date.seconds).format('MMM D, YYYY') : '-',
      width: 120
    },
    {
      title: 'Interest',
      dataIndex: 'Interest',
      render: (text, record) => editingId === record.id ? (
        <Input 
          value={editForm.Interest} 
          onChange={e => setEditForm({...editForm, Interest: e.target.value})}
          disabled={isProspectOlderThan24Hours(record)}
        />
      ) : text || '-',
      width: 150
    },
    {
      title: 'Site',
      dataIndex: 'Site',
      render: (text, record) => editingId === record.id ? (
        <>
          <Select
            value={editForm.Site}
            onChange={value => setEditForm({...editForm, Site: value})}
            disabled={isProspectOlderThan24Hours(record)}
            style={{ width: '100%' }}
          >
            {sites.map(site => (
              <Select.Option key={site.id} value={site.name}>{site.name}</Select.Option>
            ))}
            <Select.Option value="Other">Other</Select.Option>
          </Select>
          {editForm.Site === 'Other' && (
            <Input
              value={editForm.OtherSite}
              onChange={e => setEditForm({...editForm, OtherSite: e.target.value})}
              className="mt-2"
            />
          )}
        </>
      ) : text || '-',
      width: 180
    },
    {
      title: 'Method',
      dataIndex: 'Method',
      render: (text, record) => editingId === record.id ? (
        <>
          <Select
            value={editForm.Method}
            onChange={value => setEditForm({...editForm, Method: value})}
            disabled={isProspectOlderThan24Hours(record)}
            style={{ width: '100%' }}
          >
            <Select.Option value="Telemarketing">Telemarketing</Select.Option>
            <Select.Option value="Survey">Survey</Select.Option>
            <Select.Option value="Social Media">Social Media</Select.Option>
            <Select.Option value="Email">Email</Select.Option>
            <Select.Option value="Referral">Referral</Select.Option>
            <Select.Option value="Event">Event</Select.Option>
            <Select.Option value="Walk-in">Walk-in</Select.Option>
            <Select.Option value="Other">Other</Select.Option>
          </Select>
          {editForm.Method === 'Other' && (
            <Input
              value={editForm.OtherMethod}
              onChange={e => setEditForm({...editForm, OtherMethod: e.target.value})}
              className="mt-2"
            />
          )}
        </>
      ) : text || '-',
      width: 180
    },
    {
      title: 'Remark',
      dataIndex: 'remark',
      render: (text, record) => editingId === record.id ? (
        <Input 
          value={editForm.remark} 
          onChange={e => setEditForm({...editForm, remark: e.target.value})}
        />
      ) : text || '-',
      width: 200
    },
    {
      title: 'Actions',
      key: 'actions',
      // fixed: 'right',
      width: 120,
      render: (_, record) => editingId === record.id ? (
        <Space>
          <Button type="primary" size="small" onClick={handleSave} className="bg-[#117960]">
            Save
          </Button>
          <Button size="small" onClick={() => setEditingId(null)}>
            Cancel
          </Button>
        </Space>
      ) : (
        <Space>
          <Button 
            icon={<EditOutlined />} 
            size="small" 
            onClick={() => handleEdit(record)}
          />
        
        </Space>
      )
    }
  ];
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <Card className="shadow-sm" bodyStyle={{ padding: 16 }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <Text strong className="text-lg">Prospect Management</Text>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <Input
              placeholder="Search..."
              prefix={<SearchOutlined />}
              onChange={e => handleSearch(e.target.value)}
              allowClear
              className="w-full"
            />
            {/* <RangePicker onChange={setDateRange} className="w-full sm:w-auto" /> */}
          </div>
        </div>

        <div className="mb-2">
          <Badge count={filteredProspects.length} style={{ backgroundColor: '#117960' }} showZero />
          <Text className="ml-2">Prospects</Text>
        </div>

        {loading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <Table
            columns={columns}
            dataSource={filteredProspects}
            rowKey="id"
            scroll={{ x: 1300 }}
            pagination={{ pageSize: 10, showSizeChanger: true, showQuickJumper: true }}
            footer={() => hasMore && (
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <Button onClick={() => fetchProspects(true)} loading={loading} type="primary">
                  Load More
                </Button>
              </div>
            )}
            size="small"
          />
        )}
      </Card>
    </div>
  );
};

export default React.memo(ProspectData);
