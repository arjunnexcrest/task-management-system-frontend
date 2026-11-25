import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { Page as HomePage } from '@/modules/common/pages/HomePage'
import { Page as LoginPage } from '@/modules/accounts/pages/LoginPage'
import { Page as ForgotPasswordPage } from '@/modules/accounts/pages/ForgotPasswordPage'
import { Page as ResetPasswordPage } from '@/modules/accounts/pages/ResetPasswordPage'
import { Page as AccountActivationPage } from '@/modules/accounts/pages/AccountActivationPage'
import { Page as EmployeeListPage } from '@/modules/accounts/pages/EmployeeListPage'
import { Page as EmployeeProfilePage } from '@/modules/accounts/pages/EmployeeProfilePage'
import { Page as CompanyListPage } from '@/modules/companies/pages/CompanyListPage'
import { Page as CompanyDetailsPage } from '@/modules/companies/pages/CompanyDetailsPage'
import { Page as OrganizationChartPage } from '@/modules/organization/pages/OrganizationChartPage'
import { Page as DepartmentManagementPage } from '@/modules/organization/pages/DepartmentManagementPage'
import { Page as TeamManagementPage } from '@/modules/organization/pages/TeamManagementPage'
import { Page as RolePermissionPage } from '@/modules/rbac/pages/RolePermissionPage'
import { Page as ProjectListPage } from '@/modules/projects/pages/ProjectListPage'
import { Page as ProjectFormPage } from '@/modules/projects/pages/ProjectFormPage'
import { Page as ProjectOverviewPage } from '@/modules/projects/pages/ProjectOverviewPage'
import { Page as ProjectAssignmentPage } from '@/modules/projects/pages/ProjectAssignmentPage'
import { Page as ProjectTeamPage } from '@/modules/projects/pages/ProjectTeamPage'
import { Page as ProjectPlanningPage } from '@/modules/projects/pages/ProjectPlanningPage'
import { Page as ProjectMilestonesPage } from '@/modules/projects/pages/ProjectMilestonesPage'
import { Page as ProjectTimelinePage } from '@/modules/projects/pages/ProjectTimelinePage'
import { Page as TaskListPage } from '@/modules/tasks/pages/TaskListPage'
import { Page as MyTasksPage } from '@/modules/tasks/pages/MyTasksPage'
import { Page as TaskFormPage } from '@/modules/tasks/pages/TaskFormPage'
import { Page as TaskDetailsPage } from '@/modules/tasks/pages/TaskDetailsPage'
import { Page as KanbanBoardPage } from '@/modules/tasks/pages/KanbanBoardPage'
import { Page as CalendarViewPage } from '@/modules/tasks/pages/CalendarViewPage'
import { Page as WorkloadViewPage } from '@/modules/tasks/pages/WorkloadViewPage'
import { Page as TimeTrackingPage } from '@/modules/tracking/pages/TimeTrackingPage'
import { Page as DailyWorkLogPage } from '@/modules/tracking/pages/DailyWorkLogPage'
import { Page as ReviewQueuePage } from '@/modules/reviews/pages/ReviewQueuePage'
import { Page as NotificationsPage } from '@/modules/notifications/pages/NotificationsPage'
import { Page as CeoDashboardPage } from '@/modules/dashboards/pages/CeoDashboardPage'
import { Page as RoleDashboardPage } from '@/modules/dashboards/pages/RoleDashboardPage'
import { Page as ReportsPage } from '@/modules/reports/pages/ReportsPage'
import { Page as RiskRegisterPage } from '@/modules/risks/pages/RiskRegisterPage'
import { Page as SettingsPage } from '@/modules/system_settings/pages/SettingsPage'

export function AppRoutes() {
  return (
    <Routes>
      {/* Standalone Public Auth Pages (No Sidebar — shown before login) */}
      <Route path="login" element={<LoginPage />} />
      <Route path="forgot-password" element={<ForgotPasswordPage />} />
      <Route path="reset-password" element={<ResetPasswordPage />} />
      <Route path="activate" element={<AccountActivationPage />} />

      {/* Protected Dashboard Routes (Accessible ONLY after login + RBAC guarded) */}
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<HomePage />} />

        {/* Dashboards */}
        <Route
          path="dashboards/ceo"
          element={
            <ProtectedRoute requiredCapability="can_view_ceo_dashboard">
              <CeoDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route path="dashboards/role" element={<RoleDashboardPage />} />

        {/* Organization & Governance */}
        <Route
          path="companies"
          element={
            <ProtectedRoute requiredCapability="can_view_companies">
              <CompanyListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="companies/:id"
          element={
            <ProtectedRoute requiredCapability="can_view_companies">
              <CompanyDetailsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="employees"
          element={
            <ProtectedRoute requiredCapability="can_view_employees">
              <EmployeeListPage />
            </ProtectedRoute>
          }
        />
        <Route path="employees/:id" element={<EmployeeProfilePage />} />
        <Route
          path="organization"
          element={
            <ProtectedRoute requiredCapability="can_view_employees">
              <OrganizationChartPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="departments"
          element={
            <ProtectedRoute requiredCapability="can_view_departments">
              <DepartmentManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="teams"
          element={
            <ProtectedRoute requiredCapability="can_view_teams">
              <TeamManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="rbac"
          element={
            <ProtectedRoute requiredCapability="can_manage_rbac">
              <RolePermissionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="settings"
          element={
            <ProtectedRoute requiredCapability="can_manage_settings">
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        {/* Projects */}
        <Route path="projects" element={<ProjectListPage />} />
        <Route
          path="projects/new"
          element={
            <ProtectedRoute requiredCapability="can_create_projects">
              <ProjectFormPage />
            </ProtectedRoute>
          }
        />
        <Route path="projects/:id" element={<ProjectOverviewPage />} />
        <Route
          path="projects/:id/edit"
          element={
            <ProtectedRoute requiredCapability="can_edit_projects">
              <ProjectFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="projects/:id/assignments"
          element={
            <ProtectedRoute requiredCapability="can_manage_project_assignments">
              <ProjectAssignmentPage />
            </ProtectedRoute>
          }
        />
        <Route path="projects/:id/team" element={<ProjectTeamPage />} />
        <Route path="projects/:id/planning" element={<ProjectPlanningPage />} />
        <Route path="projects/:id/milestones" element={<ProjectMilestonesPage />} />
        <Route path="projects/:id/timeline" element={<ProjectTimelinePage />} />

        {/* Tasks & Execution */}
        <Route path="tasks" element={<TaskListPage />} />
        <Route path="tasks/mine" element={<MyTasksPage />} />
        <Route
          path="tasks/new"
          element={
            <ProtectedRoute requiredCapability="can_create_tasks">
              <TaskFormPage />
            </ProtectedRoute>
          }
        />
        <Route path="tasks/:id" element={<TaskDetailsPage />} />
        <Route
          path="tasks/:id/edit"
          element={
            <ProtectedRoute requiredCapability="can_edit_tasks">
              <TaskFormPage />
            </ProtectedRoute>
          }
        />
        <Route path="kanban" element={<KanbanBoardPage />} />
        <Route path="calendar" element={<CalendarViewPage />} />
        <Route
          path="workload"
          element={
            <ProtectedRoute requiredCapability="can_view_workload">
              <WorkloadViewPage />
            </ProtectedRoute>
          }
        />

        {/* Tracking, Reviews, Reports, Risks, Notifications */}
        <Route path="tracking" element={<TimeTrackingPage />} />
        <Route path="work-log" element={<DailyWorkLogPage />} />
        <Route
          path="reviews"
          element={
            <ProtectedRoute requiredCapability="can_review_tasks">
              <ReviewQueuePage />
            </ProtectedRoute>
          }
        />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route
          path="reports"
          element={
            <ProtectedRoute requiredCapability="can_view_reports">
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="risks"
          element={
            <ProtectedRoute requiredCapability="can_manage_risks">
              <RiskRegisterPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
