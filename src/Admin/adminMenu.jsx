// src/components/AdminMenu.jsx

import React, { useState } from "react";
import { Layout ,Menu,Dropdown,Button,notification} from "antd";
import { useNavigate, Link, Outlet, useLocation } from "react-router-dom";
import { auth } from "../Sales/Components/firebase";
import { signOut } from "firebase/auth"; // Add this import
import {
  DashboardOutlined,
  TeamOutlined,
  UserOutlined,
  BarsOutlined,
  MoneyCollectOutlined,
  LogoutOutlined
} from "@ant-design/icons";
import Logo from "../Sales/Components/Dynamic logo-03.png"
import { PhoneCallIcon } from "lucide-react";

const { Header, Content } = Layout;

const AdminMenu = ({ onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();


  const handleLogout = async () => {
    try {
      await signOut(auth); // Now using the imported signOut function
      navigate("/adminlogin", { replace: true });
      notification.success({
        message: "Logout Successful",
        description: "You have been logged out successfully",
      });
    } catch (error) {
      notification.error({
        message: "Logout Failed",
        description: error.message,
      });
    }
  };

  const menuItems = [
    { 
      key: "dashboard", 
      icon: <DashboardOutlined />, 
      label: "Dashboard", 
      path: "/admin/dashboard" 
    },
    { 
      key: "prospects", 
      icon: <TeamOutlined />, 
      label: "Prospects", 
      path: "/admin/prospects" 
    },
    { 
      key: "visits", 
      icon: <UserOutlined />, 
      label: "Visits", 
      path: "/admin/visits" 
    },
    { 
      key: "sales", 
      icon: <BarsOutlined />, 
      label: "Sales", 
      path: "/admin/sales" 
    },
    { 
      key: "add-site", 
      icon: <MoneyCollectOutlined />, 
      label: "Add Site", 
      path: "/admin/addsite" 
    },
    { 
      key: "Followup", 
      icon: <PhoneCallIcon/>, 
      label: "Follow Up", 
      path: "/admin/followup" 
    },
  ];

  const handleItemClick = (item) => {
    if (item.path) {
      navigate(item.path);
    } else if (item.action) {
      item.action();
    }
  };
  const profileMenu = (
    <Menu>
      <Menu.Item key="logout" icon={<LogoutOutlined />} onClick={handleLogout}>
        Logout
      </Menu.Item>
    </Menu>
  );
  const isActive = (path) => {
    return location.pathname === path;
  };

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
          minHeight: "calc(100vh - 64px - 70px)",
          marginBottom: "70px", // Space for bottom navigation
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
          <Outlet />
        </div>
      </Content>

      {/* Bottom Navigation Bar */}
      <div 
        style={{
          position: "fixed",
          bottom: 0,
          width: "100%",
          backgroundColor: "white",
          borderTop: "1px solid #e8e8e8",
          zIndex: 1,
        }}
      >
        <div 
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${menuItems.length}, 1fr)`,
            height: "100%",
            maxWidth: "100%",
            margin: "0 auto",
          }}
        >
          {menuItems.map((item) => {
            const active = isActive(item.path);
            return (
              <div
                key={item.key}
                onClick={() => handleItemClick(item)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "12px 0",
                  cursor: "pointer",
                  backgroundColor: active ? "#129777" : "transparent",
                  transition: "background-color 0.3s",
                }}
              >
                <span 
                  style={{
                    color: active ? "white" : "#129777",
                    fontSize: "20px",
                    marginBottom: "4px",
                  }}
                >
                  {item.icon}
                </span>
                <span 
                  style={{
                    color: active ? "white" : "#666",
                    fontSize: "12px",
                    display: active ? "block" : "none",
                  }}
                >
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
};

export default AdminMenu;