import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';

export interface BreadcrumbItem {
  label: string;
  url?: string;
}

@Component({
  selector: 'app-breadcrumb',
  templateUrl: './breadcrumb.component.html',
  styleUrls: ['./breadcrumb.component.css']
})
export class BreadcrumbComponent {
  @Input() items: BreadcrumbItem[] = [];
  @Input() showBackButton: boolean = true;

  constructor(
    private router: Router,
    private location: Location
  ) {}

  navigate(item: BreadcrumbItem) {
    if (item.url) {
      this.router.navigate([item.url]);
    }
  }

  goBack() {
    this.location.back();
  }
}
