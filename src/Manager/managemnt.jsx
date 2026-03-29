import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../Sales/Components/firebase';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, query, where, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { 
  Card, 
  Table, 
  Button, 
  Input, 
  Select as AntSelect, 
  Tag, 
  Row, 
  Col, 
  Spin, 
  Pagination,
  message,
  Modal,
  Form,
  Space,
  Popconfirm
} from 'antd';
import { 
  EditOutlined, 
  DeleteOutlined, 
  CopyOutlined, 
  CheckOutlined,
  SearchOutlined,
  UserOutlined,
  TeamOutlined,
  SafetyOutlined
} from '@ant-design/icons';

const { Option } = AntSelect;
const { confirm } = Modal;

const TeamManagementDashboard = () => {
  const [teamMembers, setTeamMembers] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [userCredentials, setUserCredentials] = useState(null);
  const [copiedPasswords, setCopiedPasswords] = useState({});
  const [isRegistering, setIsRegistering] = useState(false);
  const [showAddSuccess, setShowAddSuccess] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const pageSize = 10;

  const [form] = Form.useForm();
  const [addForm] = Form.useForm();

  // Fetch data in parallel
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [teamSnapshot, supervisorSnapshot] = await Promise.all([
          getDocs(collection(db, "teamMembers")),
          getDocs(query(collection(db, 'teamMembers'), where("role", "==", "Supervisor")))
        ]);

        const members = teamSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const supervisorList = supervisorSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));

        const authUser = getAuth().currentUser;
        const currentUserData = members.find(member => member.userId === authUser?.uid);
        
        setUserCredentials(currentUserData);
        setTeamMembers(members);
        setSupervisors(supervisorList);
      } catch (error) {
        console.error("Error fetching data:", error);
        message.error('Failed to load team data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter members based on search term
  const filteredMembers = useMemo(() => {
    if (!searchTerm.trim()) return teamMembers;
    
    return teamMembers.filter(member => 
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.phoneNumber.includes(searchTerm)
    );
  }, [searchTerm, teamMembers]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const supervisorsCount = teamMembers.filter(m => m.role === 'Supervisor').length;
    const agentsCount = teamMembers.filter(m => m.role === 'Sales Agent').length;
    return {
      totalMembers: teamMembers.length,
      supervisorsCount,
      agentsCount
    };
  }, [teamMembers]);

  const handleDeleteUser = async (id) => {
    try {
      await deleteDoc(doc(db, 'teamMembers', id));
      setTeamMembers(prev => prev.filter(member => member.id !== id));
      message.success('Team member deleted successfully');
    } catch (error) {
      console.error("Error deleting user:", error);
      message.error('Failed to delete team member');
    }
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    form.setFieldsValue({
      name: user.name,
      email: user.email,
      gender: user.gender,
      phoneNumber: user.phoneNumber,
      role: user.role,
      supervisor: user.supervisor,
    });
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    try {
      const values = await form.validateFields();
      await updateDoc(doc(db, "teamMembers", editingUser.id), values);
      setTeamMembers(prev => prev.map(member => 
        member.id === editingUser.id ? { ...member, ...values } : member
      ));
      setEditingUser(null);
      setIsEditing(false);
      message.success('Team member updated successfully');
    } catch (error) {
      console.error("Error saving user:", error);
    }
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setIsEditing(false);
    form.resetFields();
  };

  const handleCopyPassword = (id, password) => {
    navigator.clipboard.writeText(`Password: ${password}`);
    setCopiedPasswords(prev => ({ ...prev, [id]: true }));
    setTimeout(() => setCopiedPasswords(prev => ({ ...prev, [id]: false })), 2000);
    message.info('Password copied to clipboard');
  };

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length: 8 }, () => 
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join('');
  };

  const handleAddUser = async (values) => {
    setIsRegistering(true);
    const password = generatePassword();
    
    try {
      // Create auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        values.email, 
        password
      );
      
      // Sign back in as admin
      await signInWithEmailAndPassword(
        auth, 
        userCredentials.email, 
        userCredentials.password
      );

      // Add to Firestore
      await addDoc(collection(db, "teamMembers"), {
        ...values,
        password,
        userId: userCredential.user.uid
      });

      // Refresh team members
      const querySnapshot = await getDocs(collection(db, "teamMembers"));
      const updatedMembers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTeamMembers(updatedMembers);

      // Copy credentials to clipboard
      await navigator.clipboard.writeText(
        `Email: ${values.email}\nPassword: ${password}`
      );

      setShowAddSuccess(true);
      setCurrentPage(1);
      addForm.resetFields();
      setTimeout(() => setShowAddSuccess(false), 3000);
      message.success('User added successfully. Credentials copied to clipboard.');
    } catch (error) {
      console.error("Error adding user:", error);
      message.error(`Failed to add user: ${error.message}`);
    } finally {
      setIsRegistering(false);
    }
  };

  // Pagination logic
  const paginatedMembers = useMemo(() => {
    return filteredMembers.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize
    );
  }, [filteredMembers, currentPage]);

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name)
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email'
    },
    {
      title: 'Gender',
      dataIndex: 'gender',
      key: 'gender',
      render: (gender) => (
        <Tag color={gender === 'Male' ? 'blue' : 'pink'}>{gender}</Tag>
      )
    },
    {
      title: 'Phone',
      dataIndex: 'phoneNumber',
      key: 'phone'
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role) => (
        <Tag color={role === 'Supervisor' ? 'green' : 'orange'}>{role}</Tag>
      )
    },
    {
      title: 'Supervisor',
      key: 'supervisor',
      render: (_, record) => (
        record.supervisor ? 
          supervisors.find(sup => sup.id === record.supervisor)?.name : 'N/A'
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Button
            icon={copiedPasswords[record.id] ? <CheckOutlined /> : <CopyOutlined />}
            onClick={() => handleCopyPassword(record.id, record.password)}
            type={copiedPasswords[record.id] ? 'primary' : 'default'}
          >
            {copiedPasswords[record.id] ? 'Copied' : 'Password'}
          </Button>
          <Button
            icon={<EditOutlined />}
            onClick={() => handleEditUser(record)}
          />
          <Popconfirm
            title="Are you sure to delete this team member?"
            onConfirm={() => handleDeleteUser(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </Space>
      )
    }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spin size="large" tip="Loading Team Data..." />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-gray-50">
      <div className="mb-4 md:mb-6">
        <Row gutter={[16, 16]} className="mb-2 md:mb-4">
          <Col xs={24}>
            <h1 className="text-xl md:text-2xl font-bold text-gray-800">Team Management</h1>
          </Col>
        </Row>
      </div>

      <Row gutter={[8, 8]} className="mb-4 md:mb-6">
        {[
          { title: 'Total Members', value: metrics.totalMembers, icon: <UserOutlined />, color: '#117960' },
          { title: 'Supervisors', value: metrics.supervisorsCount, icon: <TeamOutlined />, color: '#129777' },
          { title: 'Sales Agents', value: metrics.agentsCount, icon: <SafetyOutlined />, color: '#00C49F' }
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
        title="Team Members"
        className="shadow-sm"
        extra={
          <Input
            placeholder="Search by name, email or phone"
            prefix={<SearchOutlined />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: 300 }}
          />
        }
        bodyStyle={{ padding: window.innerWidth < 768 ? '8px' : '16px' }}
      >
        <Table
          columns={columns}
          dataSource={paginatedMembers}
          rowKey="id"
          pagination={false}
          scroll={{ x: true }}
        />
        <div className="mt-3 md:mt-4 flex justify-center">
          <Pagination
            current={currentPage}
            pageSize={pageSize}
            total={filteredMembers.length}
            onChange={setCurrentPage}
            showSizeChanger={false}
            size={window.innerWidth < 768 ? 'small' : 'default'}
          />
        </div>
      </Card>

      <Card
        title={isEditing ? "Edit Team Member" : "Add New Team Member"}
        className="shadow-sm mt-6"
        bodyStyle={{ padding: window.innerWidth < 768 ? '8px' : '16px' }}
      >
        <Form
          form={form}
          onFinish={isEditing ? handleSaveEdit : handleAddUser}
          layout="vertical"
          className="space-y-4"
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="name"
                label="Name"
                rules={[{ required: true, message: 'Please enter name' }]}
              >
                <Input placeholder="Enter Name" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="email"
                label="Email"
                rules={[{ required: true, type: 'email', message: 'Please enter valid email' }]}
              >
                <Input placeholder="Enter Email" disabled={isEditing} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="gender"
                label="Gender"
                rules={[{ required: true, message: 'Please select gender' }]}
              >
                <AntSelect placeholder="Select Gender">
                  <Option value="Male">Male</Option>
                  <Option value="Female">Female</Option>
                </AntSelect>
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="phoneNumber"
                label="Phone Number"
                rules={[{ required: true, message: 'Please enter phone number' }]}
              >
                <Input placeholder="Enter Phone Number" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="role"
                label="Role"
                rules={[{ required: true, message: 'Please select role' }]}
              >
                <AntSelect placeholder="Select Role">
                  <Option value="Supervisor">Supervisor</Option>
                  <Option value="Sales Agent">Sales Agent</Option>
                </AntSelect>
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                noStyle
                shouldUpdate={(prevValues, currentValues) => 
                  prevValues.role !== currentValues.role
                }
              >
                {({ getFieldValue }) => 
                  getFieldValue('role') === 'Sales Agent' ? (
                    <Form.Item
                      name="supervisor"
                      label="Supervisor"
                      rules={[{ required: true, message: 'Please select supervisor' }]}
                    >
                      <AntSelect placeholder="Select Supervisor">
                        {supervisors.map(sup => (
                          <Option key={sup.id} value={sup.id}>{sup.name}</Option>
                        ))}
                      </AntSelect>
                    </Form.Item>
                  ) : null
                }
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={isEditing ? false : isRegistering}
                icon={<UserOutlined />}
                size="large"
              >
                {isEditing ? 'Save Changes' : 'Add User'}
              </Button>
              {isEditing && (
                <Button
                  onClick={handleCancelEdit}
                  size="large"
                >
                  Cancel
                </Button>
              )}
            </Space>
          </Form.Item>
        </Form>
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

export default TeamManagementDashboard;