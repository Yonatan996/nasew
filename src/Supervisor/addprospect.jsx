import React, { useState, useCallback, useEffect } from "react";
import { db } from "../Sales/Components/firebase";
import { collection, addDoc, serverTimestamp, Timestamp, query, where, getDocs } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import debounce from 'lodash/debounce';
import { Card, Input, Select, Button, message } from 'antd';
import { UserOutlined, MailOutlined, PhoneOutlined, HomeOutlined, ShopOutlined, CommentOutlined, ContactsOutlined, FormOutlined } from '@ant-design/icons';
import { Upload, Modal } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx'; // You'll need to install this package

const { Option } = Select;

const SuProspectForm = () => {
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [interest, setInterest] = useState("");
  const [method, setMethod] = useState("");
  const [comment, setComment] = useState("");
  const [remark, setRemark] = useState("");
  const [site, setSite] = useState("");
  const [animationStatus, setAnimationStatus] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [otherInterest, setOtherInterest] = useState("");
  const [otherSite, setOtherSite] = useState("");
  const [otherComment, setOtherComment] = useState("");
  const [email, setEmail] = useState("");
  const [otherMethod, setOtherMethod] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sites, setSites] = useState([]);
  const [isLoadingSites, setIsLoadingSites] = useState(true);
  const [fileList, setFileList] = useState([]);
const [previewVisible, setPreviewVisible] = useState(false);
const [previewTitle, setPreviewTitle] = useState('');
const [previewImage, setPreviewImage] = useState('');
const [importedProspects, setImportedProspects] = useState([]);
const [showImportModal, setShowImportModal] = useState(false);
const [isProcessingSpreadsheet, setIsProcessingSpreadsheet] = useState(false);
const [importComplete, setImportComplete] = useState(false);
  const MIN_SIGNIFICANT_DIGITS = 7;

  // Fetch sites from Firestore
  useEffect(() => {
    const fetchSites = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "sites"));
        const sitesData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setSites(sitesData);
        setIsLoadingSites(false);
      } catch (error) {
        console.error("Error fetching sites:", error);
        setIsLoadingSites(false);
      }
    };

    fetchSites();
  }, []);

  const normalizePhoneNumber = (phone) => {
    let cleaned = phone.replace(/[^0-9+]/g, '');
    if (cleaned.startsWith('+')) {
      const firstNonPlus = cleaned.search(/[1-9]/);
      if (firstNonPlus > 1) {
        cleaned = cleaned.substring(firstNonPlus);
      }
    }
    cleaned = cleaned.replace(/^0+/, '');
    return cleaned;
  };
  const handleCancel = () => setPreviewVisible(false);

const handlePreview = async (file) => {
  if (!file.url && !file.preview) {
    file.preview = await getBase64(file.originFileObj);
  }
  setPreviewImage(file.url || file.preview);
  setPreviewVisible(true);
  setPreviewTitle(file.name || file.url.substring(file.url.lastIndexOf('/') + 1));
};

const getBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
};

const handleChange = ({ fileList }) => setFileList(fileList);

  const checkPhoneNumberExists = async (phoneNumber) => {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      return false;
    }

    const normalizedNumber = normalizePhoneNumber(phoneNumber);

    const q = query(
      collection(db, "Prospect"),
      where("Phone number_normalized", "==", normalizedNumber),
      where("user", "==", currentUser.uid)
    );

    try {
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error("Error checking phone number:", error);
      return false;
    }
  };
const processSpreadsheet = async (file) => {
  setIsProcessingSpreadsheet(true);
  try {
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });

    // Validate and normalize the data
    const validatedProspects = [];
    for (const row of data) {
      if (!row.Name || !row['Phone Number']) {
        continue; // Skip rows missing required fields
      }

      const normalizedNumber = normalizePhoneNumber(row['Phone Number']);
      const phoneExists = await checkPhoneNumberExists(row['Phone Number']);

      validatedProspects.push({
        name: row.Name || '',
        email: row.Email || '',
        phoneNumber: row['Phone Number'] || '',
        phoneNumber_normalized: normalizedNumber,
        interest: row['Interested Property'] || '',
        site: row.Site || '',
        comment: row['Client Response'] || '',
        method: row['Method of Contact'] || '',
        remark: row.Remark || '',
        isValid: !phoneExists && normalizedNumber.length >= MIN_SIGNIFICANT_DIGITS,
        validationError: phoneExists ? 
          "Phone number already exists" : 
          (normalizedNumber.length < MIN_SIGNIFICANT_DIGITS ? 
            `Phone number must have at least ${MIN_SIGNIFICANT_DIGITS} digits` : 
            '')
      });
    }

    setImportedProspects(validatedProspects);
    setShowImportModal(true);
    message.success(`Found ${validatedProspects.length} valid prospects in spreadsheet`);
  } catch (error) {
    message.error('Failed to process spreadsheet');
    console.error(error);
  } finally {
    setIsProcessingSpreadsheet(false);
  }
  return false; // Prevent default upload behavior
};
  const validatePhoneNumber = async (phone) => {
    setIsCheckingPhone(true);
    const normalizedNumber = normalizePhoneNumber(phone);

    if (!normalizedNumber || normalizedNumber.length < MIN_SIGNIFICANT_DIGITS) {
      setPhoneError(`Phone number must have at least ${MIN_SIGNIFICANT_DIGITS} significant digits`);
      setIsCheckingPhone(false);
      return false;
    }

    const phoneExists = await checkPhoneNumberExists(phone);
    if (phoneExists) {
      setPhoneError("This phone number already exists");
      setIsCheckingPhone(false);
      return false;
    }

    setPhoneError("");
    setIsCheckingPhone(false);
    return true;
  };

  const debouncedValidatePhone = useCallback(
    debounce((phone) => {
      validatePhoneNumber(phone);
    }, 500),
    []
  );

  const handlePhoneChange = (e) => {
    const value = e.target.value;
    setPhoneNumber(value);
    setPhoneError("");
    setIsCheckingPhone(false);
    debouncedValidatePhone(value);
  };

  useEffect(() => {
    return () => debouncedValidatePhone.cancel();
  }, [debouncedValidatePhone]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting) return;
    setIsSubmitting(true);

    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      console.error("No user is logged in!");
      setAnimationStatus("error");
      setIsSubmitting(false);
      return;
    }

    const isPhoneValid = await validatePhoneNumber(phoneNumber);
    if (!isPhoneValid) {
      setIsSubmitting(false);
      return;
    }

    const normalizedNumber = normalizePhoneNumber(phoneNumber);

    try {
      await addDoc(collection(db, "Prospect"), {
        DateNow: serverTimestamp(),
        Comment: comment === "Other" ? otherComment : comment,
        Date: Timestamp.fromDate(new Date()),
        Interest: interest === "Other" ? otherInterest : interest,
        Method: method === "Other" ? otherMethod : method,
        Name: name,
        PeriodTime: "",
        Site: site === "Other" ? otherSite : site,
        "Phone number": phoneNumber,
        "Phone number_normalized": normalizedNumber,
        user: currentUser.uid,
        email: email,
        remark: remark,
      });

      setAnimationStatus("success");
      message.success("Prospect added successfully!");
      setTimeout(() => {
        setAnimationStatus(null);
        window.location.href = "#/dashboard/DataProspect";
      }, 1500);
    } catch (error) {
      console.error("Error writing document: ", error);
      setAnimationStatus("error");
      message.error("Failed to add prospect. Please try again.");
      setIsSubmitting(false);
    }
  };
const ImportPreviewModal = () => {
  const [isImporting, setIsImporting] = useState(false);

  const handleBulkImport = async () => {
    setIsImporting(true);
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      message.error("No user logged in!");
      setIsImporting(false);
      return;
    }

    try {
      const validProspects = importedProspects.filter(p => p.isValid);
      const batchSize = 5; // Process in batches to avoid overwhelming Firestore
      
      for (let i = 0; i < validProspects.length; i += batchSize) {
        const batch = validProspects.slice(i, i + batchSize);
        await Promise.all(batch.map(async (prospect) => {
          await addDoc(collection(db, "Prospect"), {
            DateNow: serverTimestamp(),
            Comment: prospect.comment,
            Date: Timestamp.fromDate(new Date()),
            Interest: prospect.interest,
            Method: prospect.method,
            Name: prospect.name,
            PeriodTime: "",
            Site: prospect.site,
            "Phone number": prospect.phoneNumber,
            "Phone number_normalized": prospect.phoneNumber_normalized,
            user: currentUser.uid,
            email: prospect.email,
            remark: prospect.remark,
          });
        }));
      }

      message.success(`Successfully imported ${validProspects.length} prospects`);
      setImportComplete(true);
      setImportedProspects([]);
      setShowImportModal(false);
      
      // Navigate after a short delay to allow the success message to be seen
      setTimeout(() => {
        window.location.href = "#/dashboard/DataProspect";
      }, 1500);
      
    } catch (error) {
      console.error("Error importing prospects:", error);
      message.error("Failed to import some prospects");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Modal
      title="Import Preview"
      visible={showImportModal}
      onCancel={() => setShowImportModal(false)}
      footer={[
        <Button key="cancel" onClick={() => setShowImportModal(false)}>
          Cancel
        </Button>,
        <Button
          key="import"
          type="primary"
          loading={isImporting}
          onClick={handleBulkImport}
          disabled={importedProspects.filter(p => p.isValid).length === 0}
        >
          {isImporting ? "Importing..." : `Import ${importedProspects.filter(p => p.isValid).length} Prospects`}
        </Button>,
      ]}
      width="80%"
    >
      <div className="overflow-auto max-h-[60vh]">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Interest</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Site</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {importedProspects.map((prospect, index) => (
              <tr key={index} className={prospect.isValid ? "" : "bg-red-50"}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{prospect.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{prospect.phoneNumber}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{prospect.interest}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{prospect.site}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {prospect.isValid ? (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      Valid
                    </span>
                  ) : (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                      {prospect.validationError}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 text-sm text-gray-500">
        {importedProspects.filter(p => !p.isValid).length > 0 && (
          <p className="text-red-600">
            {importedProspects.filter(p => !p.isValid).length} prospects will not be imported due to validation errors.
          </p>
        )}
        <p>Total valid prospects: {importedProspects.filter(p => p.isValid).length}</p>
      </div>
    </Modal>
  );
};
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8" style={{ fontFamily: 'Noto Sans, Sans' }}>
      <div className="max-w-4xl mx-auto">
        <Card
          title={
            <div className="flex items-center">
              <FormOutlined className="mr-2 text-[#117960]" />
              <span className="text-lg font-semibold">Add New Prospect</span>
            </div>
          }
          className="shadow-sm"
          bodyStyle={{ padding: 24 }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {animationStatus === 'success' && (
              <div className="fixed inset-0 flex items-center justify-center bg-white bg-opacity-75 z-50">
                <DotLottieReact
                  src="https://lottie.host/146d0edc-bd40-4c5c-932d-55fb0bca823b/dk7cZaCXah.lottie"
                  loop
                  autoplay
                  style={{ width: 150, height: 150 }}
                />
              </div>
            )}

            {animationStatus === 'error' && (
              <div className="fixed inset-0 flex items-center justify-center bg-white bg-opacity-75 z-50">
                <div className="bg-red-50 border-l-4 border-red-500 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-700">
                        Error updating the data. Please try again.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <Input
                  prefix={<UserOutlined className="text-gray-400" />}
                  size="large"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Enter name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <Input
                  prefix={<MailOutlined className="text-gray-400" />}
                  size="large"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email (optional)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <Input
                  prefix={<PhoneOutlined className="text-gray-400" />}
                  size="large"
                  type="tel"
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  required
                  placeholder="e.g., +251912345678 or 0912345678"
                />
                {phoneError && (
                  <p className="mt-1 text-sm text-red-600">{phoneError}</p>
                )}
                {isCheckingPhone && (
                  <p className="mt-1 text-sm text-gray-500">Checking phone number...</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Interested Property <span className="text-red-500">*</span>
                </label>
                <Select
                  size="large"
                  style={{ width: '100%' }}
                  value={interest}
                  onChange={(e) => setInterest(e)}
                  placeholder="Select Interested Property"
                >
                  <Option value="Apartment">Apartment</Option>
                  <Option value="Shop">Shop</Option>
                  <Option value="Other">Other</Option>
                </Select>
                {interest === "Other" && (
                  <Input
                    size="large"
                    className="mt-2"
                    value={otherInterest}
                    onChange={(e) => setOtherInterest(e.target.value)}
                    required
                    placeholder="Please specify other interest"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Site <span className="text-red-500">*</span>
                </label>
                {isLoadingSites ? (
                  <Input size="large" placeholder="Loading sites..." disabled />
                ) : (
                  <>
                    <Select
                      size="large"
                      style={{ width: '100%' }}
                      value={site}
                      onChange={(e) => setSite(e)}
                      placeholder="Select Site"
                    >
                      {sites.map((siteItem) => (
                        <Option key={siteItem.id} value={siteItem.name}>{siteItem.name}</Option>
                      ))}
                      <Option value="Other">Other</Option>
                    </Select>
                    {site === "Other" && (
                      <Input
                        size="large"
                        className="mt-2"
                        value={otherSite}
                        onChange={(e) => setOtherSite(e.target.value)}
                        required
                        placeholder="Please specify other site"
                      />
                    )}
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Response <span className="text-red-500">*</span>
                </label>
                <Select
                  size="large"
                  style={{ width: '100%' }}
                  value={comment}
                  onChange={(e) => setComment(e)}
                  placeholder="Select Client Response"
                >
                  <Option value="I will call you again">I will call you again</Option>
                  <Option value="Let me discuss with my spouse">Let me discuss with my spouse</Option>
                  <Option value="Send me more details">Send me more details</Option>
                  <Option value="Can I visit again?">Can I visit again?</Option>
                  <Option value="Can we negotiate the price?">Can we negotiate the price?</Option>
                  <Option value="I need more time to decide">I need more time to decide</Option>
                  <Option value="I found another property">I found another property</Option>
                  <Option value="I am no longer looking">I am no longer looking</Option>
                  <Option value="Other">Other</Option>
                </Select>
                {comment === "Other" && (
                  <Input
                    size="large"
                    className="mt-2"
                    value={otherComment}
                    onChange={(e) => setOtherComment(e.target.value)}
                    required
                    placeholder="Please specify other response"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Method of Contact <span className="text-red-500">*</span>
                </label>
                <Select
                  size="large"
                  style={{ width: '100%' }}
                  value={method}
                  onChange={(e) => setMethod(e)}
                  placeholder="Select Method of Contact"
                >
                  <Option value="Telemarketing">Telemarketing</Option>
                  <Option value="Survey">Survey</Option>
                  <Option value="Social Media">Social Media</Option>
                  <Option value="Email">Email</Option>
                  <Option value="Referral">Referral</Option>
                  <Option value="Event">Event</Option>
                  <Option value="Walk-in">Walk-in</Option>
                  <Option value="Other">Other</Option>
                </Select>
                {method === "Other" && (
                  <Input
                    size="large"
                    className="mt-2"
                    value={otherMethod}
                    onChange={(e) => setOtherMethod(e.target.value)}
                    required
                    placeholder="Please specify other method"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Remark <span className="text-red-500">*</span>
                </label>
                <Input
                  prefix={<CommentOutlined className="text-gray-400" />}
                  size="large"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  required
                  placeholder="Enter remark"
                />
              </div>
            </div>
<div className="pt-4">
  <div className="mb-2 text-sm text-gray-600">
    Upload Excel or CSV file with prospect data
  </div>
  <Upload
    accept=".xlsx,.xls,.csv"
    beforeUpload={processSpreadsheet}
    fileList={fileList}
    onChange={handleChange}
    showUploadList={false}
    disabled={isProcessingSpreadsheet}
  >
    <Button 
      // icon={<UploadOutlined />} 
      className={`w-full ${isProcessingSpreadsheet ? 'opacity-75' : ''}`}
      style={{
        height: 42,
        backgroundColor: isProcessingSpreadsheet ? '#f0f0f0' : '#117960',
        borderColor: isProcessingSpreadsheet ? '#d9d9d9' : '#117960',
        color: isProcessingSpreadsheet ? '#666' : 'white'
      }}
      loading={isProcessingSpreadsheet}
    >
      {isProcessingSpreadsheet ? (
        <span className="flex items-center justify-center">
          <span className="animate-pulse">⏳</span>
          <span className="ml-2">Processing your spreadsheet...</span>
        </span>
      ) : (
        <span className="flex items-center justify-center">
          <UploadOutlined className="mr-2" />
          Import from Spreadsheet
        </span>
      )}
    </Button>
  </Upload>
  
  {isProcessingSpreadsheet && (
    <div className="mt-2 text-sm text-gray-500">
      Please wait while we process your file. This may take a moment...
    </div>
  )}
  
  <div className="mt-1 text-xs text-gray-400">
    Supported formats: .xlsx, .xls, .csv
  </div>
</div>

<Modal
  visible={previewVisible}
  title={previewTitle}
  footer={null}
  onCancel={handleCancel}
>
  <img alt="example" style={{ width: '100%' }} src={previewImage} />
</Modal>
            <div className="pt-4">
              <Button
                type="primary"
                size="large"
                htmlType="submit"
                disabled={isSubmitting || phoneError !== "" || isLoadingSites}
                className="w-full bg-[#117960] hover:bg-[#0e684e]"
                loading={isSubmitting}
                icon={<ContactsOutlined />}
              >
                {isSubmitting ? "Submitting..." : "Submit Prospect Information"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
      {/* ... your existing form code ... */}
<ImportPreviewModal />
    </div>
  );
};

export default SuProspectForm;