import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuditLogService, AuditLogEntry, AuditLogResponse } from '../../services/audit-log';

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './audit-log.html',
  styleUrls: ['./audit-log.scss']
})
export class AuditLogPage implements OnInit {
  entries: AuditLogEntry[] = [];
  actions: { action: string; count: number }[] = [];

  loading = true;
  error = '';

  // Filters
  selectedAction = '';
  userIdFilter = '';

  // Pagination
  currentPage = 1;
  totalPages = 1;
  totalItems = 0;
  limit = 20;

  constructor(private auditLogService: AuditLogService) {}

  ngOnInit() {
    this.loadActions();
    this.loadData();
  }

  loadActions() {
    this.auditLogService.getActions().subscribe({
      next: (actions) => {
        this.actions = actions;
      },
      error: (err) => console.error('Failed to load actions', err)
    });
  }

  loadData() {
    this.loading = true;
    this.error = '';

    const params: any = {
      page: this.currentPage,
      limit: this.limit
    };

    if (this.selectedAction) params.action = this.selectedAction;
    if (this.userIdFilter) params.user_id = parseInt(this.userIdFilter, 10);

    this.auditLogService.getAll(params).subscribe({
      next: (response: any) => {
        //pag
        if (response.logs && Array.isArray(response.logs)) {
          this.entries = response.logs;
          this.totalItems = response.pagination?.total || response.logs.length;
          this.totalPages = response.pagination?.total_pages || Math.ceil(this.totalItems / this.limit) || 1;
        } else if (response.data && Array.isArray(response.data)) {
          this.entries = response.data;
          this.totalItems = response.pagination?.total || response.data.length;
          this.totalPages = response.pagination?.total_pages || Math.ceil(this.totalItems / this.limit) || 1;
        } else if (Array.isArray(response)) {
          this.entries = response;
          this.totalItems = response.length;
          this.totalPages = 1;
        } else {
          this.entries = [];
          this.totalItems = 0;
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Audit log error:', err);
        this.error = 'Failed to load audit log data';
        this.loading = false;
      }
    });
  }

  applyFilters() {
    this.currentPage = 1;
    this.loadData();
  }

  clearFilters() {
    this.selectedAction = '';
    this.userIdFilter = '';
    this.currentPage = 1;
    this.loadData();
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadData();
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadData();
    }
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadData();
    }
  }

  exportPdf() {
    this.auditLogService.exportPdf().subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-log-${new Date().toISOString().split('T')[0]}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Export failed:', err);
        alert('Failed to export PDF');
      }
    });
  }

  formatDate(timestamp: string): string {
    return new Date(timestamp).toLocaleString();
  }

  formatAction(action: string): string {
    if (!action) return '';
    return action
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(this.totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }
}
