// Central mock data for the Sentinel Field FSM platform.
// Realistic enterprise data across all three roles.

export type Role = 'admin' | 'supervisor' | 'technician';

export type WOStatus = 'open' | 'scheduled' | 'in_progress' | 'paused' | 'completed' | 'cancelled';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type ServiceType =
  | 'CCTV'
  | 'Access Control'
  | 'Fire Alarm'
  | 'Fire Water'
  | 'BMS'
  | 'Electronic Security';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  title: string;
  phone: string;
  status: 'active' | 'suspended';
  lastLogin: string;
  avatarColor: string;
  initials: string;
  region: string;
}

export interface WorkOrder {
  id: string;
  code: string;
  client: string;
  site: string;
  address: string;
  serviceType: ServiceType;
  priority: Priority;
  status: WOStatus;
  technicianId?: string;
  supervisorId: string;
  scheduledDate: string; // ISO date
  scheduledTime: string; // HH:mm
  durationHrs: number;
  description: string;
  equipment: string;
  createdAt: string;
  progress: number;
  checklist?: ChecklistItem[];
  materials?: Material[];
  comments?: Comment[];
  history?: HistoryEntry[];
}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface Material {
  id: string;
  name: string;
  sku: string;
  qty: number;
  unit: string;
}

export interface Comment {
  id: string;
  author: string;
  initials: string;
  avatarColor: string;
  time: string;
  text: string;
}

export interface HistoryEntry {
  id: string;
  action: string;
  actor: string;
  time: string;
}

export const currentUser: Record<Role, User> = {
  admin: {
    id: 'u-001', name: 'Rachel Whitman', email: 'rachel.whitman@selecom.com',
    role: 'admin', title: 'System Administrator', phone: '+51 915 550 182',
    status: 'active', lastLogin: '2026-08-07 08:14', avatarColor: 'bg-primary-600',
    initials: 'RW', region: 'surco',
  },
  supervisor: {
    id: 'u-014', name: 'Marcus Delgado', email: 'marcus.delgado@selecom.com',
    role: 'supervisor', title: ' Supervisor ', phone: '+51 915 550 144',
    status: 'active', lastLogin: '2026-08-07 07:42', avatarColor: 'bg-emerald-600',
    initials: 'MD', region: 'surco',
  },
  technician: {
    id: 'u-031', name: 'Daniel Okafor', email: 'daniel.okafor@selecom.com',
    role: 'technician', title: ' Technician', phone: '+51 915 550 173',
    status: 'active', lastLogin: '2026-08-07 06:55', avatarColor: 'bg-amber-600',
    initials: 'DO', region: 'surquillo',
  },
};

export const users: User[] = [
  { id: 'u-001', name: 'Rachel Whitman', email: 'rachel.whitman@selecom.com', role: 'admin', title: 'System Administrator', phone: '+51 955 220 182', status: 'active', lastLogin: '2026-08-07 08:14', avatarColor: 'bg-primary-600', initials: 'RW', region: 'HQ — San Francisco' },
  { id: 'u-002', name: 'Aisha Karim', email: 'aisha.karim@selecom.com', role: 'admin', title: 'IT Operations Lead', phone: '+51 915 550 119', status: 'active', lastLogin: '2026-08-06 17:22', avatarColor: 'bg-indigo-600', initials: 'AK', region: 'HQ — San Francisco' },
  { id: 'u-003', name: 'Thomas Reyes', email: 'thomas.reyes@selecom.com', role: 'admin', title: 'Compliance Officer', phone: '+51 915 551 103', status: 'suspended', lastLogin: '2026-07-29 11:08', avatarColor: 'bg-slate-600', initials: 'TR', region: 'HQ — San Francisco' },
  { id: 'u-011', name: 'Marcus Delgado', email: 'marcus.delgado@selecom.com', role: 'supervisor', title: 'Field Supervisor — North Bay', phone: '+51 915 555 144', status: 'active', lastLogin: '2026-08-07 07:42', avatarColor: 'bg-emerald-600', initials: 'MD', region: 'North Bay District' },
  { id: 'u-012', name: 'Sofia Bergstrom', email: 'sofia.bergstrom@selecom.com', role: 'supervisor', title: 'Field Supervisor — East Bay', phone: '+51 905 550 156', status: 'active', lastLogin: '2026-08-07 07:18', avatarColor: 'bg-teal-600', initials: 'SB', region: 'East Bay District' },
  { id: 'u-013', name: 'Henrik Lund', email: 'henrik.lund@selecom.com', role: 'supervisor', title: 'Field Supervisor — South Bay', phone: '+51 908 555 167', status: 'active', lastLogin: '2026-08-06 18:40', avatarColor: 'bg-cyan-600', initials: 'HL', region: 'South Bay District' },
  { id: 'u-031', name: 'Daniel Okafor', email: 'daniel.okafor@selecom.com', role: 'technician', title: 'Senior Field Technician', phone: '+51 914 155 173', status: 'active', lastLogin: '2026-08-07 06:55', avatarColor: 'bg-amber-600', initials: 'DO', region: 'North Bay District' },
  { id: 'u-032', name: 'Priya Nair', email: 'priya.nair@selecom.com', role: 'technician', title: 'CCTV & Access Control Tech', phone: '+51 915 555 188', status: 'active', lastLogin: '2026-08-07 06:48', avatarColor: 'bg-rose-600', initials: 'PN', region: 'North Bay District' },
  { id: 'u-033', name: 'Liam Connolly', email: 'liam.connolly@selecom.com', role: 'technician', title: 'Fire Systems Technician', phone: '+51 915 555 192', status: 'active', lastLogin: '2026-08-07 06:31', avatarColor: 'bg-orange-600', initials: 'LC', region: 'East Bay District' },
  { id: 'u-034', name: 'Mei Tanaka', email: 'mei.tanaka@selecom.com', role: 'technician', title: 'BMS Specialist', phone: '+51 914 555 125', status: 'active', lastLogin: '2026-08-06 17:55', avatarColor: 'bg-violet-600', initials: 'MT', region: 'South Bay District' },
  { id: 'u-035', name: 'Oscar Martinez', email: 'oscar.martinez@selecom.com', role: 'technician', title: 'Electronic Security Tech', phone: '+51 914 555 147', status: 'active', lastLogin: '2026-08-06 16:40', avatarColor: 'bg-orange-600', initials: 'OM', region: 'North Bay District' },
  { id: 'u-036', name: 'Nadia Petrov', email: 'nadia.petrov@selecom.com', role: 'technician', title: 'Fire Water Systems Tech', phone: '+51 915 555 138', status: 'active', lastLogin: '2026-07-30 09:15', avatarColor: 'bg-orange-600', initials: 'NP', region: 'East Bay District' },
  { id: 'u-037', name: 'Ethan Brooks', email: 'ethan.brooks@selecom.com', role: 'technician', title: 'Junior Field Technician', phone: '+51 908 555 111', status: 'active', lastLogin: '2026-08-07 07:02', avatarColor: 'bg-lime-600', initials: 'EB', region: 'South Bay District' },
];

export const technicians = users.filter((u) => u.role === 'technician');
export const supervisors = users.filter((u) => u.role === 'supervisor');

export const workOrders: WorkOrder[] = [
  {
    id: 'wo-1001', code: 'WO-2026-1001', client: 'Harbor Gate Logistics', site: 'Warehouse 4 — Dock A',
    address: '1820 Maritime Blvd, Oakland, CA', serviceType: 'CCTV', priority: 'urgent', status: 'in_progress',
    technicianId: 'u-031', supervisorId: 'u-011', scheduledDate: '2026-08-07', scheduledTime: '09:00', durationHrs: 3,
    description: 'Camera 7 offline — suspected PSU failure on pole-mounted PTZ. Replace power unit and verify NVR recording.',
    equipment: 'Axis P3245-LVE PTZ × 1, Axis T8130 PoE Injector × 1', createdAt: '2026-08-05 14:20', progress: 45,
    checklist: [
      { id: 'c1', label: 'Site safety assessment completed', done: true },
      { id: 'c2', label: 'Isolated camera power circuit', done: true },
      { id: 'c3', label: 'Removed and tested failed PSU', done: true },
      { id: 'c4', label: 'Installed replacement PoE injector', done: false },
      { id: 'c5', label: 'Verified NVR recording stream', done: false },
      { id: 'c6', label: 'Client sign-off obtained', done: false },
    ],
    materials: [
      { id: 'm1', name: 'Axis T8130 PoE Injector', sku: 'AX-T8130', qty: 1, unit: 'pc' },
      { id: 'm2', name: 'Weatherproof junction box', sku: 'JB-WP-02', qty: 1, unit: 'pc' },
      { id: 'm3', name: 'Cat6 outdoor cable', sku: 'C6-OUT-100', qty: 8, unit: 'm' },
    ],
    comments: [
      { id: 'cm1', author: 'Marcus Delgado', initials: 'MD', avatarColor: 'bg-emerald-600', time: '08:55', text: 'Client confirmed dock access at Gate 3. Ask for Jorge on arrival.' },
      { id: 'cm2', author: 'Daniel Okafor', initials: 'DO', avatarColor: 'bg-amber-600', time: '09:30', text: 'On site. PSU smells burnt — will replace injector and re-run cable.' },
    ],
    history: [
      { id: 'h1', action: 'Work order created', actor: 'Marcus Delgado', time: 'Aug 5, 14:20' },
      { id: 'h2', action: 'Assigned to Daniel Okafor', actor: 'Marcus Delgado', time: 'Aug 5, 14:24' },
      { id: 'h3', action: 'Status changed to Scheduled', actor: 'System', time: 'Aug 5, 14:24' },
      { id: 'h4', action: 'Status changed to In Progress', actor: 'Daniel Okafor', time: 'Aug 7, 09:02' },
    ],
  },
  {
    id: 'wo-1002', code: 'WO-2026-1002', client: 'Medical Center', site: 'Block C — Cardiac Wing',
    address: '400 Bayview Way, San Francisco, CA', serviceType: 'Fire Alarm', priority: 'high', status: 'scheduled',
    technicianId: 'u-033', supervisorId: 'u-011', scheduledDate: '2026-08-07', scheduledTime: '11:00', durationHrs: 2.5,
    description: 'Quarterly inspection of addressable fire alarm panel. Test 12 smoke detectors and 4 pull stations in Cardiac Wing.',
    equipment: 'Hochiki ESP-200 addressable panel, Hochiki SPC-PCT smoke detectors × 12', createdAt: '2026-08-04 09:10', progress: 0,
  },
  {
    id: 'wo-1003', code: 'WO-2026-1003', client: 'Pacific Tower', site: 'Lobby & Level 12',
    address: '1 Northgate Plaza, San Francisco, CA', serviceType: 'Access Control', priority: 'medium', status: 'open',
    supervisorId: 'u-011', scheduledDate: '2026-08-08', scheduledTime: '10:00', durationHrs: 2,
    description: 'Recurring badge reader fault at lobby turnstile. Reader drops offline intermittently. Investigate cabling and controller.',
    equipment: 'HID iCLASS SE R40 reader, Mercury LP4502 controller', createdAt: '2026-08-06 16:45', progress: 0,
  },
  {
    id: 'wo-1004', code: 'WO-2026-1004', client: 'Banco - Data Center', site: 'Hall B — Racks 14-22',
    address: '920 Crestline Rd, Santa Clara, CA', serviceType: 'BMS', priority: 'high', status: 'scheduled',
    technicianId: 'u-034', supervisorId: 'u-013', scheduledDate: '2026-08-07', scheduledTime: '13:00', durationHrs: 4,
    description: 'Calibrate HVAC temperature sensors in Hall B. BMS reporting 2°C drift against reference. Replace 3 sensors.',
    equipment: 'Siemens Desigo PXC100 controller, QAA207 temperature sensors × 3', createdAt: '2026-08-05 11:30', progress: 0,
  },
  {
    id: 'wo-1005', code: 'WO-2026-1005', client: 'Pacific Logistics', site: 'Warehouse 4 — Pump Room',
    address: '1820 Maritime Blvd, Oakland, CA', serviceType: 'Fire Water', priority: 'urgent', status: 'open',
    supervisorId: 'u-012', scheduledDate: '2026-08-08', scheduledTime: '08:00', durationHrs: 3.5,
    description: 'Fire water pump failed weekly test run. Pressure not building. Possible impeller or jockey pump fault.',
    equipment: 'Aurora 491-C fire pump, jockey pump 50-A', createdAt: '2026-08-06 18:10', progress: 0,
  },
  {
    id: 'wo-1006', code: 'WO-2026-1006', client: 'Choquehuanca Apartments', site: 'Building 2 — All Floors',
    address: '55 Riverview Dr, Richmond, CA', serviceType: 'CCTV', priority: 'low', status: 'completed',
    technicianId: 'u-031', supervisorId: 'u-011', scheduledDate: '2026-08-05', scheduledTime: '10:00', durationHrs: 2,
    description: 'Preventive maintenance — clean camera housings, check lens focus, verify 30-day recording retention.',
    equipment: 'Dome cameras × 16, NVR DS-7716NI-K4', createdAt: '2026-08-01 09:00', progress: 100,
  },
  {
    id: 'wo-1007', code: 'WO-2026-1007', client: 'Medical Center', site: 'Block A — Reception',
    address: '400 Bayview Way, San Francisco, CA', serviceType: 'Electronic Security', priority: 'medium', status: 'completed',
    technicianId: 'u-031', supervisorId: 'u-011', scheduledDate: '2026-08-04', scheduledTime: '14:00', durationHrs: 1.5,
    description: 'Replace faulty door contact sensor at main reception. Recalibrate alarm zone.',
    equipment: 'Honeywell 958 contact sensor × 1', createdAt: '2026-08-02 10:15', progress: 100,
  },
  {
    id: 'wo-1008', code: 'WO-2026-1008', client: 'Piso 3 Data Center', site: 'Server Room 3',
    address: '920 Crestline Rd, Santa Clara, CA', serviceType: 'Access Control', priority: 'high', status: 'in_progress',
    technicianId: 'u-035', supervisorId: 'u-013', scheduledDate: '2026-08-07', scheduledTime: '15:00', durationHrs: 2,
    description: 'Biometric reader enrollment failing for 3 staff. Suspected firmware issue on multi-bio reader.',
    equipment: 'Suprema BioStation 3 × 1', createdAt: '2026-08-06 09:40', progress: 30,
  },
  {
    id: 'wo-1009', code: 'WO-2026-1009', client: 'Pacific Tower', site: 'Level 12 — Office Space',
    address: '1 Northgate Plaza, San Francisco, CA', serviceType: 'BMS', priority: 'low', status: 'completed',
    technicianId: 'u-034', supervisorId: 'u-013', scheduledDate: '2026-08-03', scheduledTime: '09:00', durationHrs: 3,
    description: 'Monthly BMS trend report review and setpoint optimization for office floors.',
    equipment: 'Siemens Desigo CC dashboard', createdAt: '2026-07-30 12:00', progress: 100,
  },
  {
    id: 'wo-1010', code: 'WO-2026-1010', client: 'Choquehuanca Apartments', site: 'Building 1 — Basement',
    address: '55 Riverview Dr, Richmond, CA', serviceType: 'Fire Water', priority: 'medium', status: 'scheduled',
    technicianId: 'u-031', supervisorId: 'u-011', scheduledDate: '2026-08-09', scheduledTime: '09:00', durationHrs: 2,
    description: 'Annual sprinkler valve inspection and flow test. Replace worn gaskets on 2 control valves.',
    equipment: 'Tyco CV-1 valves × 2', createdAt: '2026-08-05 15:20', progress: 0,
  },
  {
    id: 'wo-1011', code: 'WO-2026-1011', client: 'Pacific Logistics', site: 'Perimeter Fence',
    address: '1820 Maritime Blvd, Oakland, CA', serviceType: 'CCTV', priority: 'medium', status: 'open',
    supervisorId: 'u-012', scheduledDate: '2026-08-10', scheduledTime: '08:00', durationHrs: 4,
    description: 'Install 4 new perimeter cameras along north fence line. Trenching completed by contractor.',
    equipment: 'Axis P3245-LVE × 4, poles × 4', createdAt: '2026-08-06 11:00', progress: 0,
  },
  {
    id: 'wo-1012', code: 'WO-2026-1012', client: 'Medical Center', site: 'Block C — Cardiac Wing',
    address: '400 Bayview Way, San Francisco, CA', serviceType: 'Fire Alarm', priority: 'urgent', status: 'paused',
    technicianId: 'u-033', supervisorId: 'u-011', scheduledDate: '2026-08-06', scheduledTime: '13:00', durationHrs: 2,
    description: 'Smoke detector in Room C204 false-activating. Paused awaiting replacement head from supplier.',
    equipment: 'Hochiki SPC-PCT × 1', createdAt: '2026-08-04 08:00', progress: 60,
  },
];

export const documents = [
  { id: 'd1', name: ' Installation Manual.pdf', type: 'Manual', size: '4.2 MB', uploaded: 'Aug 5', by: 'Aisha Karim', category: 'CCTV' },
  { id: 'd2', name: 'Single input module Guide.pdf', type: 'Manual', size: '6.1 MB', uploaded: 'Aug 4', by: 'Marcus Delgado', category: 'Fire Alarm' },
  { id: 'd3', name: 'Harbor Gate — As-Built Drawings.pdf', type: 'Drawing', size: '12.4 MB', uploaded: 'Aug 3', by: 'Sofia Bergstrom', category: 'Site' },
  { id: 'd4', name: 'Sede Lima Preventive Maintenance Schedule.xlsx', type: 'Schedule', size: '248 KB', uploaded: 'Aug 1', by: 'Rachel Whitman', category: 'Operations' },
  { id: 'd5', name: 'Inspection Form — kide.pdf', type: 'Form', size: '1.8 MB', uploaded: 'Aug 6', by: 'Liam Connolly', category: 'Fire Alarm' },
  { id: 'd6', name: 'Inspection Data Center — BMS Trend Report.pdf', type: 'Report', size: '3.3 MB', uploaded: 'Aug 3', by: 'Mei Tanaka', category: 'BMS' },
  { id: 'd7', name: 'Simulation — Aug 2026.pdf', type: 'Record', size: '720 KB', uploaded: 'Aug 2', by: 'Aisha Karim', category: 'Procurement' },
  { id: 'd8', name: 'Riverview Apartments — Maintenance Contract.pdf', type: 'Contract', size: '2.1 MB', uploaded: 'Jul 28', by: 'Rachel Whitman', category: 'Legal' },
];

export const notifications = [
  { id: 'n1', title: 'Urgent work order created', body: 'Camara.', time: '12 min ago', unread: true, color: 'bg-red-500' },
  { id: 'n2', title: 'Work order paused', body: 'Update information.', time: '1 hr ago', unread: true, color: 'bg-amber-500' },
  { id: 'n3', title: 'Document uploaded', body: 'Mobility form.', time: '2 hr ago', unread: true, color: 'bg-primary-500' },
  { id: 'n4', title: 'Job completed', body: 'Choquehuanca Apartments CCTV PM completed.', time: '5 hr ago', unread: false, color: 'bg-emerald-500' },
  { id: 'n5', title: 'New login', body: 'New user.', time: 'Yesterday', unread: false, color: 'bg-ink-400' },
];

export const recentActivities = [
  { id: 'a1', action: 'Completed work order', detail: 'WO-2026-1006 — Riverview Apartments CCTV PM', actor: 'Daniel Okafor', time: 'Aug 5, 16:22', color: 'bg-emerald-500' },
  { id: 'a2', action: 'Created work order', detail: 'WO-2026-1005 — Harbor Gate fire water pump', actor: 'Sofia Bergstrom', time: 'Aug 6, 18:10', color: 'bg-primary-500' },
  { id: 'a3', action: 'Paused work order', detail: 'WO-2026-1012 — Bayview detector replacement', actor: 'Liam Connolly', time: 'Aug 6, 14:40', color: 'bg-amber-500' },
  { id: 'a4', action: 'Uploaded document', detail: 'NFPA 72 Inspection Form — Bayview.pdf', actor: 'Liam Connolly', time: 'Aug 6, 11:15', color: 'bg-violet-500' },
  { id: 'a5', action: 'Assigned technician', detail: 'WO-2026-1004 assigned to Mei Tanaka', actor: 'Henrik Lund', time: 'Aug 5, 11:35', color: 'bg-teal-500' },
  { id: 'a6', action: 'Updated permissions', detail: 'Technician role — added Forms module access', actor: 'Rachel Whitman', time: 'Aug 4, 09:50', color: 'bg-ink-500' },
];

export const auditLogs = [
  { id: 'al1', actor: 'Rachel Whitman', action: 'USER_ROLE_CHANGED', target: 'Thomas Reyes (u-003)', detail: 'role admin → suspended', ip: '10.0.4.18', time: 'Aug 6, 17:41' },
  { id: 'al2', actor: 'Aisha Karim', action: 'SYSTEM_BACKUP', target: 'full-snapshot', detail: '4.2 GB, success', ip: '10.0.4.22', time: 'Aug 6, 02:00' },
  { id: 'al3', actor: 'Marcus Delgado', action: 'WORK_ORDER_CREATED', target: 'WO-2026-1001', detail: 'CCTV / urgent', ip: '10.0.6.51', time: 'Aug 5, 14:20' },
  { id: 'al4', actor: 'Daniel Okafor', action: 'WORK_ORDER_STATUS', target: 'WO-2026-1001', detail: 'open → in_progress', ip: '10.4.7.12', time: 'Aug 7, 09:02' },
  { id: 'al5', actor: 'Rachel Whitman', action: 'POLICY_UPDATED', target: 'Technician role', detail: 'enabled forms.read, forms.write', ip: '10.0.4.18', time: 'Aug 4, 09:50' },
  { id: 'al6', actor: 'Sofia Bergstrom', action: 'WORK_ORDER_CREATED', target: 'WO-2026-1005', detail: 'Fire Water / urgent', ip: '10.0.6.88', time: 'Aug 6, 18:10' },
  { id: 'al7', actor: 'System', action: 'LOGIN_FAILED', target: 'unknown@extern', detail: '3 attempts, locked', ip: '203.0.113.45', time: 'Aug 6, 22:14' },
];

export const monthlyWO = [
  { month: 'Feb', value: 64 },
  { month: 'Mar', value: 78 },
  { month: 'Apr', value: 71 },
  { month: 'May', value: 92 },
  { month: 'Jun', value: 88 },
  { month: 'Jul', value: 104 },
  { month: 'Aug', value: 67 },
];

export const woByType = [
  { type: 'CCTV', value: 38, color: '#2563eb' },
  { type: 'Access Control', value: 24, color: '#0891b2' },
  { type: 'Fire Alarm', value: 29, color: '#dc2626' },
  { type: 'Fire Water', value: 14, color: '#ea580c' },
  { type: 'BMS', value: 19, color: '#7c3aed' },
  { type: 'Electronic Sec.', value: 22, color: '#16a34a' },
];

export const techPerformance = [
  { name: 'D. Okafor', completed: 28, sla: 96, initials: 'DO', color: 'bg-amber-500' },
  { name: 'L. Connolly', completed: 22, sla: 91, initials: 'LC', color: 'bg-orange-500' },
  { name: 'M. Tanaka', completed: 19, sla: 98, initials: 'MT', color: 'bg-violet-500' },
  { name: 'P. Nair', completed: 24, sla: 93, initials: 'PN', color: 'bg-rose-500' },
  { name: 'O. Martinez', completed: 17, sla: 88, initials: 'OM', color: 'bg-blue-500' },
];

export const modules = ['Dashboard', 'Work Orders', 'Calendar', 'Users', 'Roles', 'Documents', 'Reports', 'Audit Logs', 'Forms', 'System Settings'];
export const features = ['Create', 'Read', 'Update', 'Delete', 'Assign', 'Export', 'Approve'];

export const roles = [
  { name: 'Administrator', users: 3, desc: 'Full system control' },
  { name: 'Supervisor', users: 3, desc: 'Manage technicians & schedule' },
  { name: 'Technician', users: 7, desc: 'Execute assigned work orders' },
  { name: 'Auditor', users: 1, desc: 'Read-only compliance access' },
];

// technician forms
export const forms = [
  { id: 'f1', name: 'Mobility Form', desc: 'Submit vehicle usage and mileage', status: 'available', icon: 'Car' },
  { id: 'f2', name: 'Medical Leave Form', desc: 'Request medical leave of absence', status: 'available', icon: 'HeartPulse' },
  { id: 'f3', name: 'Complaint Form', desc: 'Log a service or workplace complaint', status: 'available', icon: 'MessageSquareWarning' },
  { id: 'f4', name: 'Expense Claim', desc: 'Claim reimbursable field expenses', status: 'available', icon: 'Receipt' },
];

export const technicianHistory = [
  { id: 'h1', code: 'WO-2026-1006', client: 'Riverview Apartments', type: 'CCTV', date: 'Aug 5', status: 'completed', rating: 5 },
  { id: 'h2', code: 'WO-2026-1007', client: 'Bayview Medical Center', type: 'Electronic Security', date: 'Aug 4', status: 'completed', rating: 5 },
  { id: 'h3', code: 'WO-2026-0987', client: 'Northgate Tower', type: 'Access Control', date: 'Jul 29', status: 'completed', rating: 4 },
  { id: 'h4', code: 'WO-2026-0971', client: 'Crestline Data Center', type: 'CCTV', date: 'Jul 22', status: 'completed', rating: 5 },
  { id: 'h5', code: 'WO-2026-0955', client: 'Harbor Gate Logistics', type: 'Fire Water', date: 'Jul 15', status: 'completed', rating: 4 },
];

export function statusColor(s: WOStatus): string {
  switch (s) {
    case 'open': return 'bg-ink-100 text-ink-700';
    case 'scheduled': return 'bg-primary-50 text-primary-700';
    case 'in_progress': return 'bg-blue-50 text-blue-700';
    case 'paused': return 'bg-amber-50 text-amber-700';
    case 'completed': return 'bg-emerald-50 text-emerald-700';
    case 'cancelled': return 'bg-red-50 text-red-700';
  }
}

export function priorityColor(p: Priority): string {
  switch (p) {
    case 'low': return 'bg-ink-100 text-ink-600';
    case 'medium': return 'bg-sky-50 text-sky-700';
    case 'high': return 'bg-orange-50 text-orange-700';
    case 'urgent': return 'bg-red-50 text-red-700';
  }
}

export function statusLabel(s: WOStatus): string {
  return s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function serviceColor(t: ServiceType): string {
  switch (t) {
    case 'CCTV': return 'bg-primary-100 text-primary-700';
    case 'Access Control': return 'bg-cyan-100 text-cyan-700';
    case 'Fire Alarm': return 'bg-red-100 text-red-700';
    case 'Fire Water': return 'bg-orange-100 text-orange-700';
    case 'BMS': return 'bg-violet-100 text-violet-700';
    case 'Electronic Security': return 'bg-emerald-100 text-emerald-700';
  }
}
