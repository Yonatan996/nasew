import React, { useState } from "react";
import { Layout, Menu, Typography, Dropdown, Button, notification } from "antd";
import { auth } from "../Sales/Components/firebase";
import { signOut } from "firebase/auth";
import { useNavigate, Link, Outlet,useLocation } from "react-router-dom";
import {
  PlusOutlined,
  EyeOutlined,
  HomeOutlined,
  UserOutlined,
  LogoutOutlined,
  ReloadOutlined,
  UserAddOutlined,
  FileTextOutlined,
  BarChartOutlined,
  DollarOutlined,
} from "@ant-design/icons";
import Logo from "../Sales/Components/Dynamic logo-03.png"

const { Header, Content, Footer } = Layout;
const { Title } = Typography;
const SuDashboard = () => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const navigate = useNavigate();

  // Handle logout functionality
  const handleLogout = async () => {
      try {
        await signOut(auth);
        navigate("/", { replace: true });
      } catch (error) {
        notification.error({
          message: "Logout Failed",
          description: error.message,
        });
      }
    };
    

  // Profile menu dropdown
  const profileMenu = (
    <Menu>
      <Menu.Item key="logout" icon={<LogoutOutlined />} onClick={handleLogout}>
        Logout
      </Menu.Item>
    </Menu>
  );
const navItems = [
  { to: "/SupervisorDashboard/report", icon: <HomeOutlined />, label: "Dashboard" },
  { to: "/SupervisorDashboard/Register", icon: <UserAddOutlined />, label: "Register Sales Agent" },
  { to: "/SupervisorDashboard/AddProspect", icon: <PlusOutlined />, label: "Add Prospects" },
  { to: "/SupervisorDashboard/ViewProspect", icon: <EyeOutlined />, label: "Check All Prospects" },
  { to: "/SupervisorDashboard/visitpage", icon: <FileTextOutlined />, label: "Office and Vite Visit" },
  { to: "/SupervisorDashboard/Sales", icon: <DollarOutlined />, label: "Check Sales" },

];

  return (
    <Layout style={{ minHeight: "100vh", width: "100vw" }}>
      {/* Header */}
      <Header
  style={{
    background: "#fff",
    padding: "16px 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
    position: "relative", // For centering the logo
  }}
>
  {/* Logo Section */}
  <div style={{
    position: "absolute", // Absolute positioning to center the logo
    left: "50%",
    transform: "translateX(-50%)", // Centering the logo horizontally
  }}>
    <img
      src={Logo}
      alt="Company Logo"
      style={{ width: "200px" }}
    />
  </div>

  {/* Icon Section */}
  <div style={{
  position: "absolute", // Absolute positioning to place logo on the right
  right: "20px",
  paddingRight: "16px",
  }}>
    <Dropdown overlay={profileMenu} trigger={["click"]}>
      <Button
        style={{
          backgroundColor: "#129777",
          border: "none",
          paddingRight: "16px",
          color: "#ffff",
        }}
        size="large"
      >
        <LogoutOutlined />
      </Button>
    </Dropdown>
  </div>
</Header>

  
      {/* Content Area */}
      <Content
        style={{
          padding: "24px",
          margin: "0",
          minHeight: "calc(100vh - 64px - 56px)",
        }}
      >
        <div
          style={{
            background: "#fff",
            padding: "24px",
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
          }}
        >
          <Outlet /> {/* This will render the nested routes */}
        </div>
      </Content>
  
      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 w-full bg-white border-t border-gray-200">
        <div className="grid h-full max-w-lg grid-cols-6 mx-auto">
          {navItems.map((item, index) => {
            const isActive = location.pathname === item.to;
            return (
          <Link
  key={index}
  to={item.to}
  className={`inline-flex flex-col items-center justify-center p-4 group ${
    location.pathname === item.to ? "bg-[#129777]" : "hover:bg-gray-50"
  }`}
>
  <span
    className={`text-[#129777] font-bold text-xl ${
      location.pathname === item.to ? "text-white" : "group-hover:text-gray-500"
    }`}
  >
    {item.icon}
  </span>
  <span
    className={`hidden ${
      location.pathname === item.to ? "inline" : "group-hover:inline"
    } text-gray-500 font-medium`}
  >
    {item.label}
  </span>
</Link>
            );
          })}
        </div>
      </div>
    </Layout>
  );

  
}


export default SuDashboard;
