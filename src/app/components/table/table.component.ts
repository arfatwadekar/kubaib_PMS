import { Component, EventEmitter, Input, Output, TemplateRef } from '@angular/core';

/**
 * Reusable Table Component
 * ------------------------
 * - columns: table headers config
 * - rows: table data
 * - loading: loader state
 * - rowTemplate: custom row (actions etc.)
 * - prev / next: pagination events
 */

export type TableColumn = {
  key: string;      // row field name
  label: string;    // column title
  width?: string;   // optional fixed width
  align?: 'start' | 'center' | 'end';
};

@Component({
  selector: 'app-table',
  templateUrl: './table.component.html',
  styleUrls: ['./table.component.scss'],
  standalone:false,
})
export class TableComponent {
  @Input() columns: TableColumn[] = [];
  @Input() rows: any[] = [];

  @Input() loading = false;
  @Input() emptyText = 'No data found';

  // pagination
  @Input() page = 1;
  @Input() disablePrev = false;
  @Input() disableNext = false;

  // custom row template (for action buttons)
  @Input() rowTemplate?: TemplateRef<any>;

  @Output() prev = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();

  trackByIndex = (i: number) => i;
}
