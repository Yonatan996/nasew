import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../Sales/Components/firebase';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, query, where, addDoc, doc, updateDoc } from "firebase/firestore";
import { EditOutlined, UserOutlined, MailOutlined, PhoneOutlined, ManOutlined, WomanOutlined } from '@ant-design/icons';
import { message, Spin, Card, Table, Button, Form, Modal, Typography, Divider, Row, Col, Input, Select, Tag } from 'antd';

const { Title } = Typography;

const SalesManagementPage = () => {
  // State management
  const [teamMembers, setTeamMembers] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [supervisorData, setSupervisorData] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const[supervisorId, setSupervisorId] = useState(null);
  const [form] = Form.useForm();
  

  const auth = getAuth();
  const currentUser = auth.currentUser;

  // Fetch data on component mount
  const fetchData = useCallback(async () => {
    try {
      if (!currentUser) {
        console.error("No current user found.");
        return;
      }

      const currentUserDoc = await getDocs(query(
        collection(db, "teamMembers"), 
        where("userId", "==", currentUser.uid)
      ));

      if (currentUserDoc.empty) {
        console.error("No matching documents found for the current user.");
        return;
      }

      const currentUserId = currentUserDoc.docs[0].id;
      setSupervisorId(currentUserId);

      // Fetch all data in parallel
      const [membersSnapshot, supervisorSnapshot] = await Promise.all([
        getDocs(query(
          collection(db, "teamMembers"), 
          where("supervisor", "==", currentUserId)
        )),
        getDocs(query(
          collection(db, 'teamMembers'), 
          where("role", "==", "Supervisor")
        ))
      ]);

      const currentUserData = currentUserDoc.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const members = [...currentUserData, ...membersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))];
      
      setTeamMembers(members);
      setSupervisorData(currentUserData[0].password);

      // Set supervisors
      const supervisorList = supervisorSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        name: doc.data().name 
      }));
      setSupervisors(supervisorList);
    } catch (error) {
      console.error("Error fetching data:", error);
      message.error("Failed to load team data");
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // User management functions
  const handleEditUser = useCallback((user) => {
    setEditingUser(user.id);
    form.setFieldsValue({
      name: user.name,
      email: user.email,
      gender: user.gender,
      phoneNumber: user.phoneNumber,
      role: user.role,
      supervisor: user.supervisor,
    });
    setIsEditing(true);
  }, [form]);

  const handleSaveEdit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      await updateDoc(doc(db, "teamMembers", editingUser), values);
      
      setTeamMembers(prev => prev.map(member =>
        member.id === editingUser ? { ...member, ...values } : member
      ));
      
      message.success('User updated successfully');
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving user:", error);
      message.error(error.message || 'Failed to update user');
    }
  }, [editingUser, form]);

  const handleAddUser = useCallback(async (values) => {
    setIsAddingMember(true);
    
    try {
      // Generate password and prepare user data
      const password = generatePassword();
      const userData = {
        ...values,
        password,
        role: 'Sales Agent',
        supervisor: supervisorId,
        createdAt: new Date().toISOString()
      };

      // Create authentication record
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        values.email,
        password
      );

      // Re-authenticate supervisor
      await signInWithEmailAndPassword(
        auth,
        currentUser.email,
        supervisorData
      );

      // Create Firestore document
      const docRef = await addDoc(collection(db, "teamMembers"), {
        ...userData,
        userId: userCredential.user.uid
      });

      // Update local state
      setTeamMembers(prev => [...prev, { id: docRef.id, ...userData }]);
      form.resetFields();

      // Copy credentials to clipboard
      try {
        await navigator.clipboard.writeText(
          `Email: ${values.email}\nPassword: ${password}`
        );
        message.success('Credentials copied to clipboard!');
      } catch (clipboardError) {
        console.warn('Failed to copy credentials:', clipboardError);
        message.warning('Created user but failed to copy credentials');
      }
    } catch (error) {
      console.error("User creation failed:", error);
      
      if (error.code === 'auth/email-already-in-use') {
        message.error('This email is already registered');
      } else if (error.code === 'auth/invalid-email') {
        message.error('Please enter a valid email address');
      } else {
        message.error('Failed to add team member. Please try again.');
      }
    } finally {
      setIsAddingMember(false);
    }
  }, [auth, currentUser, form, supervisorData]);

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length: 8 }, () => 
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join('');
  };

  // Table columns with memoization
  const columns = useMemo(() => [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text) => (
        <div className="flex items-center">
          <UserOutlined className="mr-2 text-teal-600" />
          {text}
        </div>
      )
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (text) => (
        <div className="flex items-center">
          <MailOutlined className="mr-2 text-blue-500" />
          {text}
        </div>
      )
    },
    {
      title: 'Gender',
      dataIndex: 'gender',
      key: 'gender',
      render: (text) => (
        <Tag color={text === 'Male' ? 'blue' : 'pink'} className="flex items-center">
          {text === 'Male' ? <ManOutlined className="mr-1" /> : <WomanOutlined className="mr-1" />}
          {text}
        </Tag>
      )
    },
    {
      title: 'Phone',
      dataIndex: 'phoneNumber',
      key: 'phone',
      render: (text) => (
        <div className="flex items-center">
          <PhoneOutlined className="mr-2 text-green-500" />
          {text || 'N/A'}
        </div>
      )
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (text) => (
        <Tag color={text === 'Sales Agent' ? 'green' : 'geekblue'}>
          {text}
        </Tag>
      )
    },
    {
      title: 'Supervisor',
      key: 'supervisor',
      render: (_, record) => (
        record.supervisor ? 
          supervisors.find(sup => sup.id === record.supervisor)?.name : 'N/A'
      ),
    },
    {
      title: 'Password',
      dataIndex: 'password',
      key: 'password',
      render: (text) => {
        // Move the state and handler outside the render function
        const PasswordCopyButton = ({ password }) => {
          const [copied, setCopied] = useState(false);
          
          const handleCopy = useCallback(() => {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
              navigator.clipboard.writeText(password)
                .then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                })
                .catch(() => {
                  message.error('Failed to copy password');
                });
            } else {
              message.error('Clipboard API not supported in this browser.');
            }
          }, [password]);
    
          return (
            <Button
              type="link"
              className={copied ? "text-green-500" : "text-blue-500"}
              onClick={handleCopy}
              disabled={!password}
            >
              {copied ? "Copied!" : "Copy Password"}
            </Button>
          );
        };
    
        return <PasswordCopyButton password={text} />;
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button
          icon={<EditOutlined />}
          onClick={() => handleEditUser(record)}
          className="text-teal-600 border-teal-600 hover:bg-teal-50"
        />
      ),
    },
  ], [handleEditUser, supervisors]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spin size="large" tip="Loading Team Data..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Card className="bg-gradient-to- text-black">
          <div className="flex flex-col md:flex-row md:items-center justify-between">
            <div>
              <Title level={3} className="text-white mb-1">Team Management</Title>
             
            </div>
            
          </div>
        </Card>

        <Divider className="my-4" />

        {/* Team Members Table */}
        <Card
          title={`Team Members (${teamMembers.length})`}
          className="shadow-sm mb-6"
          bodyStyle={{ padding: 0 }}
        >
          <Table
            columns={columns}
            dataSource={teamMembers}
            rowKey="id"
            pagination={{
              pageSize: 5,
              showSizeChanger: false
            }}
            scroll={{ x: true }}
          />
        </Card>

        {/* Add New User Form */}
        <Card
          title="Add New Team Member"
          className="shadow-sm"
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleAddUser}
          >
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Name"
                  name="name"
                  rules={[{ required: true, message: 'Please enter the name' }]}
                >
                  <Input prefix={<UserOutlined className="text-gray-300" />} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Email"
                  name="email"
                  rules={[
                    { required: true, message: 'Please enter the email' },
                    { type: 'email', message: 'Invalid email format' }
                  ]}
                >
                  <Input prefix={<MailOutlined className="text-gray-300" />} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Gender"
                  name="gender"
                  rules={[{ required: true, message: 'Please select gender' }]}
                >
                  <Select>
                    <Select.Option value="Male">Male</Select.Option>
                    <Select.Option value="Female">Female</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Phone Number"
                  name="phoneNumber"
                  rules={[{ required: true, message: 'Please enter phone number' }]}
                >
                  <Input prefix={<PhoneOutlined className="text-gray-300" />} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={isAddingMember}
                className="w-full bg-teal-600 hover:bg-teal-700 border-teal-600"
                size="large"
              >
                Add Team Member
              </Button>
            </Form.Item>
          </Form>
        </Card>

      
          <Modal
            title="Edit Team Member"
            open={isEditing}
            onCancel={() => setIsEditing(false)}
            onOk={handleSaveEdit}
            confirmLoading={isAddingMember}
            okText="Save Changes"
            okButtonProps={{ className: 'bg-teal-600 hover:bg-teal-700 border-teal-600' }}
          >
            <Form
              form={form}
              layout="vertical"
            >
              <Form.Item
                label="Name"
                name="name"
                rules={[{ required: true, message: 'Please enter the name' }]}
              >
                <Input prefix={<UserOutlined className="text-gray-300" />} />
              </Form.Item>
             <Form.Item
  label="Email"
  name="email"
  rules={[
    { required: true, message: 'Please enter the email' },
    { type: 'email', message: 'Invalid email format' }
  ]}
>
  <Input 
    prefix={<MailOutlined className="text-gray-300" />} 
    disabled 
  />
</Form.Item>

              <Form.Item
                label="Gender"
                name="gender"
                rules={[{ required: true, message: 'Please select gender' }]}
              >
                <Select>
            <Select.Option value="Male">Male</Select.Option>
            <Select.Option value="Female">Female</Select.Option>
                <Select.Option value="Female">Female</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item
              label="Phone Number"
              name="phoneNumber"
              rules={[{ required: true, message: 'Please enter phone number' }]}
            >
              <Input prefix={<PhoneOutlined className="text-gray-300" />} />
            </Form.Item>
            {/* <Form.Item
              label="Supervisor"
              name="supervisor"
            >
              <Select>
                {supervisors.map((sup) => (
                  <Select.Option key={sup.id} value={sup.id}>
                    {sup.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item> */}
          </Form>
        </Modal>
      </div>
    </div>
  );
};

export default React.memo(SalesManagementPage);