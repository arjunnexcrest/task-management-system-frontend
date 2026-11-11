/** Shared domain types — expand as API contracts stabilize. */

export type RoleName =
  | 'CEO'
  | 'CompanyInCharge'
  | 'ProjectManager'
  | 'DepartmentHead'
  | 'TeamLeader'
  | 'Employee'

export type ProjectStatus =
  | 'Draft'
  | 'Planned'
  | 'Active'
  | 'OnHold'
  | 'AtRisk'
  | 'Delayed'
  | 'Completed'
  | 'Cancelled'
  | 'Archived'

export type TaskStatus =
  | 'Backlog'
  | 'ToDo'
  | 'Assigned'
  | 'InProgress'
  | 'OnHold'
  | 'Blocked'
  | 'InReview'
  | 'ChangesRequested'
  | 'Approved'
  | 'Completed'
  | 'Cancelled'

export type TaskPriority = 'Critical' | 'High' | 'Medium' | 'Low'

export type StubModule = {
  id: string
  title: string
  description: string
  path: string
}
