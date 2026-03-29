// AdminSiteManagement.jsx
import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  message,
  Spin,
  Tag,
  Space,
  Switch,
  Typography,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../Sales/Components/firebase';

const { Title } = Typography;

const AdminSiteManagement = () => {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [currentSite, setCurrentSite] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchSites();
  }, []);

  const fetchSites = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'sites'));
      const sitesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSites(sitesData);
    } catch (error) {
      console.error('Error fetching sites:', error);
      message.error('Failed to load sites');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        name: values.name,
        isActive: values.isActive || false,
      };

      if (currentSite) {
        await updateDoc(doc(db, 'sites', currentSite.id), data);
        message.success('Site updated successfully');
      } else {
        await addDoc(collection(db, 'sites'), data);
        message.success('Site added successfully');
      }

      setIsModalVisible(false);
      form.resetFields();
      fetchSites();
    } catch (error) {
      console.error('Error saving site:', error);
      message.error('Failed to save site');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'sites', id));
      setSites(prev => prev.filter(site => site.id !== id));
      message.success('Site deleted successfully');
    } catch (error) {
      console.error('Error deleting site:', error);
      message.error('Failed to delete site');
    }
  };

  const columns = [
    {
      title: 'Site Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: isActive => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => {
              setCurrentSite(record);
              form.setFieldsValue(record);
              setIsModalVisible(true);
            }}
          >
            Edit
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <Title level={3}>Site Management</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setCurrentSite(null);
            form.resetFields();
            setIsModalVisible(true);
          }}
        >
          Add Site
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Spin size="large" />
        </div>
      ) : (
        <Table
          columns={columns}
          dataSource={sites}
          rowKey="id"
          pagination={{ pageSize: 5 }}
        />
      )}

      <Modal
        title={currentSite ? 'Edit Site' : 'Add New Site'}
        open={isModalVisible}
        onOk={handleSubmit}
        onCancel={() => setIsModalVisible(false)}
        okText="Save"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Site Name"
            rules={[{ required: true, message: 'Please enter site name' }]}
          >
            <Input placeholder="Enter site name" />
          </Form.Item>
          <Form.Item
            name="isActive"
            label="Is Active"
            valuePropName="checked"
          >
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminSiteManagement;
