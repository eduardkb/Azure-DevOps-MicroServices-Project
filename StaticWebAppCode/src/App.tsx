import { Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage";
import AdminPage from "./pages/AdminPage";
import InformationPage from "./pages/InformationPage";
import Layout from "./components/Layout";
import { appRoles } from "./authConfig";
import RouteGuard from "./components/routeGuard";
import PatientPage from "./pages/PatientPage";
import AppointmentPage from "./pages/AppointmentPage";
import NotFoundPage from "./pages/NotFound";
import ErrorBoundaryWrapper from "./components/ErrorBoundaryWrapper";

const App = () => {
  return (
    <ErrorBoundaryWrapper>
      <Layout>
        <Routes>
          {/* Routes that can be accessed by anyone*/}
          <Route path="/" element={<HomePage /> } />

          {/* Routes with access restrictions to some specific roles */}
          <Route
            path="/info"
            element={
              <RouteGuard roles={[appRoles.Read, appRoles.Write, appRoles.Admin]}>
                <InformationPage/>
              </RouteGuard>
            }
          />
          <Route
            path="/patient"
            element={
              <RouteGuard roles={[appRoles.Read, appRoles.Write, appRoles.Admin]}>
                <PatientPage  />
              </RouteGuard>
            }
          />
          <Route
            path="/appointment"
            element={
              <RouteGuard roles={[appRoles.Read, appRoles.Write, appRoles.Admin]}>
                <AppointmentPage  />
              </RouteGuard>
            }
          />
          <Route
            path="/admin"
            element={
              <RouteGuard roles={[appRoles.Admin]}>
                <AdminPage  />
              </RouteGuard>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Layout>
    </ErrorBoundaryWrapper>
  );
};

export default App;
