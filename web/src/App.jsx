import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import { AppShell } from './components/layout/AppShell.jsx'
import { GuestRoute, ProtectedRoute, RoleRoute } from './components/layout/ProtectedRoute.jsx'
import { homePath } from './components/layout/navConfig.js'

const LoginPage = lazy(() => import('./pages/auth/LoginPage.jsx'))
const ProfilePage = lazy(() => import('./pages/account/ProfilePage.jsx'))
const MyOrgsPage = lazy(() => import('./pages/workspace/MyOrgsPage.jsx'))
const ManagerDashboardPage = lazy(() => import('./pages/dashboards/ManagerDashboardPage.jsx'))
const TechnicianDashboardPage = lazy(() => import('./pages/dashboards/TechnicianDashboardPage.jsx'))
const AdminDashboardPage = lazy(() => import('./pages/dashboards/AdminDashboardPage.jsx'))
const AlertsPage = lazy(() => import('./pages/technician/AlertsPage.jsx'))
const SensorsPage = lazy(() => import('./pages/technician/SensorsPage.jsx'))
const PhotosPage = lazy(() => import('./pages/technician/PhotosPage.jsx'))
const UavSurveysPage = lazy(() => import('./pages/technician/UavSurveysPage.jsx'))
const FieldLogsPage = lazy(() => import('./pages/technician/FieldLogsPage.jsx'))
const StationDetailPage = lazy(() => import('./pages/technician/StationDetailPage.jsx'))
const InspectionsPage = lazy(() => import('./pages/technician/InspectionsPage.jsx'))
const NotificationsPage = lazy(() => import('./pages/notifications/NotificationsPage.jsx'))
const SearchPage = lazy(() => import('./pages/search/SearchPage.jsx'))
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage.jsx'))
const MapPage = lazy(() => import('./pages/shared/MapPage.jsx'))
const FieldDetailPage = lazy(() => import('./pages/shared/FieldDetailPage.jsx'))
const TechniciansPage = lazy(() => import('./pages/manager/TechniciansPage.jsx'))
const FieldsPage = lazy(() => import('./pages/manager/FieldsPage.jsx'))
const FieldMapEditorPage = lazy(() => import('./pages/manager/FieldMapEditorPage.jsx'))
const SeasonReportsPage = lazy(() => import('./pages/manager/SeasonReportsPage.jsx'))
const TraceabilityPage = lazy(() => import('./pages/manager/TraceabilityPage.jsx'))
const FarmersPage = lazy(() => import('./pages/manager/FarmersPage.jsx'))
const StaffUsersPage = lazy(() =>
  import('./pages/admin/UsersPage.jsx').then((m) => ({ default: m.StaffUsersPage })),
)
const FarmerUsersPage = lazy(() =>
  import('./pages/admin/UsersPage.jsx').then((m) => ({ default: m.FarmerUsersPage })),
)
const OrganizationsPage = lazy(() => import('./pages/admin/OrganizationsPage.jsx'))
const DevicesPage = lazy(() => import('./pages/admin/DevicesPage.jsx'))
const AiConfigPage = lazy(() => import('./pages/admin/AiConfigPage.jsx'))
const SystemMonitorPage = lazy(() => import('./pages/admin/SystemMonitorPage.jsx'))
const TrainingPage = lazy(() => import('./pages/admin/TrainingPage.jsx'))
const AuditLogPage = lazy(() => import('./pages/admin/AuditLogPage.jsx'))
const AssignmentsPage = lazy(() => import('./pages/admin/AssignmentsPage.jsx'))
const AdminAlertsPage = lazy(() => import('./pages/admin/AdminAlertsPage.jsx'))
const DiseasePlansPage = lazy(() => import('./pages/admin/DiseasePlansPage.jsx'))
const ArticlesListPage = lazy(() => import('./pages/articles/ArticlesListPage.jsx'))
const ArticleEditorPage = lazy(() => import('./pages/articles/ArticleEditorPage.jsx'))
const ArticleQuestionsPage = lazy(() => import('./pages/articles/ArticleQuestionsPage.jsx'))

function PageFallback() {
  return (
    <div className="rg-page-fallback">
      <span />
    </div>
  )
}

function HomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={homePath(user.role)} replace />
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route
          path="/login"
          element={
            <GuestRoute>
              <LoginPage />
            </GuestRoute>
          }
        />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/settings" element={<SettingsPage />} />

            <Route element={<RoleRoute roles={['technician']} />}>
              <Route path="/my-orgs" element={<MyOrgsPage />} />
            </Route>

            <Route element={<RoleRoute roles={['technician', 'admin']} />}>
              <Route path="/technician" element={<TechnicianDashboardPage />} />
              <Route path="/technician/map" element={<MapPage />} />
              <Route path="/technician/fields/:fieldId" element={<FieldDetailPage />} />
              <Route path="/technician/alerts" element={<AlertsPage />} />
              <Route path="/technician/sensors" element={<SensorsPage />} />
              <Route path="/technician/photos" element={<PhotosPage />} />
              <Route path="/technician/uav" element={<UavSurveysPage />} />
              <Route path="/technician/logs" element={<FieldLogsPage />} />
              <Route path="/technician/stations/:stationId" element={<StationDetailPage />} />
              <Route path="/technician/stations" element={<Navigate to="/technician/map" replace />} />
              <Route path="/technician/inspections" element={<InspectionsPage />} />
              <Route path="/technician/articles" element={<ArticlesListPage />} />
              <Route path="/technician/articles/new" element={<ArticleEditorPage />} />
              <Route path="/technician/articles/:articleId/edit" element={<ArticleEditorPage />} />
              <Route path="/technician/article-questions" element={<ArticleQuestionsPage />} />
            </Route>

            <Route element={<RoleRoute roles={['manager']} />}>
              <Route path="/manager" element={<ManagerDashboardPage />} />
              <Route path="/manager/technicians" element={<TechniciansPage />} />
              <Route path="/manager/fields/new" element={<FieldMapEditorPage />} />
              <Route path="/manager/fields/:fieldId/boundary" element={<FieldMapEditorPage />} />
              <Route path="/manager/fields/:fieldId" element={<FieldDetailPage />} />
              <Route path="/manager/fields" element={<FieldsPage />} />
              <Route path="/manager/season-reports" element={<SeasonReportsPage />} />
              <Route path="/manager/traceability" element={<TraceabilityPage />} />
              <Route path="/manager/farmers" element={<FarmersPage />} />
              <Route path="/manager/map" element={<MapPage />} />
            </Route>

            <Route element={<RoleRoute roles={['admin']} />}>
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/admin/users" element={<FarmerUsersPage />} />
              <Route path="/admin/staff" element={<StaffUsersPage />} />
              <Route path="/admin/organizations" element={<OrganizationsPage />} />
              <Route path="/admin/devices" element={<DevicesPage />} />
              <Route path="/admin/devices/:stationId" element={<StationDetailPage />} />
              <Route path="/admin/ai-config" element={<AiConfigPage />} />
              <Route path="/admin/system" element={<SystemMonitorPage />} />
              <Route path="/admin/training" element={<TrainingPage />} />
              <Route path="/admin/audit" element={<AuditLogPage />} />
              <Route path="/admin/assignments" element={<AssignmentsPage />} />
              <Route path="/admin/alerts" element={<AdminAlertsPage />} />
              <Route path="/admin/disease-plans" element={<DiseasePlansPage />} />
              <Route path="/admin/articles" element={<ArticlesListPage />} />
              <Route path="/admin/articles/new" element={<ArticleEditorPage />} />
              <Route path="/admin/articles/:articleId/edit" element={<ArticleEditorPage />} />
              <Route path="/admin/article-questions" element={<ArticleQuestionsPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
