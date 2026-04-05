import { Injectable } from '@angular/core';
import { CanDeactivate } from '@angular/router';
import { AlertController } from '@ionic/angular';

export interface CanComponentDeactivate {
  canDeactivate: () => boolean;
}

@Injectable({ providedIn: 'root' })
export class CanDeactivateGuard
  implements CanDeactivate<CanComponentDeactivate> {

  private isAlertOpen = false;  // ← add this flag

  constructor(private alertCtrl: AlertController) {}

  async canDeactivate(
    component: CanComponentDeactivate
  ): Promise<boolean> {

    if (!component.canDeactivate || component.canDeactivate()) {
    console.log('GUARD: safe to leave');  // ← add this
      return true;
    }

    // ── Prevent double alert ──────────────────────────────────────────
  if (this.isAlertOpen) {
    console.log('GUARD: alert already open, blocking');  // ← add this
    return false;
  }
    return new Promise(async (resolve) => {
      this.isAlertOpen = true;  // ← set flag before showing

      const alert = await this.alertCtrl.create({
        header:          'Unsaved Changes',
        message:         'You have unsaved changes. If you leave now, your data will be lost.',
        backdropDismiss: false,
        buttons: [
          {
            text: 'Stay',
            role: 'cancel',
            handler: () => {
              alert.dismiss().then(() => {
                this.isAlertOpen = false;  // ← reset flag
                resolve(false);
              });
              return false;
            }
          },
          {
            text: 'Leave Anyway',
            role: 'destructive',
            handler: () => {
              alert.dismiss().then(() => {
                this.isAlertOpen = false;  // ← reset flag
                resolve(true);
              });
              return false;
            }
          }
        ]
      });

      await alert.present();
    });
  }
}