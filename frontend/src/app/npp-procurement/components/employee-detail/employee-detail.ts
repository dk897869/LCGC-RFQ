import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface EmployeeDetailRow {
  fullName: string;
  id: string;
  emailAddress: string;
  password: string;
  designation: string;
  department: string;
  contactNo: string;
  dateOfBirth: string;
  organization: string;
  reportingHead: string;
  reportingDesignation: string;
  isEditing?: boolean;
}

@Component({
  selector: 'app-employee-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './employee-detail.html',
  styleUrls: ['./employee-detail.scss']
})
export class EmployeeDetailComponent implements OnInit {
  employeeList: EmployeeDetailRow[] = [];
  filteredEmployees: EmployeeDetailRow[] = [];
  
  searchTerm: string = '';
  departmentFilter: string = '';
  designationFilter: string = '';
  
  showAddModal: boolean = false;
  showEditModal: boolean = false;
  showDeleteConfirm: boolean = false;
  selectedEmployee: EmployeeDetailRow | null = null;
  deleteIndex: number = -1;
  
  newEmployee: EmployeeDetailRow = this.getEmptyEmployee();
  
  departments: string[] = ['Purchase', 'IT', 'HR', 'Finance', 'Operations', 'Sales', 'Marketing', 'R&D', 'Quality', 'Logistics', 'Production', 'Engineering'];
  designations: string[] = ['Manager', 'Senior Manager', 'Head - Purchase', 'VP', 'GM', 'Director', 'Executive', 'Senior Executive', 'Analyst', 'Engineer', 'Associate', 'Coordinator'];
  
  showToast: boolean = false;
  toastMessage: string = '';
  toastType: string = 'success';
  isLoading: boolean = false;

  constructor() {}

  ngOnInit() {
    this.loadSampleData();
    this.applyFilters();
  }

  private getEmptyEmployee(): EmployeeDetailRow {
    return {
      fullName: '',
      id: '',
      emailAddress: '',
      password: '',
      designation: '',
      department: '',
      contactNo: '',
      dateOfBirth: '',
      organization: 'Radiant Appliances',
      reportingHead: '',
      reportingDesignation: '',
      isEditing: false
    };
  }

  private loadSampleData() {
    this.isLoading = true;
    // Simulate API call
    setTimeout(() => {
      this.employeeList = [
        {
          fullName: 'Vijay Deep Parashar',
          id: 'EMP001',
          emailAddress: 'vijay.parashar@radiantappliances.com',
          password: '********',
          designation: 'Head - Purchase',
          department: 'Purchase',
          contactNo: '8806668006',
          dateOfBirth: '1982-02-02',
          organization: 'Radiant Appliances',
          reportingHead: 'CEO Office',
          reportingDesignation: 'VP-Operation'
        },
        {
          fullName: 'Ravib',
          id: 'EMP002',
          emailAddress: 'ravib@radiantappliances.com',
          password: '********',
          designation: 'A-GM',
          department: 'Operations',
          contactNo: '9876543210',
          dateOfBirth: '1985-05-15',
          organization: 'Radiant Appliances',
          reportingHead: 'Vijay Deep Parashar',
          reportingDesignation: 'Head - Purchase'
        },
        {
          fullName: 'Shailendra Chothe',
          id: 'EMP003',
          emailAddress: 'shailendra.chothe@radiantappliances.com',
          password: '********',
          designation: 'VP',
          department: 'Finance',
          contactNo: '9876543211',
          dateOfBirth: '1980-08-20',
          organization: 'Radiant Appliances',
          reportingHead: 'CEO Office',
          reportingDesignation: 'VP-Finance'
        },
        {
          fullName: 'Sanjay Munshi',
          id: 'EMP004',
          emailAddress: 'sanjay.munshi@radiantappliances.com',
          password: '********',
          designation: 'S-VP',
          department: 'Operations',
          contactNo: '9876543212',
          dateOfBirth: '1978-03-10',
          organization: 'Radiant Appliances',
          reportingHead: 'CEO Office',
          reportingDesignation: 'S-VP Operations'
        },
        {
          fullName: 'Wang Xianwen',
          id: 'EMP005',
          emailAddress: 'wang.xianwen@radiantappliances.com',
          password: '********',
          designation: 'GM',
          department: 'General',
          contactNo: '9876543213',
          dateOfBirth: '1975-11-25',
          organization: 'Radiant Appliances',
          reportingHead: 'CEO Office',
          reportingDesignation: 'GM'
        },
        {
          fullName: 'Deepak Kumar',
          id: 'EMP006',
          emailAddress: 'deepak.kumar@radiantappliances.com',
          password: '********',
          designation: 'Senior Manager',
          department: 'IT',
          contactNo: '9876543214',
          dateOfBirth: '1990-05-07',
          organization: 'Radiant Appliances',
          reportingHead: 'CTO Office',
          reportingDesignation: 'CTO'
        }
      ];
      this.applyFilters();
      this.isLoading = false;
    }, 500);
  }

  applyFilters() {
    let filtered = [...this.employeeList];
    
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(emp =>
        emp.fullName.toLowerCase().includes(term) ||
        emp.id.toLowerCase().includes(term) ||
        emp.emailAddress.toLowerCase().includes(term) ||
        emp.department.toLowerCase().includes(term) ||
        emp.designation.toLowerCase().includes(term) ||
        emp.contactNo.includes(term)
      );
    }
    
    if (this.departmentFilter) {
      filtered = filtered.filter(emp => emp.department === this.departmentFilter);
    }
    
    if (this.designationFilter) {
      filtered = filtered.filter(emp => emp.designation === this.designationFilter);
    }
    
    this.filteredEmployees = filtered;
  }

  clearFilters() {
    this.searchTerm = '';
    this.departmentFilter = '';
    this.designationFilter = '';
    this.applyFilters();
    this.showMessage('Filters cleared', 'success');
  }

  openAddModal() {
    this.newEmployee = this.getEmptyEmployee();
    this.showAddModal = true;
  }

  closeAddModal() {
    this.showAddModal = false;
    this.newEmployee = this.getEmptyEmployee();
  }

  addEmployee() {
    if (!this.validateEmployee(this.newEmployee)) {
      return;
    }
    
    // Generate new ID
    const maxId = Math.max(...this.employeeList.map(e => parseInt(e.id.replace('EMP', ''))), 0);
    const newId = `EMP${(maxId + 1).toString().padStart(3, '0')}`;
    this.newEmployee.id = newId;
    
    this.employeeList.push({ ...this.newEmployee });
    this.applyFilters();
    this.closeAddModal();
    this.showMessage('Employee added successfully!', 'success');
  }

  openEditModal(employee: EmployeeDetailRow) {
    this.selectedEmployee = { ...employee };
    this.showEditModal = true;
  }

  closeEditModal() {
    this.showEditModal = false;
    this.selectedEmployee = null;
  }

  updateEmployee() {
    if (!this.selectedEmployee || !this.validateEmployee(this.selectedEmployee)) {
      return;
    }
    
    const index = this.employeeList.findIndex(e => e.id === this.selectedEmployee!.id);
    if (index !== -1) {
      this.employeeList[index] = { ...this.selectedEmployee };
      this.applyFilters();
      this.showMessage('Employee updated successfully!', 'success');
    }
    this.closeEditModal();
  }

  confirmDelete(employee: EmployeeDetailRow, index: number) {
    this.selectedEmployee = employee;
    this.deleteIndex = index;
    this.showDeleteConfirm = true;
  }

  deleteEmployee() {
    if (this.deleteIndex !== -1) {
      this.employeeList.splice(this.deleteIndex, 1);
      this.applyFilters();
      this.showMessage('Employee deleted successfully!', 'success');
    }
    this.showDeleteConfirm = false;
    this.selectedEmployee = null;
    this.deleteIndex = -1;
  }

  cancelDelete() {
    this.showDeleteConfirm = false;
    this.selectedEmployee = null;
    this.deleteIndex = -1;
  }

  private validateEmployee(emp: EmployeeDetailRow): boolean {
    if (!emp.fullName.trim()) {
      this.showMessage('Full Name is required', 'error');
      return false;
    }
    if (!emp.emailAddress.trim() || !emp.emailAddress.includes('@')) {
      this.showMessage('Valid Email Address is required', 'error');
      return false;
    }
    if (!emp.department) {
      this.showMessage('Department is required', 'error');
      return false;
    }
    if (!emp.designation) {
      this.showMessage('Designation is required', 'error');
      return false;
    }
    if (!emp.contactNo.trim() || emp.contactNo.length < 10) {
      this.showMessage('Valid Contact Number is required (10+ digits)', 'error');
      return false;
    }
    return true;
  }

  showMessage(message: string, type: 'success' | 'error') {
    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;
    setTimeout(() => {
      this.showToast = false;
    }, 3000);
  }

  exportToExcel() {
    const rows = this.filteredEmployees.map(emp => ({
      'Full Name': emp.fullName,
      'ID': emp.id,
      'Email Address': emp.emailAddress,
      'Designation': emp.designation,
      'Department': emp.department,
      'Contact No': emp.contactNo,
      'Date of Birth': emp.dateOfBirth,
      'Organization': emp.organization,
      'Reporting Head': emp.reportingHead,
      'Reporting Designation': emp.reportingDesignation
    }));
    
    console.log('Export to Excel:', rows);
    this.showMessage('Export started! Check console for data.', 'success');
  }

  getDepartmentCount(dept: string): number {
    return this.employeeList.filter(e => e.department === dept).length;
  }

  getTotalEmployees(): number {
    return this.employeeList.length;
  }

  getDesignationCount(desig: string): number {
    return this.employeeList.filter(e => e.designation === desig).length;
  }
}