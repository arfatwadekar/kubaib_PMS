import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { Router } from '@angular/router';

@Component({
  selector: 'app-pid-success',
  templateUrl: './pid-success.page.html',
  styleUrls: ['./pid-success.page.scss'],
  standalone:false
})
export class PidSuccessPage {
  @Input() pid!: string;
  @Input() registeredBy = 'Receptionist';

  today = new Date();

  constructor(
    private modalCtrl: ModalController,
    private router: Router
  ) {}

  async goDashboard() {
    await this.modalCtrl.dismiss();
    this.router.navigate(['/patients/list']);
  }
}
