import React, { useState, useCallback } from "react";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { LoginOutlined, EyeOutlined, EyeInvisibleOutlined, UserOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { db } from "../Sales/Components/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useNavigate } from 'react-router-dom';
import { auth } from "../Sales/Components/firebase";
import { Layout, Card, Button, Form, Input, Modal, Spin, Typography, Divider } from 'antd';
import logo from "../Sales/Components/Dynamic logo-03.png";


const { Content } = Layout;
const { Title, Text } = Typography;

const AdminLogin = () => {
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
      "auth/user-not-found": {
        title: "Account Not Found",
        details: "No admin account found with this email. Please check or contact support."
      },
      "auth/wrong-password": {
        title: "Incorrect Password",
        details: "Incorrect password. Please try again."
      },
      "auth/invalid-credential": {
        title: "Invalid Credentials",
        details: "Invalid credentials. Please check your email and password."
      },
      "auth/too-many-requests": {
        title: "Too Many Attempts",
        details: "Too many login attempts. Please try again later."
      },
      "auth/operation-not-allowed": {
        title: "Login Disabled",
        details: "Email/password login is not enabled. Please contact support."
      }
    };

    return errorMap[errorCode] || {
      title: "Login Error",
      details: `An error occurred: ${errorMessage}. Please try again or contact support.`
    };
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setLoading(true);
    console.log("Attempting admin login...");
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const q = query(collection(db, "teamMembers"), where("userId", "==", user.uid));
      const snapshot = await getDocs(q);

     
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        const { role } = docSnap.data();

        console.log("Admin login attempt by user with role:", role);
        if (role === "Admin") {
          navigate("/admin/dashboard");
        } else {
            throw new Error(`Unauthorized: Only administrators can access this portal. Your role is "${role}".`);
        }
      } else {
        throw new Error("Admin account not found. Please contact support.");
      }
    } catch (error) {
      const { title, details } = error.code 
        ? getFriendlyErrorMessage(error.code, error.message)
        : { title: "Admin Login Failed", details: error.message };
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
            <Title level={3} className="text-[#117960] flex items-center justify-center">
              <SafetyOutlined className="mr-2" /> Admin Portal
            </Title>
            <Text type="secondary">
              Restricted access to system administration
            </Text>
          </div>

          <Form layout="vertical" onSubmitCapture={handleSubmit}>
            <Form.Item
              label="Admin Email"
              name="email"
              rules={[
                { required: true, message: 'Please input your admin email!' },
                { type: 'email', message: 'Please enter a valid email' }
              ]}
            >
              <Input
                prefix={<UserOutlined className="text-[#117960]" />}
                placeholder="Enter admin email"
                size="large"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </Form.Item>

            <Form.Item
              label="Admin Password"
              name="password"
              rules={[{ required: true, message: 'Please input your password!' }]}
            >
              <Input.Password
                prefix={<LockOutlined className="text-[#117960]" />}
                placeholder="Enter admin password"
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
                <LoginOutlined /> Admin Sign In
              </Button>
            </Form.Item>

            <Divider>
              <Text type="secondary" className="text-xs text-[#117960]">
                For security reasons, please contact technical support for password assistance.
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
            {errorMessage.includes("Password") && (
              <p className="mt-2 text-sm text-blue-600">
                Contact technical support for password assistance.
              </p>
            )}
          </div>
        </Modal>

        {/* Loading Overlay */}
        {loading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Spin size="large" tip="Authenticating admin..." className="text-white" />
          </div>
        )}
      </Content>
    </Layout>
  );
};

export default AdminLogin;