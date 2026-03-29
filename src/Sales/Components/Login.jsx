import React, { useState, useCallback } from "react";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { LoginOutlined, EyeOutlined, EyeInvisibleOutlined ,UserOutlined,LockOutlined} from '@ant-design/icons';
import { db } from "./firebase";
import { collection, query, where, getDocs, updateDoc } from "firebase/firestore";
import { useNavigate } from 'react-router-dom';
import { auth } from "./firebase";
import { Layout, Card, Button, Form, Input, Modal, Spin, Typography, Divider } from 'antd';
import logo from './Dynamic logo-03.png';
import "./index.css";

const { Content } = Layout;
const { Title, Text } = Typography;

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [errorDetails, setErrorDetails] = useState("");
  const navigate = useNavigate();

  const getFriendlyErrorMessage = useCallback((errorCode, errorMessage) => {
    const errorMap = {
      "auth/invalid-email": {
        title: "Invalid Email",
        details: "The email address is not valid. Please check and try again."
      },
      "auth/user-disabled": {
        title: "Account Disabled",
        details: "This account has been disabled. Please contact support."
      },
      // ... other error cases
    };

    return errorMap[errorCode] || {
      title: "Login Error",
      details: `An error occurred: ${errorMessage}. Please try again or contact support.`
    };
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const q = query(collection(db, "teamMembers"), where("userId", "==", user.uid));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        const { role } = docSnap.data();

        await updateDoc(docSnap.ref, {
          lastSignInTime: user.metadata.lastSignInTime,
          creationTime: user.metadata.creationTime,
        });

        const routes = {
          "Manager": "/ManagerDashboard/Manager",
          "Supervisor": "/SupervisorDashboard/report",
          "Sales Agent": "/dashboard/ReportProspect"
        };

        if (routes[role]) {
          navigate(routes[role]);
        } else {
          throw new Error("Invalid role assigned to user.");
        }
      } else {
        throw new Error("User data not found in Firestore.");
      }
    } catch (error) {
      const { title, details } = error.code 
        ? getFriendlyErrorMessage(error.code, error.message)
        : { title: "Login Failed", details: error.message };
      setErrorMessage(title);
      setErrorDetails(details);
      setErrorModalVisible(true);
    } finally {
      setLoading(false);
    }
  }, [email, password, navigate, getFriendlyErrorMessage]);

  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Content className="flex items-center justify-center p-4">
        <Card
          className="w-full max-w-md shadow-lg"
          style={{ borderColor: '#117960' }}
          bodyStyle={{ padding: '32px' }}
        >
          <div className="text-center mb-8">
            <img 
              src={logo} 
              alt="Company Logo" 
              className="w-32 mx-auto mb-4" 
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
            />
            <Title level={3} className="text-[#117960]">
              Employee Sign-In
            </Title>
            <Text type="secondary">
              Access your account to manage your tasks
            </Text>
          </div>

          <Form layout="vertical" onSubmitCapture={handleSubmit}>
            <Form.Item
              label="Email"
              name="email"
              rules={[
                { required: true, message: 'Please input your email!' },
                { type: 'email', message: 'Please enter a valid email' }
              ]}
            >
              <Input
                prefix={<UserOutlined className="text-[#117960]" />}
                placeholder="Enter your email"
                size="large"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </Form.Item>

            <Form.Item
              label="Password"
              name="password"
              rules={[{ required: true, message: 'Please input your password!' }]}
            >
              <Input.Password
                prefix={<LockOutlined className="text-[#117960]" />}
                placeholder="Enter your password"
                size="large"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                iconRender={(visible) => 
                  visible ? 
                    <EyeOutlined className="text-[#117960]" /> : 
                    <EyeInvisibleOutlined className="text-[#117960]" />
                }
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={loading}
                style={{ background: '#117960', borderColor: '#117960' }}
                className="hover:bg-[#0e684e]"
              >
                <LoginOutlined /> Sign In
              </Button>
            </Form.Item>

            <Divider>
              <Text type="secondary" className="text-xs text-[#117960]">
                Forgot your password? <span className="text-blue-600">Contact your Supervisor or Admin.</span>
              </Text>
            </Divider>
          </Form>
        </Card>

        {/* Error Modal */}
        <Modal
          title={<span className="text-red-600">{errorMessage}</span>}
          open={errorModalVisible}
          onCancel={() => setErrorModalVisible(false)}
          footer={[
            <Button 
              key="ok" 
              type="primary" 
              onClick={() => setErrorModalVisible(false)}
              style={{ background: '#117960', borderColor: '#117960' }}
            >
              OK
            </Button>
          ]}
          centered
        >
          <div className="text-gray-700">
            <p>{errorDetails}</p>
          </div>
        </Modal>

        {/* Loading Overlay */}
        {loading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Spin size="large" tip="Signing in..." className="text-white" />
          </div>
        )}
      </Content>
    </Layout>
  );
};

export default Login;
export { auth, signInWithEmailAndPassword };