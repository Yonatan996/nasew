import React from 'react';
import { HashRouter as Router, Route, Routes } from 'react-router-dom';
import Login from './Sales/Components/Login';
import RegisterUser from './Sales/Components/RegisterUser';
import Dashboard from './Sales/Components/dashboard';
import ProspectForm from './Sales/Components/addprospect';
import './App.css';
import ProspectData from './Sales/Components/viewprosp';
import Report from './Sales/Components/Report';
import ManagerDashboard from './Manager/dashboard';
import MaDashboard from './Manager/menu';
import ReportPage from './Manager/Report';
import TeamPerformancePage from './Manager/performance';
import TeamManagementPage from './Manager/managemnt';
import SupervisorDashboard from './Supervisor/dashboard';
import RegisterSalesAgent from './Supervisor/sales';
import SuDashboard from './Supervisor/menu';
import SalesManagementPage from './Supervisor/registerSalesAgent';
import SuProspectForm from './Supervisor/addprospect';
import SuProspectData from './Supervisor/viewprop';
import MaReportPage from './Manager/sales';
import OfficeSiteVisit from './Supervisor/officeandsite';
import OfficeSiteVisitSales from './Sales/Components/officeandsite';
import MaVisitPage from './Manager/officeandSite';
import AdminLoginPage from './Admin/LoginAdmin'; // Ensure this path points to the correct file
import AdminDashboard from './Admin/dashboard';
import AuthorizationPage from './Admin/auth';
import AdminProspectDashboard from './Admin/adminprospect';
import AdminVisitsDashboard from './Admin/adminvisits';
import AdminSiteManagement from './Admin/adminsitemgmt';
import AdminSalesPage from './Admin/adminsales';
import ManagerProspectForm from './Manager/managerform';
import AdminMenu from './Admin/adminMenu';
import FollowUpDashboard from './Admin/followup';



function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/AdminLogin" element={<AdminLoginPage />} />
        <Route path="/Register" element={<RegisterUser />} />

  
        <Route path="/admin" element={<AdminMenu/>}>
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="prospects" element={<AdminProspectDashboard />} />
          <Route path="visits" element={<AdminVisitsDashboard />} />
          <Route path="sales" element={<AdminSalesPage />} />
          <Route path="addsite" element={<AdminSiteManagement />} />
          <Route path="followup" element={<FollowUpDashboard />} />
        </Route>

        <Route path="/ManagerDashboard" element={<MaDashboard />}>
          <Route path="Manager" element={<ManagerDashboard />} />
          <Route path="DataProspect" element={<ProspectData />} />
          <Route path="ReportProspect" element={<ReportPage />} />
          <Route path="Performance" element={<TeamPerformancePage />} />
          <Route path="Managment" element={<TeamManagementPage />} />
          <Route path='Sales' element={<MaReportPage />} />
          <Route path='Visits' element={<MaVisitPage />} />
          <Route path='Addprospect' element={<ManagerProspectForm />} />
      </Route>
        <Route path="/SupervisorDashboard" element={<SuDashboard />}>
          <Route path="Report" element={<SupervisorDashboard />} />
          <Route path="Sales" element={<RegisterSalesAgent />} />
          <Route path="Register" element={<SalesManagementPage />} />
          <Route path="AddProspect" element={<SuProspectForm />} />
          <Route path="ViewProspect" element={<SuProspectData />} />
          <Route path="visitpage" element={<OfficeSiteVisit />} />
        </Route>
        <Route path="/Dashboard" element={<Dashboard />}>
          <Route path="AddProspect" element={<ProspectForm />} />
          <Route path="DataProspect" element={<ProspectData />} />
          <Route path="ReportProspect" element={<Report />} />
          <Route path="visits" element={<OfficeSiteVisitSales />} />
        </Route>
      </Routes>
    </Router>
  );
}


export default App;
