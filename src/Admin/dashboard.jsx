import React, { useState, useEffect } from 'react';
import { Divider, Modal, Pagination, Spin, Menu, Layout, Button, Card, Row, Col, Popconfirm, message, Input, Select, Form } from 'antd';
import { getAuth, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, query, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../Sales/Components/firebase';
import { useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  PieChart, Pie, Cell, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  UserOutlined, TeamOutlined, LoginOutlined, SafetyOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, LogoutOutlined, DashboardOutlined,
  DeleteOutlined, StopOutlined, EyeOutlined, EditOutlined, PoweroffOutlined,
  BarsOutlined,
  MoneyCollectOutlined
} from '@ant-design/icons';

const { Sider, Content } = Layout;
const { Option } = Select;

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isViewModalVisible, setIsViewModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [collapsed, setCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [form] = Form.useForm();
  const pageSize = 5;
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log('Auth state changed:', currentUser ? 'User logged in' : 'No user');
      if (currentUser) {
        try {
          setLoading(true);
          setError(null);

          // Fetch teamMembers from Firestore
          const teamMembersQuery = query(collection(db, 'teamMembers'));
          const teamMembersSnapshot = await getDocs(teamMembersQuery);
          console.log('Fetched teamMembers from Firestore:', teamMembersSnapshot.docs.length);

          // Fetch supervisors to map to sales agents
          const supervisors = teamMembersSnapshot.docs
            .filter(doc => doc.data().role === 'Supervisor')
            .map(doc => ({ id: doc.id, ...doc.data() }));

          // Map teamMembers data to users
          const mergedUsers = teamMembersSnapshot.docs.map(doc => {
            const data = doc.data();
            const supervisor = supervisors.find(s => s.id === data.supervisor);
            return {
              uid: data.userId || doc.id,
              email: data.email || 'No email',
              name: data.name || 'Unknown',
              role: data.role || 'No role',
              lastSignIn: data.lastSignInTime ? new Date(data.lastSignInTime) : null,
              createdAt: data.creationTime ? new Date(data.creationTime) : new Date(),
              providers: data.providers || ['email'],
              status: data.status || 'active',
              department: data.department || '',
              phone: data.phoneNumber || 'N/A',
              emailVerified: data.emailVerified || false,
              isAdmin: data.role === 'Admin',
              supervisorName: supervisor?.name || 'Unassigned',
              supervisorId: data.supervisor || '',
              firestoreId: doc.id,
              password: data.password || 'N/A' // Insecure practice
            };
          });

          // Sort by role: Manager > Supervisor > Sales Agent
          const sortedUsers = mergedUsers.sort((a, b) => {
            const roleOrder = { Manager: 1, Supervisor: 2, 'Sales Agent': 3 };
            return (roleOrder[a.role] || 4) - (roleOrder[b.role] || 4);
          });

          console.log('Merged users:', sortedUsers.length);
          setUsers(sortedUsers);
          setFilteredUsers(sortedUsers);
        } catch (error) {
          console.error('Error fetching teamMembers:', error);
          setError(error.message || 'Failed to load teamMembers data');
        } finally {
          setLoading(false);
        }
      } else {
        console.log('Redirecting to auth');
        navigate('/auth');
      }
    }, (error) => {
      console.error('Auth state error:', error);
      setError('Authentication error');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    // Filter users by search term
    const filtered = users.filter(user =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phone.includes(searchTerm)
    );
    setFilteredUsers(filtered);
    setCurrentPage(1);
    console.log('Filtered users by search:', filtered.length);
  }, [searchTerm, users]);

  const calculateMetrics = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const recentLogins = filteredUsers.filter(u => {
      if (!u.lastSignIn) return false;
      const loginDate = new Date(u.lastSignIn);
      if (isNaN(loginDate.getTime())) return false;
      loginDate.setHours(0, 0, 0, 0);
      return loginDate.getTime() === today.getTime();
    }).length;

    const unassignedAgents = filteredUsers.filter(u => 
      u.role === 'Sales Agent' && u.supervisorName === 'Unassigned'
    ).length;

    return {
      totalUsers: filteredUsers.length,
      totalAdmins: filteredUsers.filter(u => u.role === 'Admin').length,
      totalSupervisors: filteredUsers.filter(u => u.role === 'Supervisor').length,
      totalSalesAgents: filteredUsers.filter(u => u.role === 'Sales Agent').length,
      totalManagers: filteredUsers.filter(u => u.role === 'Manager').length,
      unassignedAgents: unassignedAgents,
      recentLogins
    };
  };

  const { totalUsers, totalAdmins, totalSupervisors, totalSalesAgents, totalManagers, unassignedAgents, recentLogins } = calculateMetrics();

  const prepareChartData = () => {
    const roleData = [
      { name: 'Admins', value: totalAdmins },
      { name: 'Supervisors', value: totalSupervisors },
      { name: 'Sales Agents', value: totalSalesAgents },
      { name: 'Managers', value: totalManagers },
      { name: 'Unassigned Agents', value: unassignedAgents }
    ].filter(item => item.value > 0);

    const loginTrends = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const count = filteredUsers.filter(user => {
        if (!user.lastSignIn) return false;
        const loginDate = new Date(user.lastSignIn);
        return loginDate >= date && loginDate <= endOfDay && !isNaN(loginDate.getTime());
      }).length;

      loginTrends.push({
        name: dayjs(date).format('MMM D'),
        logins: count
      });
    };

    return { roleData, loginTrends };
  };

  const { roleData, loginTrends } = prepareChartData();

  const COLORS = ['#117960', '#0e684e', '#129777', '#00C49F', '#0088FE', '#FF8042'];

  // const menuItems = [
  //   { key: '/admindashboard/users', icon: <DashboardOutlined />, label: 'Dashboard' },
  //   { key: '/admindashboard/prospect', icon: <TeamOutlined />, label: 'Prospect Management' },
  //   { key: '/admindashboard/visits', icon: <LoginOutlined />, label: 'Client Visits' },
  //   { key: '/admindashboard/sales', icon: <MoneyCollectOutlined/>, label: 'Sales Overview' },
  //   { key: 'logout', icon: <PoweroffOutlined />, label: 'Logout' }
  // ];

  // const handleMenuClick = ({ key }) => {
  //   if (key === 'logout') {
  //     const auth = getAuth();
  //     signOut(auth)
  //       .then(() => {
  //         console.log('User logged out');
  //         navigate('/login');
  //       })
  //       .catch(error => console.error('Logout error:', error));
  //   } else {
  //     navigate(key);
  //   }
  // };

  // const suspendUser = async (userId) => {
  //   try {
  //     const userDoc = users.find(u => u.uid === userId);
  //     if (!userDoc || !userDoc.firestoreId) {
  //       throw new Error('User or Firestore ID not found');
  //     }
  //     console.log(`Suspending user: ${userId}, Firestore ID: ${userDoc.firestoreId}`);
  //     await updateDoc(doc(db, 'teamMembers', userDoc.firestoreId), { status: 'suspended' });
  //     const updatedUsers = users.map(user => 
  //       user.uid === userId ? { ...user, status: 'suspended' } : user
  //     );
  //     setUsers(updatedUsers);
  //     setFilteredUsers(updatedUsers.filter(user =>
  //       user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
  //       user.phone.includes(searchTerm)
  //     ));
  //     message.success('User suspended successfully');
  //   } catch (error) {
  //     console.error('Error suspending user:', error);
  //     message.error(`Failed to suspend user: ${error.message}`);
  //   }
  // };

  const disableUser = async (userId) => {
    try {
      const userDoc = users.find(u => u.uid === userId);
      if (!userDoc || !userDoc.firestoreId) {
        throw new Error('User or Firestore ID not found');
      }
      console.log(`Disabling user: ${userId}, Firestore ID: ${userDoc.firestoreId}`);
      await updateDoc(doc(db, 'teamMembers', userDoc.firestoreId), { status: 'disabled' });
      const updatedUsers = users.map(user => 
        user.uid === userId ? { ...user, status: 'disabled' } : user
      );
      setUsers(updatedUsers);
      setFilteredUsers(updatedUsers.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.phone.includes(searchTerm)
      ));
      message.success('User disabled successfully');
    } catch (error) {
      console.error('Error disabling user:', error);
      message.error(`Failed to disable user: ${error.message}`);
    }
  };

  const deleteUser = async (userId, firestoreId) => {
    try {
      console.log(`Deleting user: ${userId}, Firestore ID: ${firestoreId}`);
      if (!firestoreId) {
        throw new Error('Firestore ID not found');
      }
      await deleteDoc(doc(db, 'teamMembers', firestoreId));
      // Attempt Auth deletion (optional)
      try {
        const functions = getFunctions();
        const deleteUser = httpsCallable(functions, 'deleteUser');
        await deleteUser({ uid: userId });
        console.log('Firebase Auth user deleted');
      } catch (authError) {
        console.warn('Firebase Auth deletion failed, proceeding with Firestore deletion:', authError);
      }
      const updatedUsers = users.filter(user => user.uid !== userId);
      setUsers(updatedUsers);
      setFilteredUsers(updatedUsers.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.phone.includes(searchTerm)
      ));
      message.success('User deleted successfully');
    } catch (error) {
      console.error('Error deleting user:', error);
      message.error(`Failed to delete user: ${error.message}`);
    }
  };

 const handleEditUser = async (values) => {
    try {
      const userDoc = users.find(u => u.uid === selectedUser.uid);
      if (!userDoc || !userDoc.firestoreId) {
        throw new Error('User or Firestore ID not found');
      }
      console.log(`Updating user: ${selectedUser.uid}, Firestore ID: ${userDoc.firestoreId}`);
      
      // Prepare update data without password (since we don't store passwords in Firestore)
      const updateData = {
        name: values.name,
        email: values.email,
        phoneNumber: values.phone,
        role: values.role,
        supervisor: values.supervisor || ''
      };
      
      // Update Firestore document
      await updateDoc(doc(db, 'teamMembers', userDoc.firestoreId), updateData);
      
      // Update local state - include password only in local state if provided
      const updatedUsers = users.map(user =>
        user.uid === selectedUser.uid
          ? {
              ...user,
              name: values.name,
              email: values.email,
              phone: values.phone,
              role: values.role,
              supervisorName: users.find(u => u.firestoreId === values.supervisor)?.name || 'Unassigned',
              supervisorId: values.supervisor || '',
              ...(values.password && { password: values.password }) // Only include password if provided
            }
          : user
      );
      
      // Re-sort after edit
      const sortedUsers = updatedUsers.sort((a, b) => {
        const roleOrder = { Manager: 1, Supervisor: 2, 'Sales Agent': 3 };
        return (roleOrder[a.role] || 4) - (roleOrder[b.role] || 4);
      });
      
      setUsers(sortedUsers);
      setFilteredUsers(sortedUsers.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.phone.includes(searchTerm)
      ));
      message.success('User updated successfully');
      setIsEditModalVisible(false);
    } catch (error) {
      console.error('Error updating user:', error);
      message.error(`Failed to update user: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spin size="large" tip="Loading Dashboard..." />
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
        <Content className="p-4 md:p-6 bg-gray-50">
          <div className="mb-4 md:mb-6">
            <Row gutter={[16, 16]} className="mb-2 md:mb-4">
              <Col xs={24}>
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-gray-800">Admin Dashboard</h1>
                  <p className="text-gray-600 text-sm md:text-base">
                    Welcome back, {getAuth().currentUser?.displayName || 'Admin'}
                  </p>
                </div>
              </Col>
            </Row>
          </div>

          <Row gutter={[8, 8]} className="mb-4 md:mb-6">
            {[
              { title: 'Total Users', value: totalUsers, icon: <UserOutlined />, color: '#117960' },
              { title: 'Admins', value: totalAdmins, icon: <SafetyOutlined />, color: '#0e684e' },
              { title: 'Supervisors', value: totalSupervisors, icon: <TeamOutlined />, color: '#129777' },
              { title: 'Sales Agents', value: totalSalesAgents, icon: <UserOutlined />, color: '#00C49F' },
              { title: 'Managers', value: totalManagers, icon: <UserOutlined />, color: '#0088FE' },
              { title: 'Unassigned Agents', value: unassignedAgents, icon: <UserOutlined />, color: '#FF8042' },
              { title: "Today's Logins", value: recentLogins, icon: <LoginOutlined />, color: '#0088FE' }
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

          <Row gutter={[8, 8]} className="mb-4 md:mb-6">
            {[
              { title: 'Role Distribution', data: roleData, type: 'pie' },
              { title: 'Login Trends (Last 7 Days)', data: loginTrends, type: 'bar' }
            ].map((chart, index) => (
              <Col xs={24} md={12} key={index}>
                <ChartCard title={chart.title}>
                  <ResponsiveContainer width="100%" height={300}>
                    {chart.type === 'pie' ? (
                      <PieChart>
                        <Pie
                          data={chart.data}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {chart.data.map((entry, i) => (
                            <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend layout={window.innerWidth < 768 ? 'horizontal' : 'vertical'} />
                      </PieChart>
                    ) : (
                      <BarChart data={chart.data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="logins" fill="#117960" name="Logins" />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </ChartCard>
              </Col>
            ))}
          </Row>

          <Card
            title="User Management"
            className="shadow-sm"
            extra={<span className="text-gray-500 text-sm md:text-base">{filteredUsers.length} users found</span>}
            bodyStyle={{ padding: window.innerWidth < 768 ? '8px' : '16px' }}
          >
            <Input
              placeholder="Search by name or phone number"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="mb-4"
              size={window.innerWidth < 768 ? 'small' : 'middle'}
            />
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-3 py-2 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-3 py-2 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                    <th className="px-3 py-2 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-3 py-2 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supervisor</th>
                    <th className="px-3 py-2 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                    <th className="px-3 py-2 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-3 py-2 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Password</th>
                    <th className="px-3 py-2 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((user, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-3 py-2 md:px-6 md:py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <span className="line-clamp-1">{user.name}</span>
                      </td>
                      <td className="px-3 py-2 md:px-6 md:py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className="line-clamp-1">{user.email}</span>
                        {user.emailVerified && (
                          <span className="ml-2 text-xs text-green-600">(Verified)</span>
                        )}
                      </td>
                      <td className="px-3 py-2 md:px-6 md:py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.phone || 'N/A'}
                      </td>
                      <td className="px-3 py-2 md:px-6 md:py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          user.role === 'Admin' ? 'bg-red-100 text-red-800' :
                          user.role === 'Supervisor' ? 'bg-blue-100 text-blue-800' :
                          user.role === 'Manager' ? 'bg-purple-100 text-purple-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-3 py-2 md:px-6 md:py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.supervisorName}
                      </td>
                      <td className="px-3 py-2 md:px-6 md:py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.lastSignIn ? dayjs(user.lastSignIn).format('MMM D, YYYY h:mm A') : 'Never'}
                      </td>
                      <td className="px-3 py-2 md:px-6 md:py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          user.status === 'active' ? 'bg-green-100 text-green-800' :
                          user.status === 'suspended' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {user.status || 'active'}
                        </span>
                      </td>
                      <td className="px-3 py-2 md:px-6 md:py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.password}
                      </td>
                      <td className="px-3 py-2 md:px-6 md:py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <Button
                            icon={<EyeOutlined />}
                            size="small"
                            onClick={() => {
                              setSelectedUser(user);
                              setIsViewModalVisible(true);
                            }}
                          />
                          <Button
                            icon={<EditOutlined />}
                            size="small"
                            onClick={() => {
                              setSelectedUser(user);
                              form.setFieldsValue({
                                name: user.name,
                                email: user.email,
                                phone: user.phone,
                                role: user.role,
                                supervisor: user.supervisorId,
                                password: user.password
                              });
                              setIsEditModalVisible(true);
                            }}
                          />
                          {/* <Popconfirm
                            title="Are you sure to suspend this user?"
                            onConfirm={() => suspendUser(user.uid)}
                            okText="Yes"
                            cancelText="No"
                          >
                            <Button icon={<StopOutlined />} size="small" danger />
                          </Popconfirm>
                          <Popconfirm
                            title="Are you sure to disable this user?"
                            onConfirm={() => disableUser(user.uid)}
                            okText="Yes"
                            cancelText="No"
                          >
                            <Button icon={<PoweroffOutlined />} size="small" danger />
                          </Popconfirm> */}
                          <Popconfirm
                            title="Are you sure to delete this user? This action cannot be undone."
                            onConfirm={() => deleteUser(user.uid, user.firestoreId)}
                            okText="Yes"
                            cancelText="No"
                          >
                            <Button icon={<DeleteOutlined />} size="small" danger />
                          </Popconfirm>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 md:mt-4 flex justify-center">
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={filteredUsers.length}
                onChange={setCurrentPage}
                showSizeChanger={false}
                size={window.innerWidth < 768 ? 'small' : 'default'}
              />
            </div>
          </Card>

          <Modal
            title="User Details"
            open={isViewModalVisible}
            onCancel={() => setIsViewModalVisible(false)}
            footer={null}
            centered
            width={window.innerWidth < 768 ? '90%' : 520}
          >
            {selectedUser && (
              <div className="p-3 md:p-4">
                <div className="space-y-3">
                  <div>
                    <p className="text-gray-500 text-sm">Name</p>
                    <p className="text-gray-800">{selectedUser.name}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Email</p>
                    <p className="text-gray-800">{selectedUser.email} {selectedUser.emailVerified && 
                      <span className="ml-2 text-xs text-green-600">(Verified)</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Phone</p>
                    <p className="text-gray-800">{selectedUser.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Role</p>
                    <p className="text-gray-800">{selectedUser.role}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Supervisor</p>
                    <p className="text-gray-800">{selectedUser.supervisorName}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Status</p>
                    <p className="text-gray-800 capitalize">{selectedUser.status || 'active'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Password</p>
                    <p className="text-gray-800">{selectedUser.password || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Created At</p>
                    <p className="text-gray-800">{selectedUser.createdAt ? dayjs(selectedUser.createdAt).format('MMM D, YYYY h:mm A') : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">User ID</p>
                    <code className="block overflow-x-auto p-2 bg-gray-100 rounded text-xs md:text-sm">
                      {selectedUser.uid}
                    </code>
                  </div>
                </div>
                <Button
                  type="primary"
                  className="mt-4 w-full"
                  onClick={() => {
                    navigator.clipboard.writeText(selectedUser.uid);
                    message.success('User ID copied to clipboard');
                  }}
                >
                  Copy User ID
                </Button>
              </div>
            )}
          </Modal>

          <Modal
            title="Edit User"
            open={isEditModalVisible}
            onCancel={() => setIsEditModalVisible(false)}
            footer={null}
            centered
            width={window.innerWidth < 768 ? '90%' : 520}
          >
            <Form form={form} onFinish={handleEditUser} layout="vertical">
              <Form.Item
                name="name"
                label="Name"
                rules={[{ required: true, message: 'Please enter the name' }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="email"
                label="Email"
                rules={[{ required: true, message: 'Please enter the email' }, { type: 'email', message: 'Invalid email format' }]}
              >
                <Input disabled />
              </Form.Item>
              <Form.Item
                name="phone"
                label="Phone Number"
                rules={[{ required: true, message: 'Please enter the phone number' }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="role"
                label="Role"
                rules={[{ required: true, message: 'Please select a role' }]}
              >
                <Select>
                  <Option value="Manager">Manager</Option>
                  <Option value="Supervisor">Supervisor</Option>
                  <Option value="Sales Agent">Sales Agent</Option>
                  <Option value="Admin">Admin</Option>
                </Select>
              </Form.Item>
              <Form.Item
                name="supervisor"
                label="Supervisor"
              >
                <Select allowClear>
                  {users.filter(u => u.role === 'Supervisor').map(supervisor => (
                    <Option key={supervisor.firestoreId} value={supervisor.firestoreId}>
                      {supervisor.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            
              <Form.Item>
                <Button type="primary" htmlType="submit" className="w-full">
                  Save Changes
                </Button>
              </Form.Item>
            </Form>
          </Modal>
        </Content>
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

export default AdminDashboard;