import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-coming-soon',
  templateUrl: './coming-soon.page.html',
  standalone:false,
})
export class ComingSoonPage {
  title = 'Coming Soon';

  constructor(private route: ActivatedRoute) {
    const t = this.route.snapshot.queryParamMap.get('t');
    if (t) this.title = t;
  }
}
